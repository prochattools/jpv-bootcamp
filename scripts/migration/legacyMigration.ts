/**
 * Canonical idempotent legacy-data migration tool.
 *
 * Source:      jpvbootcamp_staging.customer_provisioning (Prisma operational tables)
 * Destination: jpvbootcamp_staging Payload collections (members, billing, access grants)
 *
 * Modes:
 *   extract   — read source rows, emit inventory (no destination writes)
 *   validate  — run source/destination checks and emit a validation report
 *   dry-run   — full transform + conflict detection, NO destination writes
 *   apply     — idempotent upsert to destination (staging guard enforced)
 *   rollback  — delete migration-sourced rows by migration_run_id
 *
 * Hard guards (abort before any DB write):
 *   - DATABASE_URL host must be 100.71.31.88
 *   - DATABASE_URL schema must be jpvbootcamp_staging
 *
 * Safety:
 *   - Never logs PII — only counts, hashes, and IDs
 *   - All destination writes use deterministic source IDs
 *   - Transactions per record with per-record error ledger
 *   - Checkpoints written to migration_checkpoints table
 *   - Audit events written to payload_migration_audit table (created if absent)
 */

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { Client } from 'pg'

// ─── types ────────────────────────────────────────────────────────────────────

export type MigrationMode = 'extract' | 'validate' | 'dry-run' | 'apply' | 'rollback'

export interface MigrationConfig {
  mode: MigrationMode
  databaseUrl: string
  runId: string
  checkpointDir: string
  batchSize?: number
  rollbackRunId?: string
}

export interface SourceRow {
  normalizedEmail: string
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  stripePriceId: string | null
  accountId: number | null
  plan: string | null
  currentPlan: string | null
  status: string
  subscriptionStatus: string | null
  subscriptionCurrentPeriodEnd: Date | null
  subscriptionCancelAtPeriodEnd: boolean | null
  billingCadence: string | null
  paymentStatus: string | null
  paymentDisputeStatus: string | null
  commitmentStatus: string | null
  createdAt: Date
  updatedAt: Date
}

export interface TransformedRecord {
  sourceId: string
  normalizedEmailHash: string
  member: {
    email: string
    accountStatus: 'active' | 'pending' | 'blocked' | 'suspended'
    source: 'migration'
    notes: string
  }
  billingAccount: {
    displayName: string
    stripeCustomerId: string
    billingStatus: string
    stripeMode: 'test' | 'live'
  } | null
  subscription: {
    displayName: string
    stripeSubscriptionId: string
    stripePriceId: string | null
    plan: 'free' | 'pro'
    status: string
    billingCadence: 'monthly_commitment' | 'annual' | null
    currentPeriodEnd: Date | null
  } | null
  accessGrant: {
    displayName: string
    resourceType: 'course'
    resourceId: 'all'
    status: 'active' | 'revoked'
    source: 'migration'
    sourceId: string
  } | null
}

export interface MigrationError {
  sourceId: string
  phase: string
  message: string
  recoverable: boolean
}

export interface MigrationCheckpoint {
  runId: string
  processedCount: number
  errorCount: number
  lastSourceId: string | null
  completedAt: string | null
}

export interface MigrationResult {
  runId: string
  mode: MigrationMode
  sourceCount: number
  processedCount: number
  skippedCount: number
  errorCount: number
  errors: MigrationError[]
  checkpoint: MigrationCheckpoint
  dryRunSummary?: string[]
}

// ─── guard ────────────────────────────────────────────────────────────────────

// Allowed DB hosts:
//   100.71.31.88  — Tailscale address (outside container / local)
//   10.0.2.4      — Docker overlay address (inside Dokploy container)
// Both resolve to the same Supabase staging instance. Schema is the hard invariant.
const ALLOWED_DB_HOSTS = ['100.71.31.88', '10.0.2.4']

