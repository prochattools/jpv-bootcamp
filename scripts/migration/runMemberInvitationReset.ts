/**
 * REM-01: Member Invitation/Reset Command
 *
 * Sends password-reset invitation emails to migration-sourced members who
 * have never logged in (source='migration', account_status IN ('active','pending')).
 *
 * Modes:
 *   dry-run (default) — query cohort, report counts and redacted domains, no writes
 *   apply             — send password-reset emails via Payload API, record in audit table
 *
 * Usage:
 *   pnpm tsx scripts/migration/runMemberInvitationReset.ts dry-run
 *   pnpm tsx scripts/migration/runMemberInvitationReset.ts apply \
 *     --staging-url https://preview.jpvbootcamp.com \
 *     --authorization-token <token>
 *
 * Hard stops:
 *   - DATABASE_URL not set
 *   - apply without --authorization-token
 *   - apply without --staging-url
 *   - apply when NODE_ENV=production
 *   - cohort size is 0
 */

import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { Client } from 'pg'
import { redactForLog } from './legacyMigrationFramework'

// ─── Types ────────────────────────────────────────────────────────────────────

export type InvitationMode = 'dry-run' | 'apply'

export interface InvitationConfig {
  mode: InvitationMode
  databaseUrl: string
  schemaName: string
  runId: string
  stagingUrl?: string
  authorizationToken?: string
}

export interface MemberRow {
  id: string
  email: string
  account_status: string
}

export interface InvitationResult {
  runId: string
  mode: InvitationMode
  cohortTotal: number
  alreadyInvited: number
  pending: number
  sent: number
  skipped: number
  failed: number
}

// ─── Idempotency key ─────────────────────────────────────────────────────────

/**
 * Deterministic per-member idempotency key.
 * Stable: same member_id + run_id always yields the same key.
 */
export function buildIdempotencyKey(memberId: string, runId: string): string {
  const hash = createHash('sha256')
    .update(memberId + runId)
    .digest('hex')
    .substring(0, 32)
  return `member_invitation_v1_${hash}`
}

// ─── Deterministic run ID ─────────────────────────────────────────────────────

/**
 * Deterministic per-day run ID.
 * All invocations on the same calendar date share the same run ID.
 */
export function buildRunId(dateStr?: string): string {
  const date = dateStr ?? new Date().toISOString().substring(0, 10)
  const hash = createHash('sha256').update(date).digest('hex').substring(0, 16)
  return `invitation_run_v1_${hash}`
}

// ─── Guard checks ─────────────────────────────────────────────────────────────

export interface GuardCheckResult {
  ok: boolean
  reason?: string
}

export function checkDatabaseUrl(databaseUrl: string | undefined): GuardCheckResult {
  if (!databaseUrl) {
    return { ok: false, reason: 'DATABASE_URL environment variable is not set' }
  }
  return { ok: true }
}

export function checkApplyGuards(
  mode: InvitationMode,
  authorizationToken: string | undefined,
  stagingUrl: string | undefined,
  nodeEnv: string | undefined,
): GuardCheckResult {
  if (mode !== 'apply') return { ok: true }
  if (nodeEnv === 'production') {
    return { ok: false, reason: 'apply mode is blocked when NODE_ENV=production' }
  }
  if (!authorizationToken) {
    return { ok: false, reason: 'apply mode requires --authorization-token <token>' }
  }
  if (!stagingUrl) {
    return { ok: false, reason: 'apply mode requires --staging-url <url>' }
  }
  return { ok: true }
}

// ─── Audit table ──────────────────────────────────────────────────────────────

export async function ensureInvitationAuditTable(client: Client, schemaName: string): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "${schemaName}".member_invitation_audit (
      id SERIAL PRIMARY KEY,
      idempotency_key TEXT NOT NULL UNIQUE,
      member_id TEXT NOT NULL,
      email_domain TEXT NOT NULL,
      invitation_run_id TEXT NOT NULL,
      outcome TEXT NOT NULL CHECK (outcome IN ('sent', 'skipped_already_sent', 'failed')),
      sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
}

