import { execSync, spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

import { PAYLOAD_MIGRATION_NAMES } from '../../src/lib/payloadMigrationRegistry'
import {
  buildStagingMigrationStatus,
  createStagingReadOnlyAdapter,
  type ClassifiedPrismaMigration,
  type PgClientFactory,
  type StagingMigrationStatusReport,
} from './buildStagingMigrationStatus'

// ─── Constants ────────────────────────────────────────────────────────────────

const REQUIRED_BRANCH = 'feature/course-branding-and-preview'

// Exact reviewed staging target — all identity checks derive from this one constant.
// Hostname is the reviewed Supabase private NIC IP (10.0.2.4), documented in
// docs/INFRASTRUCTURE_NETWORKING.md. Hostnames are not credentials.
const STAGING_TARGET = {
  environment: 'staging',
  targetId: 'jpvbootcamp-staging',
  schema: 'jpvbootcamp_staging',
  database: 'jpvbootcamp',
  hostname: '10.0.2.4',
} as const

// Aliases kept for readability in the rest of the file.
const REQUIRED_SCHEMA = STAGING_TARGET.schema
const REQUIRED_DATABASE = STAGING_TARGET.database
const REQUIRED_ENVIRONMENT = STAGING_TARGET.environment
const REQUIRED_TARGET_ID = STAGING_TARGET.targetId
const EXPECTED_APPLIED_BEFORE = 33
const EXPECTED_FORWARD_BATCH = [
  '20260818_140000_member_profile_parity',
  '20260818_140100_portal_settings',
] as const
const EXPECTED_APPLIED_AFTER = EXPECTED_APPLIED_BEFORE + EXPECTED_FORWARD_BATCH.length
const TARGET_MIGRATIONS = PAYLOAD_MIGRATION_NAMES.slice(EXPECTED_APPLIED_BEFORE, EXPECTED_APPLIED_AFTER)
const APPLY_CONFIRMATION_VALUE = 'apply_member_profile_portal_settings_to_jpvbootcamp_staging'
const ROLLBACK_PLAN_CONFIRMATION_VALUE = 'plan_rollback_member_profile_portal_settings_from_jpvbootcamp_staging'
const FULL_COMMIT_SHA_RE = /^[0-9a-f]{40}$/

if (
  TARGET_MIGRATIONS.length !== EXPECTED_FORWARD_BATCH.length ||
  TARGET_MIGRATIONS.some((name, index) => name !== EXPECTED_FORWARD_BATCH[index])
) {
  throw new Error(`Canonical migration registry does not contain the reviewed migrations 34-35 at the expected position`)
}

// Production token labels rejected as whole tokens (exact match against hostname labels or db name components).
const PRODUCTION_HOST_TOKEN_MARKERS = ['prod', 'production', 'live', 'main']
const PRODUCTION_DB_TOKEN_MARKERS = ['prod', 'production', 'live', 'main']

// Guarded paths — any uncommitted change in these blocks plan and apply.
const GUARDED_PATHS = [
  'scripts/release/runStagingPayloadMigration.ts',
  'scripts/release/runStagingPayloadMigration.test.ts',
  'package.json',
  'src/migrations',
  'src/lib/auth/memberAccountActionReservationMigrationSql.ts',
  'src/lib/payloadMigrationRegistry.ts',
  'src/migrations/index.ts',
  'src/lib/previewMigrationInventory.ts',
  'src/payload.config.ts',
  'docs/PREVIEW_RELEASE_READINESS.md',
]

const repoRoot = resolve(__dirname, '../../')

// ─── Types ────────────────────────────────────────────────────────────────────

export type MigrationAuthorizationPacket = {
  operatorId: string
  backupEvidenceId: string
  maintenanceWindowId: string
  rollbackOwner: string
  expectedCommit: string
  environment: string
  targetId: string
  expectedSchema: string
  expectedHostname: string
  expectedDatabase: string
  expectedMigrations: string[]
  confirmation: string
}

export type RollbackPlanAuthorizationPacket = {
  operatorId: string
  backupEvidenceId: string
  maintenanceWindowId: string
  rollbackOwner: string
  expectedCommit: string
  environment: string
  targetId: string
  expectedSchema: string
  expectedHostname: string
  expectedDatabase: string
  confirmation: string
}

export type SafeMigrationPlanEvidence = {
  version: 2
  resultCode: 'plan_ok' | 'plan_blocked'
  blockerCodes: string[]
  branch: string
  commit: string
  schema: string
  environment: string
  targetId: string
  appliedPayloadCount: number
  expectedPendingMigrations: string[]
  expectedPendingBatchIsOnlyMissing: boolean
  unexpectedPayloadCount: number
  duplicatePayloadCount: number
  malformedPayloadCount: number
  prismaHealthy: boolean
  unhealthyPrismaMigrations?: string[]
}

export const ALLOWED_BLOCKER_CODES = new Set([
  'expected_commit_required',
  'branch_guard_failed',
  'commit_guard_failed',
  'database_url_missing',
  'database_url_invalid',
  'environment_guard_failed',
  'target_identity_guard_failed',
  'production_marker_rejected',
  'hostname_mismatch',
  'worktree_integrity_failed',
  'status_query_failed',
  'malformed_payload_evidence',
  'schema_identity_mismatch',
  'applied_count_mismatch',
  'pending_migration_mismatch',
  'unexpected_payload_migrations',
  'duplicate_payload_migrations',
  'missing_prisma_migrations',
  'unexpected_prisma_migrations',
  'duplicate_prisma_migrations',
  'unhealthy_prisma_migrations',
  'prisma_evidence_empty',
  'plan_blocked_unknown',
])

export function blockerToCode(message: string): string {
  if (message.includes('--expected-commit') || message.includes('expectedCommit') ||
      message.includes('40 lowercase hexadecimal') || message.startsWith('Expected commit')) return 'expected_commit_required'
  if (message.startsWith('Branch guard')) return 'branch_guard_failed'
  if (message.startsWith('Commit guard')) return 'commit_guard_failed'
  if (message === 'DATABASE_URL is not set; cannot collect live migration status') return 'database_url_missing'
  if (message.includes('cannot be parsed') || message.includes('Cannot parse database URL') ||
      message.includes('must use the PostgreSQL protocol') || message.includes('missing a hostname') ||
      message.includes('missing a database')) return 'database_url_invalid'
  if (message.includes('production marker')) return 'production_marker_rejected'
  if (message.includes('configured hostname does not match')) return 'hostname_mismatch'
  if (message.startsWith('Environment guard')) return 'environment_guard_failed'
  if (message.startsWith('Target identity guard') || message.startsWith('Schema guard')) return 'target_identity_guard_failed'
  if (message.startsWith('Worktree integrity guard')) return 'worktree_integrity_failed'
  if (message === 'read-only-status-query-failed') return 'status_query_failed'
  if (message.includes('Malformed Payload migration')) return 'malformed_payload_evidence'
  if (message.includes('Schema identity mismatch') || message.includes('schema identity mismatch')) return 'schema_identity_mismatch'
  if (message.includes('applied Payload migrations before apply') || message.includes('applied Payload migrations, found')) return 'applied_count_mismatch'
  if (message.includes('Expected pending Payload migration batch') || message.includes('missing Payload migration')) return 'pending_migration_mismatch'
  if (message.includes('Unexpected Payload migration')) return 'unexpected_payload_migrations'
  if (message.includes('Duplicate Payload migration')) return 'duplicate_payload_migrations'
  if (message.includes('Missing Prisma')) return 'missing_prisma_migrations'
  if (message.includes('Unexpected Prisma')) return 'unexpected_prisma_migrations'
  if (message.includes('Duplicate Prisma')) return 'duplicate_prisma_migrations'
  if (message.includes("not in 'applied' state")) return 'unhealthy_prisma_migrations'
  if (message.includes('Prisma migration evidence is empty')) return 'prisma_evidence_empty'
  return 'plan_blocked_unknown'
}

export type StagingMigrationPlanResult = {
  ok: boolean
  mode: 'plan'
  branch: string
  commit: string
  schema: string
  environment: string
  targetId: string
  appliedCount: number
  pendingMigrations: string[]
  blockers: string[]
  message: string
  unexpectedPayloadCount: number
  duplicatePayloadCount: number
  malformedPayloadCount: number
  prismaHealthy: boolean
  unhealthyPrismaMigrations?: string[]
}

export type StagingMigrationApplyResult = {
  ok: true
  mode: 'apply'
  branch: string
  commit: string
  schema: string
  environment: string
  targetId: string
  authorization: Omit<MigrationAuthorizationPacket, 'confirmation'>
  preApply: { appliedCount: number; missingMigrations: string[] }
  postApply: { appliedCount: number; missingMigrations: string[] }
  message: string
}

export const APPLY_OUTCOME_UNCERTAIN = 'APPLY_OUTCOME_UNCERTAIN' as const

export type StagingMigrationUncertainOutcome = {
  ok: false
  mode: 'apply'
  outcome: typeof APPLY_OUTCOME_UNCERTAIN
  schema: string
  appliedCount: number | null
  missingMigrations: string[] | null
  unexpectedMigrations: string[] | null
  targetBatchApplied: boolean | null
  schemaIdentityConfirmed: boolean | null
  prismaHealthy: boolean | null
  statusQuerySucceeded: boolean
  message: string
}

export type StagingMigrationRollbackPlanResult = {
  ok: boolean
  mode: 'rollback-plan'
  branch: string
  commit: string
  schema: string
  environment: string
  targetId: string
  appliedCount: number
  latestBatchMigrations: string[]
  blockers: string[]
  message: string
}

export type GitStatusEntry = {
  status: string
  path: string
}

export type StagingMigrationRunnerDependencies = {
  clientFactory?: PgClientFactory
  commandExecutor?: (args: string[]) => { status: number | null; error?: Error }
  gitResolver?: {
    branch: () => string
    commit: () => string
  }
  gitStatusResolver?: () => GitStatusEntry[]
}

// ─── Git helpers ──────────────────────────────────────────────────────────────

function resolveGit(
  dependencies: StagingMigrationRunnerDependencies,
): { branch: () => string; commit: () => string } {
  if (dependencies.gitResolver) return dependencies.gitResolver
  return {
    branch: () =>
      execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: repoRoot,
        encoding: 'utf8',
      }).trim(),
    commit: () =>
      execSync('git rev-parse HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim(),
  }
}