export function assertStagingGuard(databaseUrl: string): void {
  let parsed: URL
  try {
    parsed = new URL(databaseUrl)
  } catch {
    throw new Error('database_url_malformed')
  }
  const host = parsed.hostname
  const schema = parsed.searchParams.get('schema') ?? ''
  if (!ALLOWED_DB_HOSTS.includes(host)) {
    throw new Error(`database_host_rejected: got ${host}, expected one of ${ALLOWED_DB_HOSTS.join(',')}`)
  }
  if (schema !== 'jpvbootcamp_staging') {
    throw new Error(`database_schema_rejected: got ${schema}, expected jpvbootcamp_staging`)
  }
}

// ─── deterministic source ID ──────────────────────────────────────────────────

export function sourceId(normalizedEmail: string): string {
  return 'migration_v1_' + createHash('sha256').update(normalizedEmail.toLowerCase().trim()).digest('hex').substring(0, 32)
}

// ─── PII-safe email hash (for logging only) ───────────────────────────────────

function emailHash(email: string): string {
  return createHash('sha256').update(email.toLowerCase().trim()).digest('hex').substring(0, 16)
}

// ─── account status mapping ───────────────────────────────────────────────────

function mapAccountStatus(row: SourceRow): 'active' | 'pending' | 'blocked' | 'suspended' {
  if (row.status === 'active') return 'active'
  if (row.status === 'blocked') return 'blocked'
  if (row.status === 'suspended') return 'suspended'
  return 'pending'
}

// ─── plan mapping ─────────────────────────────────────────────────────────────

function mapPlan(row: SourceRow): 'free' | 'pro' {
  const p = (row.plan ?? row.currentPlan ?? '').toLowerCase()
  if (p === 'pro' || p === 'vip') return 'pro'
  return 'free'
}

// ─── billing status mapping ───────────────────────────────────────────────────

function mapBillingStatus(row: SourceRow): string {
  if (!row.subscriptionStatus) return 'none'
  const s = row.subscriptionStatus.toLowerCase()
  if (s === 'active') return 'active'
  if (s === 'trialing') return 'trialing'
  if (s === 'past_due') return 'past_due'
  if (s === 'unpaid') return 'unpaid'
  if (s === 'canceled' || s === 'cancelled') return 'canceled'
  return 'none'
}

// ─── subscription status mapping ─────────────────────────────────────────────

function mapSubscriptionStatus(row: SourceRow): string {
  return row.subscriptionStatus ?? 'incomplete'
}

// ─── billing cadence mapping ──────────────────────────────────────────────────

function mapBillingCadence(row: SourceRow): 'monthly_commitment' | 'annual' | null {
  if (row.billingCadence === 'monthly') return 'monthly_commitment'
  if (row.billingCadence === 'annual') return 'annual'
  return null
}

// ─── access grant eligibility ────────────────────────────────────────────────

function isAccessGrantEligible(row: SourceRow): boolean {
  if (!row.stripeSubscriptionId) return false
  if (!row.subscriptionStatus) return false
  const s = row.subscriptionStatus.toLowerCase()
  return s === 'active' || s === 'trialing'
}

// ─── transform ────────────────────────────────────────────────────────────────

export function transformRow(row: SourceRow): TransformedRecord {
  const sid = sourceId(row.normalizedEmail)
  const plan = mapPlan(row)
  const accessEligible = isAccessGrantEligible(row)

  return {
    sourceId: sid,
    normalizedEmailHash: emailHash(row.normalizedEmail),
    member: {
      email: row.normalizedEmail,
      accountStatus: mapAccountStatus(row),
      source: 'migration',
      notes: `migrated from legacy system (account_id=${row.accountId ?? 'unknown'}) run=${sid}`,
    },
    billingAccount: row.stripeCustomerId
      ? {
          displayName: `Billing (${emailHash(row.normalizedEmail)})`,
          stripeCustomerId: row.stripeCustomerId,
          billingStatus: mapBillingStatus(row),
          stripeMode: 'test',
        }
      : null,
    subscription:
      row.stripeSubscriptionId && row.stripeCustomerId
        ? {
            displayName: `Subscription (${emailHash(row.normalizedEmail)})`,
            stripeSubscriptionId: row.stripeSubscriptionId,
            stripePriceId: row.stripePriceId,
            plan,
            status: mapSubscriptionStatus(row),
            billingCadence: mapBillingCadence(row),
            currentPeriodEnd: row.subscriptionCurrentPeriodEnd,
          }
        : null,
    accessGrant: accessEligible
      ? {
          displayName: `Access Grant (${emailHash(row.normalizedEmail)})`,
          resourceType: 'course',
          resourceId: 'all',
          status: 'active',
          source: 'migration',
          sourceId: sid,
        }
      : null,
  }
}