export async function isAlreadyInvited(
  client: Client,
  schemaName: string,
  idempotencyKey: string,
): Promise<boolean> {
  const result = await client.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM "${schemaName}".member_invitation_audit WHERE idempotency_key = $1`,
    [idempotencyKey],
  )
  return parseInt(result.rows[0].count, 10) > 0
}

export async function recordInvitationAudit(
  client: Client,
  schemaName: string,
  idempotencyKey: string,
  memberId: string,
  emailDomain: string,
  runId: string,
  outcome: 'sent' | 'skipped_already_sent' | 'failed',
): Promise<void> {
  await client.query(
    `INSERT INTO "${schemaName}".member_invitation_audit
       (idempotency_key, member_id, email_domain, invitation_run_id, outcome)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (idempotency_key) DO NOTHING`,
    [idempotencyKey, memberId, emailDomain, runId, outcome],
  )
}

// ─── Cohort query ─────────────────────────────────────────────────────────────

export async function queryCohort(client: Client, schemaName: string): Promise<MemberRow[]> {
  const result = await client.query<MemberRow>(
    `SELECT id::text, email, account_status
     FROM "${schemaName}".payload_members
     WHERE source = 'migration'
       AND account_status IN ('active', 'pending')
     ORDER BY id`,
  )
  return result.rows
}

// ─── HTTP send ────────────────────────────────────────────────────────────────

export async function sendPasswordResetEmail(
  stagingUrl: string,
  authorizationToken: string,
  email: string,
): Promise<{ ok: boolean; status: number }> {
  const url = `${stagingUrl}/api/member-password/forgot`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authorizationToken}`,
    },
    body: JSON.stringify({ email }),
  })
  return { ok: response.ok, status: response.status }
}

// ─── Core logic ───────────────────────────────────────────────────────────────