export function parseNulGitStatus(raw: string): GitStatusEntry[] {
  const entries: GitStatusEntry[] = []
  if (!raw) return entries
  // NUL-delimited: each record is XY<SP>path<NUL>, rename/copy adds src<NUL> after dest.
  const records = raw.split('\0')
  let i = 0
  while (i < records.length) {
    const record = records[i]
    i += 1
    if (!record) continue
    if (record.length < 3) {
      // Fail closed on malformed output — treat as guard blocker
      throw new Error(`Malformed git status record: ${JSON.stringify(record)}`)
    }
    const xy = record.slice(0, 2)
    if (record[2] !== ' ') {
      throw new Error(`Malformed git status record: ${JSON.stringify(record)}`)
    }
    const path = record.slice(3)
    const x = xy[0]
    const y = xy[1]
    // Rename (R) or copy (C) in either index or worktree: next NUL record is the original path
    if (x === 'R' || x === 'C' || y === 'R' || y === 'C') {
      const origPath = records[i] ?? ''
      i += 1
      // Guard both destination and source paths
      entries.push({ status: xy.trim(), path })
      if (origPath) entries.push({ status: xy.trim(), path: origPath })
    } else {
      entries.push({ status: xy.trim(), path })
    }
  }
  return entries
}

function resolveGitStatus(
  dependencies: StagingMigrationRunnerDependencies,
): () => GitStatusEntry[] {
  if (dependencies.gitStatusResolver) return dependencies.gitStatusResolver
  return () => {
    const raw = execSync('git status --porcelain=v1 -z --untracked-files=all', {
      cwd: repoRoot,
      encoding: 'utf8',
    })
    return parseNulGitStatus(raw)
  }
}

// ─── Command executor ─────────────────────────────────────────────────────────

export const PAYLOAD_MIGRATE_ARGS = ['./node_modules/.bin/payload', 'migrate']

function resolveCommandExecutor(
  dependencies: StagingMigrationRunnerDependencies,
): (args: string[]) => { status: number | null; error?: Error } {
  if (dependencies.commandExecutor) return dependencies.commandExecutor
  return (args: string[]) => {
    const [executable, ...rest] = args
    const result = spawnSync(executable, rest, {
      shell: false,
      env: process.env,
      stdio: 'inherit',
      cwd: repoRoot,
    })
    return { status: result.status, error: result.error }
  }
}

// ─── Validation helpers ───────────────────────────────────────────────────────

function validateFullCommitSha(value: string, label: string): string {
  const trimmed = value.trim().toLowerCase()
  if (!FULL_COMMIT_SHA_RE.test(trimmed)) {
    throw new Error(
      `${label} must be exactly 40 lowercase hexadecimal characters, got '${trimmed.slice(0, 12)}...'`,
    )
  }
  return trimmed
}

function guardBranchAndCommit(
  git: { branch: () => string; commit: () => string },
  expectedCommit: string,
): { branch: string; commit: string } {
  const branch = git.branch()
  const commit = git.commit()
  if (branch !== REQUIRED_BRANCH) {
    throw new Error(`Branch guard: expected '${REQUIRED_BRANCH}', got '${branch}'`)
  }
  const normalized = validateFullCommitSha(expectedCommit, 'Expected commit')
  if (commit !== normalized) {
    throw new Error(
      `Commit guard: HEAD is '${commit}', but --expected-commit='${normalized}'`,
    )
  }
  return { branch, commit }
}

function hostnameTokens(hostname: string): string[] {
  return hostname.toLowerCase().split(/[\s.:\-_/]+/).filter(Boolean)
}

function databaseNameTokens(dbName: string): string[] {
  return dbName.toLowerCase().split(/[\s.\-_/]+/).filter(Boolean)
}

function guardEnvironmentAndTarget(
  environment: string,
  targetId: string,
  expectedSchema: string,
  expectedHostname: string,
  expectedDatabase: string,
  actualHostname: string,
  actualDatabase: string,
): void {
  if (environment !== STAGING_TARGET.environment) {
    throw new Error(
      `Environment guard: must be '${STAGING_TARGET.environment}', got '${environment}'`,
    )
  }
  if (!targetId?.trim()) {
    throw new Error('Target identity guard: --target-id is required')
  }
  if (targetId !== STAGING_TARGET.targetId) {
    throw new Error(
      `Target identity guard: expected '${STAGING_TARGET.targetId}', got '${targetId}'`,
    )
  }
  if (!expectedSchema?.trim() || expectedSchema !== STAGING_TARGET.schema) {
    throw new Error(
      `Schema guard: expected '${STAGING_TARGET.schema}', got '${expectedSchema}'`,
    )
  }
  if (!expectedHostname?.trim()) {
    throw new Error('Target identity guard: --expected-hostname is required')
  }
  if (!expectedDatabase?.trim()) {
    throw new Error('Target identity guard: --expected-database is required')
  }

  // Tokenized hostname production-marker check (Defect 3)
  const hostTokens = hostnameTokens(actualHostname)
  for (const marker of PRODUCTION_HOST_TOKEN_MARKERS) {
    if (hostTokens.includes(marker)) {
      throw new Error(
        `Target identity guard: hostname contains production marker '${marker}'`,
      )
    }
  }

  // Tokenized database name production-marker check (Defect 3)
  const dbTokens = databaseNameTokens(actualDatabase)
  for (const marker of PRODUCTION_DB_TOKEN_MARKERS) {
    if (dbTokens.includes(marker)) {
      throw new Error(
        `Target identity guard: database name contains production marker '${marker}'`,
      )
    }
  }

  // Exact database enforcement — all three conditions required (Defect 2)
  if (expectedDatabase !== STAGING_TARGET.database) {
    throw new Error(
      `Target identity guard: --expected-database must be exactly '${STAGING_TARGET.database}', got '${expectedDatabase}'`,
    )
  }
  if (actualDatabase !== STAGING_TARGET.database) {
    throw new Error(
      `Target identity guard: configured database must be exactly '${STAGING_TARGET.database}', got '${actualDatabase}'`,
    )
  }
  if (actualDatabase !== expectedDatabase) {
    throw new Error(
      `Target identity guard: configured database does not match expected database`,
    )
  }

  // Require actual hostname to match the reviewed repository value (root of trust).
  // The operator-supplied --expected-hostname may serve as an additional cross-check,
  // but the repository constant is the independent identity anchor.
  if (actualHostname !== STAGING_TARGET.hostname) {
    throw new Error(
      `Target identity guard: configured hostname does not match reviewed staging hostname`,
    )
  }
  if (actualHostname !== expectedHostname) {
    throw new Error(
      `Target identity guard: configured hostname does not match expected hostname`,
    )
  }
}