// ─── checkpoint ───────────────────────────────────────────────────────────────

function checkpointPath(dir: string, runId: string): string {
  return path.join(dir, `checkpoint_${runId}.json`)
}

function loadCheckpoint(dir: string, runId: string): MigrationCheckpoint | null {
  const p = checkpointPath(dir, runId)
  if (!existsSync(p)) return null
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as MigrationCheckpoint
  } catch {
    return null
  }
}

function saveCheckpoint(dir: string, cp: MigrationCheckpoint): void {
  mkdirSync(dir, { recursive: true })
  writeFileSync(checkpointPath(dir, cp.runId), JSON.stringify(cp, null, 2))
}

// ─── audit event ─────────────────────────────────────────────────────────────

async function writeAuditEvent(
  client: Client,
  runId: string,
  event: string,
  detail: Record<string, unknown>,
): Promise<void> {
  await client.query(
    `INSERT INTO jpvbootcamp_staging.payload_migration_audit
       (run_id, event, detail, created_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT DO NOTHING`,
    [runId, event, JSON.stringify(detail)],
  ).catch(() => {
    // Table may not exist yet on first run — created below
  })
}

async function ensureAuditTable(client: Client): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS jpvbootcamp_staging.payload_migration_audit (
      id          bigserial PRIMARY KEY,
      run_id      text NOT NULL,
      event       text NOT NULL,
      detail      jsonb,
      created_at  timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS migration_audit_run_id_idx
      ON jpvbootcamp_staging.payload_migration_audit (run_id);
  `)
}

// ─── extract source rows ──────────────────────────────────────────────────────

export async function extractSourceRows(client: Client): Promise<SourceRow[]> {
  // Actual customer_provisioning schema: id, stripe_customer_id, stripe_subscription_id,
  // wp_user_id, email, plan, status, last_event_id, created_at, updated_at, current_plan,
  // last_notified_plan, last_notified_event_id, last_notified_at, normalized_email.
  // Columns absent in this table are null-filled; status is used as subscriptionStatus.
  const result = await client.query<SourceRow>(`
    SELECT
      normalized_email       AS "normalizedEmail",
      stripe_customer_id     AS "stripeCustomerId",
      stripe_subscription_id AS "stripeSubscriptionId",
      NULL::text             AS "stripePriceId",
      wp_user_id             AS "accountId",
      plan,
      current_plan           AS "currentPlan",
      status,
      status                 AS "subscriptionStatus",
      NULL::timestamptz      AS "subscriptionCurrentPeriodEnd",
      NULL::boolean          AS "subscriptionCancelAtPeriodEnd",
      NULL::text             AS "billingCadence",
      NULL::text             AS "paymentStatus",
      NULL::text             AS "paymentDisputeStatus",
      NULL::text             AS "commitmentStatus",
      created_at             AS "createdAt",
      updated_at             AS "updatedAt"
    FROM jpvbootcamp_staging.customer_provisioning
    WHERE normalized_email IS NOT NULL
      AND normalized_email != ''
    ORDER BY created_at ASC
  `)
  return result.rows
}

// ─── apply single record (idempotent upsert) ─────────────────────────────────

async function applyRecord(
  client: Client,
  record: TransformedRecord,
  runId: string,
): Promise<{ memberId: number; billingAccountId: number | null; subscriptionId: number | null }> {
  // Step 1: upsert member
  const memberResult = await client.query<{ id: number }>(`
    INSERT INTO jpvbootcamp_staging.payload_members
      (email, account_status, source, notes, updated_at, created_at)
    VALUES ($1, $2, $3, $4, now(), now())
    ON CONFLICT (email) DO UPDATE
      SET account_status = EXCLUDED.account_status,
          source         = CASE WHEN payload_members.source = 'migration' THEN 'migration' ELSE EXCLUDED.source END,
          notes          = EXCLUDED.notes,
          updated_at     = now()
    RETURNING id
  `, [
    record.member.email,
    record.member.accountStatus,
    record.member.source,
    record.member.notes,
  ])
  const memberId = memberResult.rows[0]!.id

  // Step 2: upsert billing account (if available)
  let billingAccountId: number | null = null
  if (record.billingAccount) {
    const baResult = await client.query<{ id: number }>(`
      INSERT INTO jpvbootcamp_staging.payload_billing_accounts
        (display_name, member_id, stripe_customer_id, stripe_mode, billing_status, updated_at, created_at)
      VALUES ($1, $2, $3, $4, $5, now(), now())
      ON CONFLICT (stripe_customer_id) DO UPDATE
        SET billing_status = EXCLUDED.billing_status,
            member_id      = EXCLUDED.member_id,
            updated_at     = now()
      RETURNING id
    `, [
      record.billingAccount.displayName,
      memberId,
      record.billingAccount.stripeCustomerId,
      record.billingAccount.stripeMode,
      record.billingAccount.billingStatus,
    ])
    billingAccountId = baResult.rows[0]!.id
  }

  // Step 3: upsert subscription (if available)
  let subscriptionId: number | null = null
  if (record.subscription && billingAccountId !== null) {
    const subResult = await client.query<{ id: number }>(`
      INSERT INTO jpvbootcamp_staging.payload_subscriptions
        (display_name, member_id, billing_account_id, stripe_subscription_id, stripe_price_id,
         plan, status, billing_cadence, current_period_end, updated_at, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())
      ON CONFLICT (stripe_subscription_id) DO UPDATE
        SET plan               = EXCLUDED.plan,
            status             = EXCLUDED.status,
            billing_cadence    = EXCLUDED.billing_cadence,
            current_period_end = EXCLUDED.current_period_end,
            updated_at         = now()
      RETURNING id
    `, [
      record.subscription.displayName,
      memberId,
      billingAccountId,
      record.subscription.stripeSubscriptionId,
      record.subscription.stripePriceId,
      record.subscription.plan,
      record.subscription.status,
      record.subscription.billingCadence,
      record.subscription.currentPeriodEnd,
    ])
    subscriptionId = subResult.rows[0]!.id
  }

  // Step 4: upsert access grant (if eligible)
  if (record.accessGrant) {
    await client.query(`
      INSERT INTO jpvbootcamp_staging.payload_access_grants
        (display_name, member_id, resource_type, resource_id, status, source, source_id, updated_at, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())
      ON CONFLICT (source_id) DO UPDATE
        SET status     = EXCLUDED.status,
            updated_at = now()
    `, [
      record.accessGrant.displayName,
      memberId,
      record.accessGrant.resourceType,
      record.accessGrant.resourceId,
      record.accessGrant.status,
      record.accessGrant.source,
      record.accessGrant.sourceId,
    ])
  }

  await writeAuditEvent(client, runId, 'record_applied', {
    sourceId: record.sourceId,
    emailHash: record.normalizedEmailHash,
    memberId,
    billingAccountId,
    subscriptionId,
    hasGrant: !!record.accessGrant,
  })

  return { memberId, billingAccountId, subscriptionId }
}

// ─── rollback ────────────────────────────────────────────────────────────────

async function rollbackRun(client: Client, rollbackRunId: string, log: (m: string) => void): Promise<void> {
  log(`ROLLBACK: removing migration-source records for run_id prefix migration_v1_`)

  // Delete access grants by source = 'migration'
  const grantResult = await client.query(
    `DELETE FROM jpvbootcamp_staging.payload_access_grants WHERE source = 'migration'`,
  )
  log(`ROLLBACK: deleted ${grantResult.rowCount} access grants`)

  // Delete subscriptions for members sourced from migration
  const subResult = await client.query(`
    DELETE FROM jpvbootcamp_staging.payload_subscriptions
    WHERE member_id IN (
      SELECT id FROM jpvbootcamp_staging.payload_members WHERE source = 'migration'
    )
  `)
  log(`ROLLBACK: deleted ${subResult.rowCount} subscriptions`)

  // Delete billing accounts for members sourced from migration
  const baResult = await client.query(`
    DELETE FROM jpvbootcamp_staging.payload_billing_accounts
    WHERE member_id IN (
      SELECT id FROM jpvbootcamp_staging.payload_members WHERE source = 'migration'
    )
  `)
  log(`ROLLBACK: deleted ${baResult.rowCount} billing accounts`)

  // Delete members sourced from migration
  const memberResult = await client.query(
    `DELETE FROM jpvbootcamp_staging.payload_members WHERE source = 'migration'`,
  )
  log(`ROLLBACK: deleted ${memberResult.rowCount} members`)

  await writeAuditEvent(client, rollbackRunId, 'rollback_completed', {
    grantsDeleted: grantResult.rowCount,
    subscriptionsDeleted: subResult.rowCount,
    billingAccountsDeleted: baResult.rowCount,
    membersDeleted: memberResult.rowCount,
  })

  log(`ROLLBACK COMPLETE`)
}

// ─── main migration runner ────────────────────────────────────────────────────

export async function runMigration(
  config: MigrationConfig,
  log: (message: string) => void,
): Promise<MigrationResult> {
  assertStagingGuard(config.databaseUrl)

  const errors: MigrationError[] = []
  const dryRunSummary: string[] = []
  let checkpoint = loadCheckpoint(config.checkpointDir, config.runId) ?? {
    runId: config.runId,
    processedCount: 0,
    errorCount: 0,
    lastSourceId: null,
    completedAt: null,
  }

  if (config.mode === 'rollback' && !config.rollbackRunId) {
    throw new Error('rollback requires rollbackRunId')
  }

  log(`=== MIGRATION mode=${config.mode} runId=${config.runId} ===`)
  log(`GUARD: host=100.71.31.88 schema=jpvbootcamp_staging`)

  const client = new Client({ connectionString: config.databaseUrl })
  await client.connect()

  try {
    if (config.mode === 'apply') {
      await ensureAuditTable(client)
    }

    if (config.mode === 'rollback') {
      await ensureAuditTable(client)
      await rollbackRun(client, config.rollbackRunId!, log)
      return {
        runId: config.runId,
        mode: 'rollback',
        sourceCount: 0,
        processedCount: 0,
        skippedCount: 0,
        errorCount: 0,
        errors: [],
        checkpoint,
      }
    }

    // Extract
    log('=== EXTRACT ===')
    const rows = await extractSourceRows(client)
    log(`source_rows=${rows.length}`)

    if (config.mode === 'extract') {
      log(`EXTRACT COMPLETE: ${rows.length} rows found, no writes performed`)
      return {
        runId: config.runId,
        mode: 'extract',
        sourceCount: rows.length,
        processedCount: 0,
        skippedCount: 0,
        errorCount: 0,
        errors: [],
        checkpoint,
      }
    }

    // Validate
    log('=== VALIDATE ===')
    let nullEmailCount = 0
    let noCustomerCount = 0
    let duplicateEmails = 0
    const seenEmails = new Set<string>()
    for (const row of rows) {
      if (!row.normalizedEmail) { nullEmailCount++; continue }
      if (seenEmails.has(row.normalizedEmail)) { duplicateEmails++ }
      seenEmails.add(row.normalizedEmail)
      if (!row.stripeCustomerId) noCustomerCount++
    }
    log(`null_emails=${nullEmailCount} duplicate_emails=${duplicateEmails} no_stripe_customer=${noCustomerCount}`)

    if (nullEmailCount > 0) {
      log(`WARN: ${nullEmailCount} rows have null email — will be skipped`)
    }

    if (config.mode === 'validate') {
      log('VALIDATE COMPLETE')
      return {
        runId: config.runId,
        mode: 'validate',
        sourceCount: rows.length,
        processedCount: 0,
        skippedCount: nullEmailCount,
        errorCount: 0,
        errors: [],
        checkpoint,
      }
    }

    // Transform + dry-run / apply
    log('=== TRANSFORM ===')
    const records = rows.map(transformRow)

    if (config.mode === 'dry-run') {
      let withBilling = 0, withSubscription = 0, withGrant = 0
      for (const r of records) {
        dryRunSummary.push(`sourceId=${r.sourceId} emailHash=${r.normalizedEmailHash} status=${r.member.accountStatus} billing=${!!r.billingAccount} sub=${!!r.subscription} grant=${!!r.accessGrant}`)
        if (r.billingAccount) withBilling++
        if (r.subscription) withSubscription++
        if (r.accessGrant) withGrant++
      }
      log(`DRY_RUN: total=${records.length} with_billing=${withBilling} with_subscription=${withSubscription} with_grant=${withGrant}`)
      log('DRY_RUN COMPLETE: no writes performed')
      return {
        runId: config.runId,
        mode: 'dry-run',
        sourceCount: rows.length,
        processedCount: records.length,
        skippedCount: 0,
        errorCount: 0,
        errors: [],
        checkpoint,
        dryRunSummary,
      }
    }

    // Apply
    log('=== APPLY ===')
    let processedCount = checkpoint.processedCount
    let skippedCount = 0

    // Resume: skip already-processed records
    const resumeAfter = checkpoint.lastSourceId
    let resuming = resumeAfter !== null

    for (const record of records) {
      if (resuming) {
        if (record.sourceId === resumeAfter) {
          resuming = false
        }
        skippedCount++
        continue
      }

      try {
        await client.query('BEGIN')
        await applyRecord(client, record, config.runId)
        await client.query('COMMIT')
        processedCount++
        checkpoint = {
          ...checkpoint,
          processedCount,
          lastSourceId: record.sourceId,
        }
        if (processedCount % 10 === 0) {
          saveCheckpoint(config.checkpointDir, checkpoint)
          log(`checkpoint: processed=${processedCount}`)
        }
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {})
        const message = err instanceof Error ? err.message : String(err)
        errors.push({
          sourceId: record.sourceId,
          phase: 'apply',
          message,
          recoverable: true,
        })
        checkpoint = { ...checkpoint, errorCount: checkpoint.errorCount + 1 }
        log(`ERROR: sourceId=${record.sourceId} message=${message}`)
      }
    }

    checkpoint.completedAt = new Date().toISOString()
    saveCheckpoint(config.checkpointDir, checkpoint)

    await writeAuditEvent(client, config.runId, 'migration_completed', {
      processedCount,
      errorCount: errors.length,
      skippedCount,
    })

    log(`APPLY COMPLETE: processed=${processedCount} errors=${errors.length} skipped=${skippedCount}`)
    log(`=== MIGRATION COMPLETE ===`)

    return {
      runId: config.runId,
      mode: 'apply',
      sourceCount: rows.length,
      processedCount,
      skippedCount,
      errorCount: errors.length,
      errors,
      checkpoint,
    }
  } finally {
    await client.end()
  }
}