export async function runInvitationReset(config: InvitationConfig): Promise<InvitationResult> {
  const client = new Client({ connectionString: config.databaseUrl })
  await client.connect()

  try {
    const members = await queryCohort(client, config.schemaName)
    const cohortTotal = members.length

    if (cohortTotal === 0) {
      console.log(`REM-01: Cohort is empty (source=migration, active/pending). Nothing to do.`)
      return {
        runId: config.runId,
        mode: config.mode,
        cohortTotal: 0,
        alreadyInvited: 0,
        pending: 0,
        sent: 0,
        skipped: 0,
        failed: 0,
      }
    }

    // Dry-run: count already invited vs pending without writing
    if (config.mode === 'dry-run') {
      let alreadyInvited = 0

      // For dry-run, check if audit table exists before querying it
      const auditExists = await client.query<{ exists: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM information_schema.tables
           WHERE table_schema = $1 AND table_name = 'member_invitation_audit'
         ) AS exists`,
        [config.schemaName],
      )

      if (auditExists.rows[0].exists) {
        for (const member of members) {
          const ikey = buildIdempotencyKey(member.id, config.runId)
          const sent = await isAlreadyInvited(client, config.schemaName, ikey)
          if (sent) alreadyInvited++
        }
      }

      const pending = cohortTotal - alreadyInvited

      return {
        runId: config.runId,
        mode: 'dry-run',
        cohortTotal,
        alreadyInvited,
        pending,
        sent: 0,
        skipped: 0,
        failed: 0,
      }
    }

    // Apply mode
    await ensureInvitationAuditTable(client, config.schemaName)

    let sent = 0
    let skipped = 0
    let failed = 0

    for (const member of members) {
      const ikey = buildIdempotencyKey(member.id, config.runId)
      const domain = member.email.split('@')[1] ?? 'unknown'

      const alreadySent = await isAlreadyInvited(client, config.schemaName, ikey)
      if (alreadySent) {
        console.log(`  skip [email:${domain.substring(0, 8)}] — already invited`)
        skipped++
        continue
      }

      let outcome: 'sent' | 'failed' = 'sent'
      try {
        const result = await sendPasswordResetEmail(
          config.stagingUrl!,
          config.authorizationToken!,
          member.email,
        )
        if (!result.ok) {
          console.log(`  fail [email:${domain.substring(0, 8)}] — HTTP ${result.status}`)
          outcome = 'failed'
          failed++
        } else {
          console.log(`  sent [email:${domain.substring(0, 8)}]`)
          sent++
        }
      } catch (e) {
        console.log(`  fail [email:${domain.substring(0, 8)}] — ${String(e)}`)
        outcome = 'failed'
        failed++
      }

      await recordInvitationAudit(client, config.schemaName, ikey, member.id, domain, config.runId, outcome)
    }

    const alreadyInvited = skipped
    const pending = cohortTotal - alreadyInvited

    return {
      runId: config.runId,
      mode: 'apply',
      cohortTotal,
      alreadyInvited,
      pending,
      sent,
      skipped,
      failed,
    }
  } finally {
    await client.end()
  }
}

// ─── Output formatter ─────────────────────────────────────────────────────────

export function formatOutput(result: InvitationResult): string {
  const lines: string[] = [
    `REM-01: Member Invitation/Reset`,
    `Mode: ${result.mode}`,
    `Run ID: ${result.runId}`,
    ``,
    `Cohort (source=migration):`,
    `  Total: ${result.cohortTotal}`,
    `  Already invited: ${result.alreadyInvited}`,
    `  Pending: ${result.pending}`,
    ``,
  ]
  if (result.mode === 'dry-run') {
    lines.push(`[dry-run: No emails sent. Run with mode=apply and required flags to send.]`)
  } else {
    lines.push(`[apply: ${result.sent} sent, ${result.skipped} skipped, ${result.failed} failed]`)
  }
  return lines.join('\n')
}

// ─── CLI entrypoint ───────────────────────────────────────────────────────────

function parseCliArgs(): {
  mode: InvitationMode
  schemaName: string
  stagingUrl?: string
  authorizationToken?: string
} {
  const args = process.argv.slice(2)

  // First positional arg or --dry-run flag
  let modeArg = args[0]
  let mode: InvitationMode = 'dry-run'

  if (modeArg === 'apply') {
    mode = 'apply'
  } else if (modeArg === 'dry-run' || modeArg === '--dry-run' || !modeArg || modeArg.startsWith('--')) {
    mode = 'dry-run'
  } else {
    console.error(`Invalid mode: ${modeArg}. Valid modes: dry-run, apply`)
    process.exit(1)
  }

  // Parse named flags
  let schemaName = 'jpvbootcamp_staging'
  let stagingUrl: string | undefined
  let authorizationToken: string | undefined

  const flagArgs = modeArg?.startsWith('--') ? args : args.slice(1)

  for (let i = 0; i < flagArgs.length; i++) {
    const flag = flagArgs[i]
    const next = flagArgs[i + 1]

    if (flag === '--dry-run') {
      mode = 'dry-run'
    } else if (flag === '--schema') {
      if (!next || next.startsWith('--')) {
        console.error('Flag --schema requires a value')
        process.exit(1)
      }
      schemaName = next
      i++
    } else if (flag === '--staging-url') {
      if (!next || next.startsWith('--')) {
        console.error('Flag --staging-url requires a value')
        process.exit(1)
      }
      stagingUrl = next
      i++
    } else if (flag === '--authorization-token') {
      if (!next || next.startsWith('--')) {
        console.error('Flag --authorization-token requires a value')
        process.exit(1)
      }
      authorizationToken = next
      i++
    } else if (flag.startsWith('--')) {
      console.error(`Unknown flag: ${flag}`)
      process.exit(1)
    }
  }

  return { mode, schemaName, stagingUrl, authorizationToken }
}

async function main() {
  const { mode, schemaName, stagingUrl, authorizationToken } = parseCliArgs()

  // Guard: DATABASE_URL
  const databaseUrlCheck = checkDatabaseUrl(process.env.DATABASE_URL)
  if (!databaseUrlCheck.ok) {
    console.error(`REM-01 error: ${databaseUrlCheck.reason}`)
    process.exit(1)
  }

  // Guard: apply prerequisites
  const applyCheck = checkApplyGuards(mode, authorizationToken, stagingUrl, process.env.NODE_ENV)
  if (!applyCheck.ok) {
    console.error(`REM-01 error: ${applyCheck.reason}`)
    process.exit(1)
  }

  const runId = buildRunId()
  const databaseUrl = process.env.DATABASE_URL!

  console.log(`REM-01: Member Invitation/Reset`)
  console.log(`Mode: ${mode}`)
  console.log(`Schema: ${schemaName}`)
  console.log(`Run ID: ${runId}`)
  console.log(`Database: ${databaseUrl.replace(/\/\/[^:]*:[^@]*@/, '//<REDACTED>@')}`)
  console.log(``)

  const result = await runInvitationReset({
    mode,
    databaseUrl,
    schemaName,
    runId,
    stagingUrl,
    authorizationToken,
  })

  if (result.cohortTotal === 0) {
    process.exit(0)
  }

  console.log(formatOutput(result))

  if (result.failed > 0) {
    process.exit(1)
  }
}

// Only run CLI when this file is the entry point (not when imported by tests)
const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] != null &&
  (process.argv[1] === fileURLToPath(import.meta.url) ||
    process.argv[1].endsWith('runMemberInvitationReset.ts') ||
    process.argv[1].endsWith('runMemberInvitationReset.js'))

if (isMain) {
  main().catch((e) => {
    console.error('Fatal error:', e instanceof Error ? e.message : String(e))
    process.exit(1)
  })
}