function extractHostnameAndDatabase(databaseUrl: string): {
  hostname: string
  database: string
  protocol: string
} {
  let parsed: URL
  try {
    parsed = new URL(databaseUrl)
  } catch {
    throw new Error('Database URL cannot be parsed; connection material not logged')
  }
  const protocol = parsed.protocol
  if (protocol !== 'postgres:' && protocol !== 'postgresql:') {
    throw new Error('Database URL must use the PostgreSQL protocol')
  }
  const hostname = parsed.hostname
  const database = parsed.pathname.replace(/^\//, '').split('?')[0]
  if (!hostname) throw new Error('Database URL is missing a hostname')
  if (!database) throw new Error('Database URL is missing a database name')
  return { hostname, database, protocol }
}

function guardGuardedPaths(getStatus: () => GitStatusEntry[]): void {
  const entries = getStatus()
  const dirty: string[] = []
  for (const { status, path } of entries) {
    for (const guarded of GUARDED_PATHS) {
      if (path === guarded || path.startsWith(guarded + '/') || path.startsWith(guarded)) {
        dirty.push(`${status} ${path}`)
        break
      }
    }
  }
  if (dirty.length > 0) {
    throw new Error(
      `Worktree integrity guard: guarded paths have uncommitted changes:\n  ${dirty.join('\n  ')}`,
    )
  }
}

// ─── Migration status analysis ────────────────────────────────────────────────

export type FullMigrationStatus = {
  appliedPayloadCount: number
  missingPayloadMigrations: string[]
  unexpectedPayloadMigrations: string[]
  duplicatePayloadMigrations: string[]
  malformedPayloadMigrationCount: number
  schemaIdentity: string | null
  prismaMigrations: ClassifiedPrismaMigration[]
  missingPrismaMigrations: string[]
  unexpectedPrismaMigrations: string[]
  duplicatePrismaMigrations: string[]
  unhealthyPrismaMigrations: string[]
  allPrismaApplied: boolean
  report: StagingMigrationStatusReport
}

async function collectFullMigrationStatus(
  databaseUrl: string,
  schemaOverride: string | undefined,
  dependencies: StagingMigrationRunnerDependencies,
): Promise<FullMigrationStatus> {
  const adapter = createStagingReadOnlyAdapter({
    databaseUrl,
    expectedSchema: REQUIRED_SCHEMA,
    schemaOverride,
    clientFactory: dependencies.clientFactory,
  })
  const report = await buildStagingMigrationStatus(adapter, REQUIRED_SCHEMA)

  const payloadNames = report.appliedPayloadMigrations
  const payloadNameSet = new Set<string>()
  const duplicatePayloadMigrations: string[] = []
  for (const name of payloadNames) {
    if (payloadNameSet.has(name)) {
      duplicatePayloadMigrations.push(name)
    }
    payloadNameSet.add(name)
  }

  const prismaNames = report.prismaMigrations.map((r) => r.migrationName)
  const prismaNamesSet = new Set<string>()
  const duplicatePrismaMigrations: string[] = []
  for (const name of prismaNames) {
    if (prismaNamesSet.has(name)) {
      duplicatePrismaMigrations.push(name)
    }
    prismaNamesSet.add(name)
  }

  const unhealthyPrismaMigrations = report.prismaMigrations
    .filter((r) => r.status !== 'applied')
    .map((r) => `${r.migrationName}:${r.status}`)

  const allPrismaApplied =
    report.prismaMigrations.length > 0 &&
    unhealthyPrismaMigrations.length === 0

  return {
    appliedPayloadCount: report.appliedPayloadMigrations.length,
    missingPayloadMigrations: report.missingPayloadMigrations,
    unexpectedPayloadMigrations: report.unexpectedPayloadMigrations,
    duplicatePayloadMigrations,
    malformedPayloadMigrationCount: report.malformedPayloadMigrationRecords.length,
    schemaIdentity: report.schemaIdentity,
    prismaMigrations: report.prismaMigrations,
    missingPrismaMigrations: report.missingPrismaMigrations,
    unexpectedPrismaMigrations: report.unexpectedPrismaMigrations,
    duplicatePrismaMigrations,
    unhealthyPrismaMigrations,
    allPrismaApplied,
    report,
  }
}

function checkPreApplyPreconditions(status: FullMigrationStatus): string[] {
  const blockers: string[] = []

  if (status.malformedPayloadMigrationCount > 0) {
    blockers.push('Malformed Payload migration evidence exists')
  }
  if (status.schemaIdentity !== REQUIRED_SCHEMA) {
    blockers.push(
      `Schema identity mismatch: expected '${REQUIRED_SCHEMA}', got '${status.schemaIdentity ?? 'null'}'`,
    )
  }
  if (status.appliedPayloadCount !== EXPECTED_APPLIED_BEFORE) {
    blockers.push(
      `Expected ${EXPECTED_APPLIED_BEFORE} applied Payload migrations before apply, found ${status.appliedPayloadCount}`,
    )
  }
  if (
    status.missingPayloadMigrations.length !== TARGET_MIGRATIONS.length ||
    status.missingPayloadMigrations.some((name, index) => name !== TARGET_MIGRATIONS[index])
  ) {
    blockers.push(
      `Expected pending Payload migration batch [${TARGET_MIGRATIONS.join(', ')}], found: [${status.missingPayloadMigrations.join(', ')}]`,
    )
  }
  if (status.unexpectedPayloadMigrations.length > 0) {
    blockers.push(
      `Unexpected Payload migration records exist: [${status.unexpectedPayloadMigrations.join(', ')}]`,
    )
  }
  if (status.duplicatePayloadMigrations.length > 0) {
    blockers.push(
      `Duplicate Payload migration records exist: [${status.duplicatePayloadMigrations.join(', ')}]`,
    )
  }
  if (status.missingPrismaMigrations.length > 0) {
    blockers.push(
      `Missing Prisma migrations: [${status.missingPrismaMigrations.join(', ')}]`,
    )
  }
  if (status.unexpectedPrismaMigrations.length > 0) {
    blockers.push(
      `Unexpected Prisma migration records: [${status.unexpectedPrismaMigrations.join(', ')}]`,
    )
  }
  if (status.duplicatePrismaMigrations.length > 0) {
    blockers.push(
      `Duplicate Prisma migration records: [${status.duplicatePrismaMigrations.join(', ')}]`,
    )
  }
  if (status.unhealthyPrismaMigrations.length > 0) {
    blockers.push(
      `Prisma migrations not in 'applied' state: [${status.unhealthyPrismaMigrations.join(', ')}]`,
    )
  }
  if (!status.allPrismaApplied && status.prismaMigrations.length === 0) {
    blockers.push('Prisma migration evidence is empty')
  }
  return blockers
}

function checkPostApplyPreconditions(status: FullMigrationStatus): string[] {
  const blockers: string[] = []

  if (status.malformedPayloadMigrationCount > 0) {
    blockers.push('Malformed Payload migration evidence exists')
  }
  if (status.schemaIdentity !== REQUIRED_SCHEMA) {
    blockers.push(
      `Post-apply schema identity mismatch: expected '${REQUIRED_SCHEMA}', got '${status.schemaIdentity ?? 'null'}'`,
    )
  }
  if (status.appliedPayloadCount !== EXPECTED_APPLIED_AFTER) {
    blockers.push(
      `Post-apply: expected ${EXPECTED_APPLIED_AFTER} applied Payload migrations, found ${status.appliedPayloadCount}`,
    )
  }
  if (status.missingPayloadMigrations.length > 0) {
    blockers.push(
      `Post-apply: missing Payload migrations: [${status.missingPayloadMigrations.join(', ')}]`,
    )
  }
  if (status.unexpectedPayloadMigrations.length > 0) {
    blockers.push(
      `Post-apply: unexpected Payload migration records: [${status.unexpectedPayloadMigrations.join(', ')}]`,
    )
  }
  if (status.duplicatePayloadMigrations.length > 0) {
    blockers.push(
      `Post-apply: duplicate Payload migration records: [${status.duplicatePayloadMigrations.join(', ')}]`,
    )
  }
  if (status.missingPrismaMigrations.length > 0) {
    blockers.push(
      `Post-apply: missing Prisma migrations: [${status.missingPrismaMigrations.join(', ')}]`,
    )
  }
  if (status.unexpectedPrismaMigrations.length > 0) {
    blockers.push(
      `Post-apply: unexpected Prisma migration records: [${status.unexpectedPrismaMigrations.join(', ')}]`,
    )
  }
  if (status.duplicatePrismaMigrations.length > 0) {
    blockers.push(
      `Post-apply: duplicate Prisma migration records: [${status.duplicatePrismaMigrations.join(', ')}]`,
    )
  }
  if (status.unhealthyPrismaMigrations.length > 0) {
    blockers.push(
      `Post-apply: Prisma migrations not in 'applied' state: [${status.unhealthyPrismaMigrations.join(', ')}]`,
    )
  }
  return blockers
}

// ─── Plan mode ────────────────────────────────────────────────────────────────

export type StagingMigrationPlanInput = {
  expectedCommit: string | undefined
  environment: string | undefined
  targetId: string | undefined
  expectedSchema: string | undefined
  expectedHostname: string | undefined
  expectedDatabase: string | undefined
}

export async function runStagingMigrationPlan(
  databaseUrl: string | undefined,
  schemaOverride: string | undefined,
  input: StagingMigrationPlanInput,
  dependencies: StagingMigrationRunnerDependencies = {},
  output: (line: string) => void = console.log,
): Promise<StagingMigrationPlanResult> {
  const git = resolveGit(dependencies)
  let branch = 'unknown'
  let commit = 'unknown'

  function blockedResult(
    blockerMessages: string[],
    appliedCount = 0,
    pendingMigrations: string[] = [],
    unexpectedPayloadCount = 0,
    duplicatePayloadCount = 0,
    malformedPayloadCount = 0,
    prismaHealthy = false,
    unhealthyPrismaMigrations?: string[],
  ): StagingMigrationPlanResult {
    const result: StagingMigrationPlanResult = {
      ok: false,
      mode: 'plan',
      branch,
      commit,
      schema: REQUIRED_SCHEMA,
      environment: input.environment ?? '',
      targetId: input.targetId ?? '',
      appliedCount,
      pendingMigrations,
      blockers: blockerMessages,
      message: `plan_blocked`,
      unexpectedPayloadCount,
      duplicatePayloadCount,
      malformedPayloadCount,
      prismaHealthy,
    }
    if (unhealthyPrismaMigrations && unhealthyPrismaMigrations.length > 0) {
      result.unhealthyPrismaMigrations = unhealthyPrismaMigrations
    }
    return result
  }

  if (!input.expectedCommit?.trim()) {
    output(`[staging-migration-plan] BLOCKED: expected_commit_required`)
    return blockedResult(['expected_commit_required'])
  }

  try {
    ;({ branch, commit } = guardBranchAndCommit(git, input.expectedCommit))
  } catch (error: unknown) {
    const raw = error instanceof Error ? error.message : 'Branch/commit guard failed'
    const code = blockerToCode(raw)
    output(`[staging-migration-plan] BLOCKED: ${code}`)
    return blockedResult([code])
  }

  // Environment and target identity guards
  if (!databaseUrl) {
    output(`[staging-migration-plan] BLOCKED: database_url_missing`)
    return blockedResult(['database_url_missing'])
  }

  let actualHostname: string
  let actualDatabase: string
  try {
    const parsed = extractHostnameAndDatabase(databaseUrl)
    actualHostname = parsed.hostname
    actualDatabase = parsed.database
  } catch (error: unknown) {
    const raw = error instanceof Error ? error.message : 'Cannot parse database URL'
    const code = blockerToCode(raw)
    output(`[staging-migration-plan] BLOCKED: ${code}`)
    return blockedResult([code])
  }

  try {
    guardEnvironmentAndTarget(
      input.environment ?? '',
      input.targetId ?? '',
      input.expectedSchema ?? '',
      input.expectedHostname ?? '',
      input.expectedDatabase ?? '',
      actualHostname,
      actualDatabase,
    )
  } catch (error: unknown) {
    const raw = error instanceof Error ? error.message : 'Environment/target guard failed'
    const code = blockerToCode(raw)
    output(`[staging-migration-plan] BLOCKED: ${code}`)
    return blockedResult([code])
  }

  // Worktree integrity guard
  try {
    guardGuardedPaths(resolveGitStatus(dependencies))
  } catch (error: unknown) {
    const raw = error instanceof Error ? error.message : 'Worktree integrity check failed'
    const code = blockerToCode(raw)
    output(`[staging-migration-plan] BLOCKED: ${code}`)
    return blockedResult([code])
  }

  output(`[staging-migration-plan] branch=${branch}`)
  output(`[staging-migration-plan] commit=${commit}`)
  output(`[staging-migration-plan] environment=${input.environment}`)
  output(`[staging-migration-plan] target-id=${input.targetId}`)
  output(`[staging-migration-plan] schema=${REQUIRED_SCHEMA}`)
  output(`[staging-migration-plan] mode=plan (read-only, no database mutations)`)

  let status: FullMigrationStatus
  try {
    status = await collectFullMigrationStatus(databaseUrl, schemaOverride, dependencies)
  } catch {
    output(`[staging-migration-plan] BLOCKED: status_query_failed`)
    return blockedResult(['status_query_failed'])
  }

  const rawBlockers = checkPreApplyPreconditions(status)
  const blockerCodes = rawBlockers.map(blockerToCode)

  output(`[staging-migration-plan] applied-payload=${status.appliedPayloadCount}`)
  output(`[staging-migration-plan] missing-payload-count=${status.missingPayloadMigrations.length}`)
  output(`[staging-migration-plan] unexpected-payload-count=${status.unexpectedPayloadMigrations.length}`)
  output(`[staging-migration-plan] prisma-healthy=${status.allPrismaApplied}`)

  const unexpectedPayloadCount = status.unexpectedPayloadMigrations.length
  const duplicatePayloadCount = status.duplicatePayloadMigrations.length
  const malformedPayloadCount = status.malformedPayloadMigrationCount

  if (blockerCodes.length > 0) {
    for (const code of blockerCodes) {
      output(`[staging-migration-plan] BLOCKER: ${code}`)
    }
    return blockedResult(
      blockerCodes,
      status.appliedPayloadCount,
      [],
      unexpectedPayloadCount,
      duplicatePayloadCount,
      malformedPayloadCount,
      status.allPrismaApplied,
      status.unhealthyPrismaMigrations && status.unhealthyPrismaMigrations.length > 0
        ? status.unhealthyPrismaMigrations
        : undefined,
    )
  }

  output(
    `[staging-migration-plan] PLAN OK: Migrations 34-35 batch is pending in canonical order and all preconditions are met`,
  )
  output(`[staging-migration-plan] pending-batch=${TARGET_MIGRATIONS.join(',')}`)
  output(`[staging-migration-plan] To apply: pnpm staging:payload-migration-apply`)
  return {
    ok: true,
    mode: 'plan',
    branch,
    commit,
    schema: REQUIRED_SCHEMA,
    environment: input.environment ?? '',
    targetId: input.targetId ?? '',
    appliedCount: status.appliedPayloadCount,
    pendingMigrations: [...TARGET_MIGRATIONS],
    blockers: [],
    message: `plan_ok`,
    unexpectedPayloadCount,
    duplicatePayloadCount,
    malformedPayloadCount,
    prismaHealthy: status.allPrismaApplied,
  }
}

// ─── Apply mode ───────────────────────────────────────────────────────────────

export async function runStagingMigrationApply(
  databaseUrl: string | undefined,
  schemaOverride: string | undefined,
  authorization: MigrationAuthorizationPacket,
  dependencies: StagingMigrationRunnerDependencies = {},
  output: (line: string) => void = console.log,
): Promise<StagingMigrationApplyResult | StagingMigrationUncertainOutcome> {
  if (!authorization.expectedCommit?.trim()) {
    throw new Error('Authorization packet: expectedCommit is required')
  }
  if (!authorization.operatorId?.trim()) {
    throw new Error('Authorization packet: operatorId is required')
  }
  if (!authorization.backupEvidenceId?.trim()) {
    throw new Error('Authorization packet: backupEvidenceId is required')
  }
  if (!authorization.maintenanceWindowId?.trim()) {
    throw new Error('Authorization packet: maintenanceWindowId is required')
  }
  if (!authorization.rollbackOwner?.trim()) {
    throw new Error('Authorization packet: rollbackOwner is required')
  }
  if (
    authorization.expectedMigrations.length !== TARGET_MIGRATIONS.length ||
    authorization.expectedMigrations.some((name, index) => name !== TARGET_MIGRATIONS[index])
  ) {
    throw new Error(
      `Authorization packet: expectedMigrations must exactly equal [${TARGET_MIGRATIONS.join(', ')}]`,
    )
  }
  if (authorization.confirmation !== APPLY_CONFIRMATION_VALUE) {
    throw new Error(
      `Authorization packet: confirmation must be exactly '${APPLY_CONFIRMATION_VALUE}'`,
    )
  }
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set; cannot apply migration')
  }

  const git = resolveGit(dependencies)
  const { branch, commit } = guardBranchAndCommit(git, authorization.expectedCommit)

  let actualHostname: string
  let actualDatabase: string
  try {
    const parsed = extractHostnameAndDatabase(databaseUrl)
    actualHostname = parsed.hostname
    actualDatabase = parsed.database
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Cannot parse database URL'
    throw new Error(message)
  }

  guardEnvironmentAndTarget(
    authorization.environment,
    authorization.targetId,
    authorization.expectedSchema,
    authorization.expectedHostname,
    authorization.expectedDatabase,
    actualHostname,
    actualDatabase,
  )

  guardGuardedPaths(resolveGitStatus(dependencies))

  output(`[staging-migration-apply] branch=${branch}`)
  output(`[staging-migration-apply] commit=${commit}`)
  output(`[staging-migration-apply] environment=${authorization.environment}`)
  output(`[staging-migration-apply] target-id=${authorization.targetId}`)
  output(`[staging-migration-apply] schema=${REQUIRED_SCHEMA}`)
  output(`[staging-migration-apply] operator=${authorization.operatorId}`)
  output(`[staging-migration-apply] maintenanceWindow=${authorization.maintenanceWindowId}`)
  output(`[staging-migration-apply] backupEvidence=${authorization.backupEvidenceId}`)
  output(`[staging-migration-apply] rollbackOwner=${authorization.rollbackOwner}`)
  output(`[staging-migration-apply] authorized-batch=${authorization.expectedMigrations.join(',')}`)

  output(`[staging-migration-apply] collecting pre-apply migration status...`)
  let preStatus: FullMigrationStatus
  try {
    preStatus = await collectFullMigrationStatus(databaseUrl, schemaOverride, dependencies)
  } catch {
    throw new Error('Pre-apply status check failed: pre-apply-status-query-failed')
  }

  const preBlockers = checkPreApplyPreconditions(preStatus)
  if (preBlockers.length > 0) {
    throw new Error(`Pre-apply check failed: ${preBlockers.join('; ')}`)
  }

  output(`[staging-migration-apply] pre-apply checks PASSED`)
  output(`[staging-migration-apply] applying migration batch: ${TARGET_MIGRATIONS.join(',')}`)
  output(`[staging-migration-apply] invoking: ${PAYLOAD_MIGRATE_ARGS.join(' ')}`)

  const executor = resolveCommandExecutor(dependencies)
  const execResult = executor(PAYLOAD_MIGRATE_ARGS)

  // Defect 6: uncertain apply outcome on any non-zero/error/signal result
  const commandIndeterminate =
    execResult.error !== undefined ||
    execResult.status === null ||
    execResult.status !== 0

  if (commandIndeterminate) {
    output(`[staging-migration-apply] UNCERTAIN: command did not complete cleanly — collecting read-only status`)
    let uncertainStatus: FullMigrationStatus | null = null
    let statusQuerySucceeded = false
    try {
      uncertainStatus = await collectFullMigrationStatus(databaseUrl, schemaOverride, dependencies)
      statusQuerySucceeded = true
    } catch {
      // Status query failed — cannot determine outcome
    }
    const targetBatchApplied = uncertainStatus
      ? checkPostApplyPreconditions(uncertainStatus).length === 0
      : null
    const safeStatus =
      execResult.status !== null && Number.isSafeInteger(execResult.status)
        ? execResult.status
        : null
    const reason = execResult.error
      ? 'migration_command_execution_error'
      : execResult.status === null
        ? 'migration_command_signal_or_indeterminate'
        : `migration_command_nonzero_exit:${safeStatus}`
    output(`[staging-migration-apply] ${APPLY_OUTCOME_UNCERTAIN}: ${reason}`)
    output(`[staging-migration-apply] Require a fresh read-only plan and separate operator decision before any rollback.`)
    return {
      ok: false,
      mode: 'apply',
      outcome: APPLY_OUTCOME_UNCERTAIN,
      schema: REQUIRED_SCHEMA,
      appliedCount: uncertainStatus?.appliedPayloadCount ?? null,
      missingMigrations: uncertainStatus?.missingPayloadMigrations ?? null,
      unexpectedMigrations: uncertainStatus?.unexpectedPayloadMigrations ?? null,
      targetBatchApplied,
      schemaIdentityConfirmed: uncertainStatus
        ? uncertainStatus.schemaIdentity === REQUIRED_SCHEMA
        : null,
      prismaHealthy: uncertainStatus ? uncertainStatus.allPrismaApplied : null,
      statusQuerySucceeded,
      message: `${APPLY_OUTCOME_UNCERTAIN}: ${reason}. Run pnpm staging:payload-migration-plan for a fresh read-only plan. Do not retry automatically. Do not execute migrate:down without separate authorization.`,
    }
  }

  output(`[staging-migration-apply] migration command completed`)
  output(`[staging-migration-apply] collecting post-apply migration status...`)

  let postStatus: FullMigrationStatus
  try {
    postStatus = await collectFullMigrationStatus(databaseUrl, schemaOverride, dependencies)
  } catch {
    throw new Error('Post-apply verification failed: post-apply-status-query-failed')
  }

  const postBlockers = checkPostApplyPreconditions(postStatus)
  if (postBlockers.length > 0) {
    throw new Error(`Post-apply verification failed: ${postBlockers.join('; ')}`)
  }

  output(`[staging-migration-apply] post-apply verification PASSED`)
  output(
    `[staging-migration-apply] all ${EXPECTED_APPLIED_AFTER} Payload migrations applied. ` +
      `Rollback requires separate authorization; run pnpm staging:payload-migration-rollback-plan first.`,
  )

  return {
    ok: true,
    mode: 'apply',
    branch,
    commit,
    schema: REQUIRED_SCHEMA,
    environment: authorization.environment,
    targetId: authorization.targetId,
    authorization: {
      operatorId: authorization.operatorId,
      backupEvidenceId: authorization.backupEvidenceId,
      maintenanceWindowId: authorization.maintenanceWindowId,
      rollbackOwner: authorization.rollbackOwner,
      expectedCommit: authorization.expectedCommit,
      environment: authorization.environment,
      targetId: authorization.targetId,
      expectedSchema: authorization.expectedSchema,
      expectedHostname: authorization.expectedHostname,
      expectedDatabase: authorization.expectedDatabase,
      expectedMigrations: [...authorization.expectedMigrations],
    },
    preApply: {
      appliedCount: preStatus.appliedPayloadCount,
      missingMigrations: preStatus.missingPayloadMigrations,
    },
    postApply: {
      appliedCount: postStatus.appliedPayloadCount,
      missingMigrations: postStatus.missingPayloadMigrations,
    },
    message: `Apply completed: Migrations 34-35 [${TARGET_MIGRATIONS.join(', ')}] applied to ${REQUIRED_SCHEMA}. Rollback requires separate plan and authorization.`,
  }
}

// ─── Rollback plan mode ───────────────────────────────────────────────────────

export async function runStagingMigrationRollbackPlan(
  databaseUrl: string | undefined,
  schemaOverride: string | undefined,
  authorization: RollbackPlanAuthorizationPacket,
  dependencies: StagingMigrationRunnerDependencies = {},
  output: (line: string) => void = console.log,
): Promise<StagingMigrationRollbackPlanResult> {
  if (!authorization.expectedCommit?.trim()) {
    throw new Error('Rollback plan: expectedCommit is required')
  }
  if (!authorization.operatorId?.trim()) {
    throw new Error('Rollback plan: operatorId is required')
  }
  if (!authorization.backupEvidenceId?.trim()) {
    throw new Error('Rollback plan: backupEvidenceId is required')
  }
  if (!authorization.maintenanceWindowId?.trim()) {
    throw new Error('Rollback plan: maintenanceWindowId is required')
  }
  if (!authorization.rollbackOwner?.trim()) {
    throw new Error('Rollback plan: rollbackOwner is required')
  }
  if (authorization.confirmation !== ROLLBACK_PLAN_CONFIRMATION_VALUE) {
    throw new Error(
      `Rollback plan: confirmation must be exactly '${ROLLBACK_PLAN_CONFIRMATION_VALUE}'`,
    )
  }
  if (!databaseUrl) {
    throw new Error('Rollback plan: DATABASE_URL is not set')
  }

  const git = resolveGit(dependencies)
  const { branch, commit } = guardBranchAndCommit(git, authorization.expectedCommit)

  let actualHostname: string
  let actualDatabase: string
  try {
    const parsed = extractHostnameAndDatabase(databaseUrl)
    actualHostname = parsed.hostname
    actualDatabase = parsed.database
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Cannot parse database URL'
    throw new Error(message)
  }

  guardEnvironmentAndTarget(
    authorization.environment,
    authorization.targetId,
    authorization.expectedSchema,
    authorization.expectedHostname,
    authorization.expectedDatabase,
    actualHostname,
    actualDatabase,
  )

  // Defect 4: worktree integrity guard before any DB access
  guardGuardedPaths(resolveGitStatus(dependencies))

  output(`[staging-migration-rollback-plan] branch=${branch}`)
  output(`[staging-migration-rollback-plan] commit=${commit}`)
  output(`[staging-migration-rollback-plan] environment=${authorization.environment}`)
  output(`[staging-migration-rollback-plan] target-id=${authorization.targetId}`)
  output(`[staging-migration-rollback-plan] schema=${REQUIRED_SCHEMA}`)
  output(`[staging-migration-rollback-plan] mode=read-only-rollback-plan (no database mutations)`)

  let status: FullMigrationStatus
  try {
    status = await collectFullMigrationStatus(databaseUrl, schemaOverride, dependencies)
  } catch {
    throw new Error('Rollback plan status check failed: rollback-plan-status-query-failed')
  }

  const blockers: string[] = []

  if (status.malformedPayloadMigrationCount > 0) {
    blockers.push('Malformed Payload migration evidence exists')
  }
  if (status.schemaIdentity !== REQUIRED_SCHEMA) {
    blockers.push(`Schema identity mismatch: expected '${REQUIRED_SCHEMA}', got '${status.schemaIdentity}'`)
  }
  if (status.appliedPayloadCount !== EXPECTED_APPLIED_AFTER) {
    blockers.push(
      `Rollback plan requires all ${EXPECTED_APPLIED_AFTER} Payload migrations applied; found ${status.appliedPayloadCount}`,
    )
  }
  if (status.missingPayloadMigrations.length > 0) {
    blockers.push(
      `Missing Payload migrations: [${status.missingPayloadMigrations.join(', ')}]`,
    )
  }
  if (status.unexpectedPayloadMigrations.length > 0) {
    blockers.push(
      `Unexpected Payload migration records: [${status.unexpectedPayloadMigrations.join(', ')}]`,
    )
  }
  if (status.duplicatePayloadMigrations.length > 0) {
    blockers.push(
      `Duplicate Payload migration records: [${status.duplicatePayloadMigrations.join(', ')}]`,
    )
  }
  if (status.unhealthyPrismaMigrations.length > 0) {
    blockers.push(
      `Unhealthy Prisma migrations: [${status.unhealthyPrismaMigrations.join(', ')}]`,
    )
  }
  if (status.missingPrismaMigrations.length > 0) {
    blockers.push(`Missing Prisma migrations: [${status.missingPrismaMigrations.join(', ')}]`)
  }
  if (status.unexpectedPrismaMigrations.length > 0) {
    blockers.push(`Unexpected Prisma migrations: [${status.unexpectedPrismaMigrations.join(', ')}]`)
  }

  // Defect 1: validate batch evidence from payloadMigrationRecords
  const records = status.report.payloadMigrationRecords

  // Validate every record has a non-empty name and a non-negative safe-integer batch
  const namesSeen = new Set<string>()
  let batchEvidenceMalformed = false
  for (const rec of records) {
    if (!rec.name || typeof rec.name !== 'string') {
      blockers.push('Payload migration record has an empty or invalid name')
      batchEvidenceMalformed = true
      break
    }
    if (!Number.isSafeInteger(rec.batch) || rec.batch < 0) {
      blockers.push(`Payload migration record '${rec.name}' has malformed batch: ${rec.batch}`)
      batchEvidenceMalformed = true
      break
    }
    if (namesSeen.has(rec.name)) {
      blockers.push(`Duplicate Payload migration record in batch evidence: '${rec.name}'`)
      batchEvidenceMalformed = true
      break
    }
    namesSeen.add(rec.name)
  }

  // Verify Forward D is the last applied migration.
  const lastApplied = status.report.appliedPayloadMigrations.at(-1)
  const expectedLastApplied = TARGET_MIGRATIONS.at(-1)
  if (lastApplied !== expectedLastApplied) {
    blockers.push(
      `Rollback plan requires ${expectedLastApplied} to be the last applied migration; got '${lastApplied ?? 'none'}'`,
    )
  }

  // Determine latest batch and require exactly the reviewed migrations 34-35 batch.
  const latestBatchRows: string[] = []
  if (!batchEvidenceMalformed) {
    const highestBatch = Math.max(...records.map((r) => r.batch))
    const highestBatchRecords = records.filter((r) => r.batch === highestBatch)
    const highestBatchNames = highestBatchRecords.map((r) => r.name)
    latestBatchRows.push(...highestBatchNames)
    if (
      highestBatchNames.length !== TARGET_MIGRATIONS.length ||
      highestBatchNames.some((name, index) => name !== TARGET_MIGRATIONS[index])
    ) {
      blockers.push(
        `Latest batch ${highestBatch} must exactly equal [${TARGET_MIGRATIONS.join(', ')}], got [${highestBatchNames.join(', ')}]`,
      )
    }
  }

  output(`[staging-migration-rollback-plan] applied-payload=${status.appliedPayloadCount}`)
  output(`[staging-migration-rollback-plan] last-applied=${lastApplied ?? 'none'}`)

  if (blockers.length > 0) {
    for (const blocker of blockers) {
      output(`[staging-migration-rollback-plan] BLOCKER: ${blocker}`)
    }
    const message = `Rollback plan blocked: ${blockers.join('; ')}`
    return {
      ok: false,
      mode: 'rollback-plan',
      branch,
      commit,
      schema: REQUIRED_SCHEMA,
      environment: authorization.environment,
      targetId: authorization.targetId,
      appliedCount: status.appliedPayloadCount,
      latestBatchMigrations: latestBatchRows,
      blockers,
      message,
    }
  }

  output(`[staging-migration-rollback-plan] ROLLBACK PLAN OK`)
  output(`[staging-migration-rollback-plan] Rollback execution requires separate authorization.`)
  output(`[staging-migration-rollback-plan] Do NOT execute migrate:down without separate approval.`)

  return {
    ok: true,
    mode: 'rollback-plan',
    branch,
    commit,
    schema: REQUIRED_SCHEMA,
    environment: authorization.environment,
    targetId: authorization.targetId,
    appliedCount: status.appliedPayloadCount,
    latestBatchMigrations: latestBatchRows,
    blockers: [],
    message:
      `Rollback plan OK: Migrations 34-35 [${TARGET_MIGRATIONS.join(', ')}] is the latest applied batch. ` +
      `Rollback execution requires separate authorization.`,
  }
}

// ─── CLI argument parsers ─────────────────────────────────────────────────────

export type PlanCliInput = StagingMigrationPlanInput

export function parsePlanCliArgs(args: string[]): PlanCliInput {
  const result: Partial<PlanCliInput> = {}
  for (const arg of args) {
    const eq = arg.indexOf('=')
    if (eq < 0) throw new Error(`Unexpected positional argument: ${arg}`)
    const key = arg.slice(0, eq)
    const value = arg.slice(eq + 1)
    if (!value) throw new Error(`Missing value for ${key}`)
    if (key === '--expected-commit') result.expectedCommit = value
    else if (key === '--environment') result.environment = value
    else if (key === '--target-id') result.targetId = value
    else if (key === '--expected-schema') result.expectedSchema = value
    else if (key === '--expected-hostname') result.expectedHostname = value
    else if (key === '--expected-database') result.expectedDatabase = value
    else throw new Error(`Unknown argument: ${key}`)
  }
  if (!result.expectedCommit) throw new Error('Missing required argument: --expected-commit')
  if (!result.environment) throw new Error('Missing required argument: --environment')
  if (!result.targetId) throw new Error('Missing required argument: --target-id')
  if (!result.expectedSchema) throw new Error('Missing required argument: --expected-schema')
  if (!result.expectedHostname) throw new Error('Missing required argument: --expected-hostname')
  if (!result.expectedDatabase) throw new Error('Missing required argument: --expected-database')
  return result as PlanCliInput
}

export function parseApplyCliArgs(args: string[]): MigrationAuthorizationPacket {
  const result: Partial<MigrationAuthorizationPacket> = {}
  for (const arg of args) {
    const eq = arg.indexOf('=')
    if (eq < 0) throw new Error(`Unexpected positional argument: ${arg}`)
    const key = arg.slice(0, eq)
    const value = arg.slice(eq + 1)
    if (!value) throw new Error(`Missing value for ${key}`)
    if (key === '--operator-id') result.operatorId = value
    else if (key === '--backup-evidence-id') result.backupEvidenceId = value
    else if (key === '--maintenance-window-id') result.maintenanceWindowId = value
    else if (key === '--rollback-owner') result.rollbackOwner = value
    else if (key === '--expected-commit') result.expectedCommit = value
    else if (key === '--environment') result.environment = value
    else if (key === '--target-id') result.targetId = value
    else if (key === '--expected-schema') result.expectedSchema = value
    else if (key === '--expected-hostname') result.expectedHostname = value
    else if (key === '--expected-database') result.expectedDatabase = value
    else if (key === '--expected-migrations') result.expectedMigrations = value.split(',').map((item) => item.trim()).filter(Boolean)
    else if (key === '--confirmation') result.confirmation = value
    else throw new Error(`Unknown argument: ${key}`)
  }
  if (!result.operatorId) throw new Error('Missing required argument: --operator-id')
  if (!result.backupEvidenceId) throw new Error('Missing required argument: --backup-evidence-id')
  if (!result.maintenanceWindowId) throw new Error('Missing required argument: --maintenance-window-id')
  if (!result.rollbackOwner) throw new Error('Missing required argument: --rollback-owner')
  if (!result.expectedCommit) throw new Error('Missing required argument: --expected-commit')
  if (!result.environment) throw new Error('Missing required argument: --environment')
  if (!result.targetId) throw new Error('Missing required argument: --target-id')
  if (!result.expectedSchema) throw new Error('Missing required argument: --expected-schema')
  if (!result.expectedHostname) throw new Error('Missing required argument: --expected-hostname')
  if (!result.expectedDatabase) throw new Error('Missing required argument: --expected-database')
  if (!result.expectedMigrations || result.expectedMigrations.length === 0) throw new Error('Missing required argument: --expected-migrations')
  if (!result.confirmation) throw new Error('Missing required argument: --confirmation')
  return result as MigrationAuthorizationPacket
}

export function parseRollbackPlanCliArgs(args: string[]): RollbackPlanAuthorizationPacket {
  const result: Partial<RollbackPlanAuthorizationPacket> = {}
  for (const arg of args) {
    const eq = arg.indexOf('=')
    if (eq < 0) throw new Error(`Unexpected positional argument: ${arg}`)
    const key = arg.slice(0, eq)
    const value = arg.slice(eq + 1)
    if (!value) throw new Error(`Missing value for ${key}`)
    if (key === '--operator-id') result.operatorId = value
    else if (key === '--backup-evidence-id') result.backupEvidenceId = value
    else if (key === '--maintenance-window-id') result.maintenanceWindowId = value
    else if (key === '--rollback-owner') result.rollbackOwner = value
    else if (key === '--expected-commit') result.expectedCommit = value
    else if (key === '--environment') result.environment = value
    else if (key === '--target-id') result.targetId = value
    else if (key === '--expected-schema') result.expectedSchema = value
    else if (key === '--expected-hostname') result.expectedHostname = value
    else if (key === '--expected-database') result.expectedDatabase = value
    else if (key === '--confirmation') result.confirmation = value
    else throw new Error(`Unknown argument: ${key}`)
  }
  if (!result.operatorId) throw new Error('Missing required argument: --operator-id')
  if (!result.backupEvidenceId) throw new Error('Missing required argument: --backup-evidence-id')
  if (!result.maintenanceWindowId) throw new Error('Missing required argument: --maintenance-window-id')
  if (!result.rollbackOwner) throw new Error('Missing required argument: --rollback-owner')
  if (!result.expectedCommit) throw new Error('Missing required argument: --expected-commit')
  if (!result.environment) throw new Error('Missing required argument: --environment')
  if (!result.targetId) throw new Error('Missing required argument: --target-id')
  if (!result.expectedSchema) throw new Error('Missing required argument: --expected-schema')
  if (!result.expectedHostname) throw new Error('Missing required argument: --expected-hostname')
  if (!result.expectedDatabase) throw new Error('Missing required argument: --expected-database')
  if (!result.confirmation) throw new Error('Missing required argument: --confirmation')
  return result as RollbackPlanAuthorizationPacket
}

// ─── JSON output mode ─────────────────────────────────────────────────────────
// When --output=json is present: emit exactly one JSON document on stdout,
// route all operational log lines to stderr. No trailing bytes.

export function parseOutputFlag(args: string[]): { jsonMode: boolean; remaining: string[] } {
  const idx = args.indexOf('--output=json')
  if (idx === -1) return { jsonMode: false, remaining: args }
  return { jsonMode: true, remaining: args.filter((_, i) => i !== idx) }
}

// ─── CLI entry point ──────────────────────────────────────────────────────────

const PLAN_USAGE = [
  'Usage: pnpm staging:payload-migration-plan -- \\',
  '  --expected-commit=<40-char-sha> \\',
  '  --environment=staging \\',
  '  --target-id=jpvbootcamp-staging \\',
  '  --expected-schema=jpvbootcamp_staging \\',
  '  --expected-hostname=<staging-db-host> \\',
  '  --expected-database=jpvbootcamp',
  '',
  'Performs a read-only pre-flight check. Does NOT mutate the database.',
  'Authorization does NOT authorize push, Dokploy redeployment, Prisma database-deploy,',
  'provider email, post-deployment smoke, or production.',
].join('\n')

const APPLY_USAGE = [
  'Usage: pnpm staging:payload-migration-apply -- \\',
  '  --expected-commit=<40-char-sha> \\',
  '  --environment=staging \\',
  '  --target-id=jpvbootcamp-staging \\',
  '  --expected-schema=jpvbootcamp_staging \\',
  '  --expected-hostname=<staging-db-host> \\',
  '  --expected-database=jpvbootcamp \\',
  `  --expected-migrations=${TARGET_MIGRATIONS.join(',')} \\`,
  '  --operator-id=<id> \\',
  '  --backup-evidence-id=<id> \\',
  '  --maintenance-window-id=<id> \\',
  '  --rollback-owner=<id> \\',
  `  --confirmation=${APPLY_CONFIRMATION_VALUE}`,
  '',
  `Applies the exact migrations 34-35 batch to the ${REQUIRED_SCHEMA} schema.`,
  'Authorization does NOT authorize push, Dokploy redeployment, Prisma database-deploy,',
  'provider email, post-deployment smoke, or production.',
].join('\n')

const ROLLBACK_PLAN_USAGE = [
  'Usage: pnpm staging:payload-migration-rollback-plan -- \\',
  '  --expected-commit=<40-char-sha> \\',
  '  --environment=staging \\',
  '  --target-id=jpvbootcamp-staging \\',
  '  --expected-schema=jpvbootcamp_staging \\',
  '  --expected-hostname=<staging-db-host> \\',
  '  --expected-database=jpvbootcamp \\',
  '  --operator-id=<id> \\',
  '  --backup-evidence-id=<id> \\',
  '  --maintenance-window-id=<id> \\',
  '  --rollback-owner=<id> \\',
  `  --confirmation=${ROLLBACK_PLAN_CONFIRMATION_VALUE}`,
  '',
  'Performs a read-only rollback readiness check. Does NOT execute migrate:down.',
  'Rollback execution requires separate authorization.',
].join('\n')

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2)
  const { jsonMode, remaining: args } = parseOutputFlag(rawArgs)
  const [subcommand, ...rest] = args

  // In JSON mode: stdout = exactly one JSON document; stderr = all operational logs.
  const log = jsonMode
    ? (line: string) => process.stderr.write(line + '\n')
    : (line: string) => process.stdout.write(line + '\n')

  if (!subcommand || subcommand === 'plan') {
    let planInput: PlanCliInput
    try {
      planInput = parsePlanCliArgs(rest)
    } catch (error: unknown) {
      if (jsonMode) {
        const evidence: SafeMigrationPlanEvidence = {
          version: 2,
          resultCode: 'plan_blocked',
          blockerCodes: ['argument_parse_failed'],
          branch: 'unknown',
          commit: 'unknown',
          schema: '',
          environment: '',
          targetId: '',
          appliedPayloadCount: 0,
          expectedPendingMigrations: [...TARGET_MIGRATIONS],
          expectedPendingBatchIsOnlyMissing: false,
          unexpectedPayloadCount: 0,
          duplicatePayloadCount: 0,
          malformedPayloadCount: 0,
          prismaHealthy: false,
        }
        process.stdout.write(JSON.stringify(evidence) + '\n')
        process.stderr.write((error instanceof Error ? error.message : 'Invalid arguments') + '\n')
      } else {
        process.stderr.write(PLAN_USAGE + '\n')
        process.stderr.write((error instanceof Error ? error.message : 'Invalid arguments') + '\n')
      }
      process.exit(1)
    }
    const result = await runStagingMigrationPlan(
      process.env.DATABASE_URL,
      process.env.PAYLOAD_MIGRATION_SCHEMA,
      planInput,
      {},
      log,
    )
    if (jsonMode) {
      // Emit SafeMigrationPlanEvidence — no free-text messages or raw migration names
      const evidence: SafeMigrationPlanEvidence & { unhealthyPrismaMigrations?: string[] } = {
        version: 2,
        resultCode: result.ok ? 'plan_ok' : 'plan_blocked',
        blockerCodes: result.blockers,
        branch: result.branch,
        commit: result.commit,
        schema: result.schema,
        environment: result.environment,
        targetId: result.targetId,
        appliedPayloadCount: result.appliedCount,
        expectedPendingMigrations: [...TARGET_MIGRATIONS],
        expectedPendingBatchIsOnlyMissing:
          result.pendingMigrations.length === TARGET_MIGRATIONS.length &&
          result.pendingMigrations.every((name, index) => name === TARGET_MIGRATIONS[index]),
        unexpectedPayloadCount: result.unexpectedPayloadCount,
        duplicatePayloadCount: result.duplicatePayloadCount,
        malformedPayloadCount: result.malformedPayloadCount,
        prismaHealthy: result.prismaHealthy,
      }
      // Include unhealthyPrismaMigrations when present for diagnostic use
      if (result.unhealthyPrismaMigrations && result.unhealthyPrismaMigrations.length > 0) {
        evidence.unhealthyPrismaMigrations = result.unhealthyPrismaMigrations
      }
      process.stdout.write(JSON.stringify(evidence) + '\n')
    } else {
      process.stdout.write(JSON.stringify(result) + '\n')
    }
    process.exit(result.ok ? 0 : 1)
    return
  }

  if (subcommand === 'apply') {
    let authorization: MigrationAuthorizationPacket
    try {
      authorization = parseApplyCliArgs(rest)
    } catch (error: unknown) {
      process.stderr.write(APPLY_USAGE + '\n')
      process.stderr.write((error instanceof Error ? error.message : 'Invalid arguments') + '\n')
      process.exit(1)
    }
    try {
      const result = await runStagingMigrationApply(
        process.env.DATABASE_URL,
        process.env.PAYLOAD_MIGRATION_SCHEMA,
        authorization,
        {},
        log,
      )
      process.stdout.write(JSON.stringify(result) + '\n')
      process.exit(0)
    } catch (error: unknown) {
      process.stderr.write(
        '[staging-migration-apply] FAILED: ' +
          (error instanceof Error ? error.message : String(error)) + '\n',
      )
      process.exit(1)
    }
    return
  }

  if (subcommand === 'rollback-plan') {
    let authorization: RollbackPlanAuthorizationPacket
    try {
      authorization = parseRollbackPlanCliArgs(rest)
    } catch (error: unknown) {
      process.stderr.write(ROLLBACK_PLAN_USAGE + '\n')
      process.stderr.write((error instanceof Error ? error.message : 'Invalid arguments') + '\n')
      process.exit(1)
    }
    try {
      const result = await runStagingMigrationRollbackPlan(
        process.env.DATABASE_URL,
        process.env.PAYLOAD_MIGRATION_SCHEMA,
        authorization,
        {},
        log,
      )
      process.stdout.write(JSON.stringify(result) + '\n')
      process.exit(result.ok ? 0 : 1)
    } catch (error: unknown) {
      process.stderr.write(
        '[staging-migration-rollback-plan] FAILED: ' +
          (error instanceof Error ? error.message : String(error)) + '\n',
      )
      process.exit(1)
    }
    return
  }

  process.stderr.write(PLAN_USAGE + '\n')
  process.stderr.write(APPLY_USAGE + '\n')
  process.stderr.write(ROLLBACK_PLAN_USAGE + '\n')
  process.exit(1)
}

if (require.main === module) {
  main().catch((error) => {
    console.error(
      '[staging-migration] FATAL:',
      error instanceof Error ? error.message : error,
    )
    process.exitCode = 1
  })
}
