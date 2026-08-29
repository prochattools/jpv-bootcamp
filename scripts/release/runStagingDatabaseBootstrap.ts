import { spawnSync } from 'node:child_process'

import { Client } from 'pg'

import {
  buildStagingMigrationStatus,
  createStagingReadOnlyAdapter,
  REGISTERED_PAYLOAD_MIGRATIONS,
  REGISTERED_PRISMA_MIGRATIONS,
} from './buildStagingMigrationStatus'

const REQUIRED_ENVIRONMENT = 'staging'
const REQUIRED_TARGET_ID = 'jpvbootcamp-staging'
const REQUIRED_SCHEMA = 'jpvbootcamp'
const REQUIRED_DATABASE = 'jpvbootcamp_staging'
const REQUIRED_HOSTNAME = '10.0.2.4'
const REQUIRED_CONFIRMATION = 'bootstrap-empty-staging-database'
const FULL_COMMIT_SHA_RE = /^[0-9a-f]{40}$/
const SAFE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{1,127}$/

// A staging app restart may apply the system Prisma and Payload migrations
// before the guarded bootstrap runs. Continuing is safe only when every
// reviewed table is present, every application table is empty, and any
// migration ledgers are complete and healthy. Any other table or application
// data remains a hard stop so this operation cannot silently adopt a dataset.
// Keep this allowlist explicit: a broad prefix match could admit an unrelated
// table into the migration target.
const REVIEWED_STAGING_TABLES = new Set([
  'Audiences',
  'Project',
  'Subscription',
  '_prisma_migrations',
  'customer_provisioning',
  'email_events',
  'email_subscribers',
  'partner_clicks',
  'partner_sessions',
  'sponsored_applications',
  'sponsored_grants',
  'sponsored_seats',
  'stripe_webhook_events',
  'support_requests',
  'bunny_videos',
  'live_sessions',
  'pay_it_forward_settings',
  'payload_access_grants',
  'payload_access_groups',
  'payload_access_groups_rels',
  'payload_access_policies',
  'payload_access_policies_rels',
  'payload_admin_notifications',
  'payload_affiliate_commissions',
  'payload_affiliate_referrals',
  'payload_affiliates',
  'payload_audit_events',
  'payload_billing_accounts',
  'payload_billing_actions',
  'payload_categories',
  'payload_chat_messages',
  'payload_chat_threads',
  'payload_chat_threads_rels',
  'payload_contact_notes',
  'payload_contact_tags',
  'payload_contacts',
  'payload_course_access_preview',
  'payload_course_enrollments',
  'payload_course_modules',
  'payload_courses',
  'payload_crm_tags',
  'payload_email_actions',
  'payload_email_events',
  'payload_email_templates',
  'payload_engagement_reactions',
  'payload_entitlement_events',
  'payload_kv',
  'payload_lesson_comments',
  'payload_lesson_progress',
  'payload_lesson_resources',
  'payload_lessons',
  'payload_lessons_rels',
  'payload_locked_documents',
  'payload_locked_documents_rels',
  'payload_media',
  'payload_member_groups',
  'payload_member_groups_rels',
  'payload_member_notifications',
  'payload_member_profiles',
  'payload_member_security_events',
  'payload_member_verification_tokens',
  'payload_members',
  'payload_members_sessions',
  'payload_membership_administration_actions',
  'payload_membership_administration_actions_rels',
  'payload_membership_audit_history',
  'payload_membership_funding_sources',
  'payload_membership_reconciliations',
  'payload_membership_review_queue_items',
  'payload_membership_support_records',
  'payload_membership_support_records_rels',
  'payload_membership_vouchers',
  'payload_membership_vouchers_rels',
  'payload_migrations',
  'payload_operator_notes',
  'payload_pages',
  'payload_pages_rels',
  'payload_partner_affiliates',
  'payload_partner_affiliates_recipient_emails',
  'payload_partner_applications',
  'payload_partner_events',
  'payload_pay_it_forward_funding',
  'payload_pay_it_forward_funding_rels',
  'payload_payments',
  'payload_portal_nav_items',
  'payload_posts',
  'payload_posts_rels',
  'payload_preferences',
  'payload_preferences_rels',
  'payload_private_media',
  'payload_space_comments',
  'payload_space_files',
  'payload_space_memberships',
  'payload_space_posts',
  'payload_space_reactions',
  'payload_spaces',
  'payload_spaces_rels',
  'payload_stripe_events',
  'payload_stripe_shadow_projections',
  'payload_subscriptions',
  'payload_users',
  'payload_users_sessions',
  'portal_settings',
])

export type StagingDatabaseBootstrapAuthorization = {
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

export type StagingDatabaseBootstrapResult = {
  ok: true
  mode: 'bootstrap-empty-database'
  branch: string
  commit: string
  environment: string
  targetId: string
  database: string
  schema: string
  operatorId: string
  backupEvidenceId: string
  maintenanceWindowId: string
  rollbackOwner: string
  preflight: {
    targetWasEmpty: boolean
    prismaOnlyInitialized: boolean
    payloadAlreadyInitialized: boolean
    applicationDataPresent: boolean
    currentDatabase: string
    currentSchema: string
    currentUserClass: 'staging-role'
  }
  postApply: {
    payloadMigrationCount: number
    prismaMigrationCount: number
    migrationState: 'VERIFIED'
    applicationPreflight: 'PASSED'
  }
}

type GitResolver = {
  branch: () => string
  commit: () => string
}

type CommandRunner = (
  executable: string,
  args: string[],
  environment: NodeJS.ProcessEnv,
) => { status: number | null; error?: Error }

type BootstrapDependencies = {
  gitResolver?: GitResolver
  commandRunner?: CommandRunner
  preflight?: (databaseUrl: string) => Promise<BootstrapPreflight>
  verify?: (databaseUrl: string) => Promise<BootstrapVerification>
  log?: (line: string) => void
}

type BootstrapPreflight = {
  targetWasEmpty: boolean
  prismaOnlyInitialized: boolean
  payloadAlreadyInitialized: boolean
  applicationDataPresent: boolean
  currentDatabase: string
  currentSchema: string
  currentUserClass: 'staging-role'
}

type BootstrapVerification = {
  payloadMigrationCount: number
  prismaMigrationCount: number
  migrationState: 'VERIFIED'
  applicationPreflight: 'PASSED'
}

function fail(message: string): never {
  throw new Error(`STAGING-BOOTSTRAP-DENIED: ${message}`)
}

function requireSafeId(value: string, label: string): string {
  if (!SAFE_ID_RE.test(value)) fail(`${label} is invalid`)
  return value
}

function requireFullSha(value: string): string {
  if (!FULL_COMMIT_SHA_RE.test(value)) fail('expected commit must be a full lowercase SHA')
  return value
}

function parseAndValidateDatabaseUrl(databaseUrl: string): URL {
  let parsed: URL
  try {
    parsed = new URL(databaseUrl)
  } catch {
    fail('DATABASE_URL is not a valid URL')
  }

  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    fail('DATABASE_URL must use PostgreSQL')
  }
  if (parsed.hostname !== REQUIRED_HOSTNAME) {
    fail('DATABASE_URL hostname does not match the approved staging database host')
  }
  if ((parsed.port || '5432') !== '5433') {
    fail('DATABASE_URL port does not match the approved staging database port')
  }
  if (decodeURIComponent(parsed.pathname.replace(/^\//, '')) !== REQUIRED_DATABASE) {
    fail('DATABASE_URL database does not match the approved staging database')
  }
  const schemas = parsed.searchParams.getAll('schema')
  if (schemas.length !== 1 || schemas[0] !== REQUIRED_SCHEMA) {
    fail('DATABASE_URL schema does not match the approved staging schema')
  }

  // The exact database identity checks above are the primary deny-list. Keep
  // this token check as defense in depth against accidentally supplied aliases.
  const productionTokens = new Set(['prod', 'production', 'live', 'main'])
  const identityTokens = [parsed.hostname, parsed.pathname, ...schemas]
    .flatMap((value) => value.toLowerCase().split(/[^a-z0-9]+/))
  if (identityTokens.some((token) => productionTokens.has(token))) {
    fail('production identity marker detected in database target')
  }

  return parsed
}

function validateAuthorization(
  authorization: StagingDatabaseBootstrapAuthorization,
  branch: string,
  commit: string,
): void {
  requireSafeId(authorization.operatorId, 'operator id')
  requireSafeId(authorization.backupEvidenceId, 'backup evidence id')
  requireSafeId(authorization.maintenanceWindowId, 'maintenance window id')
  requireSafeId(authorization.rollbackOwner, 'rollback owner')
  requireFullSha(authorization.expectedCommit)
  if (authorization.expectedCommit !== commit) fail('checked-out commit does not match expected commit')
  if (!/^(feature|fix|release)\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(branch)) {
    fail('source branch must be feature/*, fix/*, or release/*')
  }
  if (authorization.environment !== REQUIRED_ENVIRONMENT) fail('environment must be staging')
  if (authorization.targetId !== REQUIRED_TARGET_ID) fail('target id does not match staging')
  if (authorization.expectedSchema !== REQUIRED_SCHEMA) fail('expected schema does not match staging')
  if (authorization.expectedHostname !== REQUIRED_HOSTNAME) fail('expected hostname does not match staging')
  if (authorization.expectedDatabase !== REQUIRED_DATABASE) fail('expected database does not match staging')
  if (authorization.confirmation !== REQUIRED_CONFIRMATION) fail('confirmation phrase is invalid')
}

async function defaultPreflight(databaseUrl: string): Promise<BootstrapPreflight> {
  const parsed = parseAndValidateDatabaseUrl(databaseUrl)
  const client = new Client({ connectionString: parsed.toString(), connectionTimeoutMillis: 5_000 })
  let transactionStarted = false

  try {
    await client.connect()
    await client.query('BEGIN TRANSACTION READ ONLY')
    transactionStarted = true
    await client.query("SET LOCAL statement_timeout = '5000ms'")
    // The `pg` client does not apply Prisma's `?schema=` URL parameter to
    // search_path. Set it explicitly inside the read-only transaction before
    // checking current_schema(), so the identity check validates the approved
    // canonical schema rather than the server default (usually `public`).
    await client.query(`SET LOCAL search_path TO "${REQUIRED_SCHEMA}"`)

    const identity = await client.query<{
      current_database: string
      current_schema: string | null
      current_user: string
    }>('SELECT current_database(), current_schema(), current_user')
    const row = identity.rows[0]
    if (!row || row.current_database !== REQUIRED_DATABASE || row.current_schema !== REQUIRED_SCHEMA) {
      fail('database-reported identity does not match the approved staging target')
    }
    if (!row.current_user.toLowerCase().includes('staging')) {
      fail('database role is not classified as staging-only')
    }

    const tables = await client.query<{ table_name: string }>(
      'SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_type = $2',
      [REQUIRED_SCHEMA, 'BASE TABLE'],
    )

    const tableNames = tables.rows.map((row) => row.table_name)
    const unexpectedTables = tableNames.filter((tableName) => !REVIEWED_STAGING_TABLES.has(tableName))
    if (unexpectedTables.length > 0) {
      fail(`staging target contains unreviewed tables: ${unexpectedTables.join(', ')}`)
    }

    const applicationTables = tableNames.filter((tableName) =>
      tableName !== '_prisma_migrations' && tableName !== 'payload_migrations',
    )
    for (const tableName of applicationTables) {
      const tableIdentifier = `"${tableName.replaceAll('"', '""')}"`
      const count = await client.query<{ row_count: string }>(
        `SELECT COUNT(*)::text AS row_count FROM "${REQUIRED_SCHEMA}".${tableIdentifier}`,
      )
      if (count.rows[0]?.row_count !== '0') {
        fail('staging target contains application data; bootstrap refuses to continue')
      }
    }

    const hasPrismaLedger = tableNames.includes('_prisma_migrations')
    if (hasPrismaLedger) {
      const prismaRows = await client.query<{
        migration_name: string
        started_at: string | null
        finished_at: string | null
        rolled_back_at: string | null
        applied_steps_count: string | number
      }>(
        `SELECT migration_name, started_at, finished_at, rolled_back_at, applied_steps_count FROM "${REQUIRED_SCHEMA}"."_prisma_migrations" ORDER BY started_at ASC`,
      )
      const expected = new Set(REGISTERED_PRISMA_MIGRATIONS)
      const actual = new Set(prismaRows.rows.map((row) => row.migration_name))
      const unexpected = prismaRows.rows
        .map((row) => row.migration_name)
        .filter((name) => !expected.has(name))
      const missing = REGISTERED_PRISMA_MIGRATIONS.filter((name) => !actual.has(name))
      const unhealthy = prismaRows.rows.filter((row) =>
        !row.started_at || !row.finished_at || row.rolled_back_at ||
        (typeof row.applied_steps_count === 'string'
          ? !/^\d+$/.test(row.applied_steps_count)
          : !Number.isSafeInteger(row.applied_steps_count) || row.applied_steps_count < 0),
      )
      if (unexpected.length > 0 || missing.length > 0 || unhealthy.length > 0 || actual.size !== prismaRows.rows.length) {
        fail('pre-existing Prisma migration ledger is incomplete or unhealthy')
      }
    }

    const hasPayloadLedger = tableNames.includes('payload_migrations')
    if (hasPayloadLedger) {
      const payloadRows = await client.query<{ name: string; batch: string | number }>(
        `SELECT name, batch FROM "${REQUIRED_SCHEMA}"."payload_migrations" ORDER BY id ASC`,
      )
      const expected = [...REGISTERED_PAYLOAD_MIGRATIONS]
      const actual = payloadRows.rows.map((row) => row.name)
      const validBatches = payloadRows.rows.every((row) =>
        typeof row.batch === 'number'
          ? Number.isSafeInteger(row.batch) && row.batch >= 1
          : /^\d+$/.test(row.batch) && Number.isSafeInteger(Number(row.batch)) && Number(row.batch) >= 1,
      )
      if (
        actual.length !== expected.length ||
        actual.some((name, index) => name !== expected[index]) ||
        new Set(actual).size !== actual.length ||
        !validBatches
      ) {
        fail('pre-existing Payload migration ledger is incomplete or unhealthy')
      }
    }

    return {
      targetWasEmpty: applicationTables.length === 0 && !hasPrismaLedger,
      prismaOnlyInitialized: hasPrismaLedger && !hasPayloadLedger,
      payloadAlreadyInitialized: hasPayloadLedger,
      applicationDataPresent: false,
      currentDatabase: row.current_database,
      currentSchema: row.current_schema,
      currentUserClass: 'staging-role',
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('STAGING-BOOTSTRAP-DENIED:')) throw error
    fail('read-only empty-target preflight failed')
  } finally {
    if (transactionStarted) await client.query('ROLLBACK').catch((): void => undefined)
    await client.end().catch((): void => undefined)
  }
}

async function defaultVerify(databaseUrl: string): Promise<BootstrapVerification> {
  const adapter = createStagingReadOnlyAdapter({
    databaseUrl,
    expectedSchema: REQUIRED_SCHEMA,
    schemaOverride: REQUIRED_SCHEMA,
  })
  const report = await buildStagingMigrationStatus(adapter, REQUIRED_SCHEMA)
  if (report.result !== 'VERIFIED') fail(`post-apply migration state is ${report.result}`)

  const { spawnSync: ignoredSpawnSync } = await import('node:child_process')
  const preflight = ignoredSpawnSync('node', ['scripts/release/payload-migration-preflight.cjs'], {
    cwd: process.cwd(),
    env: { ...process.env, PAYLOAD_MIGRATION_SCHEMA: REQUIRED_SCHEMA, DATABASE_URL: databaseUrl },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (preflight.error || preflight.status !== 0) fail('Payload application preflight failed after migration')

  return {
    payloadMigrationCount: report.appliedPayloadMigrations.length,
    prismaMigrationCount: report.prismaMigrations.length,
    migrationState: 'VERIFIED',
    applicationPreflight: 'PASSED',
  }
}

function defaultCommandRunner(
  executable: string,
  args: string[],
  environment: NodeJS.ProcessEnv,
): { status: number | null; error?: Error } {
  const result = spawnSync(executable, args, {
    cwd: process.cwd(),
    env: environment,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return { status: result.status, error: result.error }
}

export async function runStagingDatabaseBootstrap(
  databaseUrl: string | undefined,
  authorization: StagingDatabaseBootstrapAuthorization,
  dependencies: BootstrapDependencies = {},
): Promise<StagingDatabaseBootstrapResult> {
  if (!databaseUrl?.trim()) fail('DATABASE_URL is required')
  parseAndValidateDatabaseUrl(databaseUrl)

  const git = dependencies.gitResolver ?? {
    branch: () => String(process.env.GITHUB_REF_NAME || '').trim() || 'unknown',
    commit: () => String(process.env.GITHUB_SHA || '').trim() || 'unknown',
  }
  const branch = git.branch()
  const commit = git.commit()
  validateAuthorization(authorization, branch, commit)

  const log = dependencies.log ?? console.log
  const preflight = await (dependencies.preflight ?? defaultPreflight)(databaseUrl)
  log(`[staging-bootstrap] bootstrap-safe target confirmed: ${preflight.currentDatabase}?schema=${preflight.currentSchema}`)

  const commandRunner = dependencies.commandRunner ?? defaultCommandRunner
  const commandEnvironment: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    DEPLOYMENT_ENV: REQUIRED_ENVIRONMENT,
    PAYLOAD_MIGRATION_SCHEMA: REQUIRED_SCHEMA,
    NODE_ENV: 'production',
  }

  log('[staging-bootstrap] applying canonical Prisma migrations')
  const prisma = commandRunner('./node_modules/.bin/prisma', ['migrate', 'deploy', '--schema=prisma/system.prisma'], commandEnvironment)
  if (prisma.error || prisma.status !== 0) fail(`Prisma migration command failed (exit=${prisma.status ?? 'unknown'})`)

  log('[staging-bootstrap] applying canonical Payload migrations')
  const payload = commandRunner('./node_modules/.bin/payload', ['migrate'], commandEnvironment)
  if (payload.error || payload.status !== 0) fail(`Payload migration command failed (exit=${payload.status ?? 'unknown'})`)

  log('[staging-bootstrap] verifying migration ledgers and application schema')
  const postApply = await (dependencies.verify ?? defaultVerify)(databaseUrl)

  return {
    ok: true,
    mode: 'bootstrap-empty-database',
    branch,
    commit,
    environment: REQUIRED_ENVIRONMENT,
    targetId: REQUIRED_TARGET_ID,
    database: REQUIRED_DATABASE,
    schema: REQUIRED_SCHEMA,
    operatorId: authorization.operatorId,
    backupEvidenceId: authorization.backupEvidenceId,
    maintenanceWindowId: authorization.maintenanceWindowId,
    rollbackOwner: authorization.rollbackOwner,
    preflight,
    postApply,
  }
}

function parseArgs(args: string[]): StagingDatabaseBootstrapAuthorization {
  const values = new Map<string, string>()
  for (const arg of args) {
    const index = arg.indexOf('=')
    if (index < 0) fail(`argument must use --name=value: ${arg}`)
    const key = arg.slice(0, index)
    const value = arg.slice(index + 1)
    if (!key.startsWith('--') || !value || values.has(key)) fail(`invalid or duplicate argument: ${key}`)
    values.set(key, value)
  }
  const required = (key: string): string => values.get(key) ?? fail(`missing required argument: ${key}`)
  return {
    operatorId: required('--operator-id'),
    backupEvidenceId: required('--backup-evidence-id'),
    maintenanceWindowId: required('--maintenance-window-id'),
    rollbackOwner: required('--rollback-owner'),
    expectedCommit: required('--expected-commit'),
    environment: required('--environment'),
    targetId: required('--target-id'),
    expectedSchema: required('--expected-schema'),
    expectedHostname: required('--expected-hostname'),
    expectedDatabase: required('--expected-database'),
    confirmation: required('--confirmation'),
  }
}

async function main(): Promise<void> {
  try {
    const authorization = parseArgs(process.argv.slice(2))
    // Keep stdout JSON-only for the guarded workflow artifact. Progress logs
    // belong on stderr so callers can parse the evidence without accepting
    // mixed human and machine output.
    const result = await runStagingDatabaseBootstrap(process.env.DATABASE_URL, authorization, {
      log: (line) => process.stderr.write(`${line}\n`),
    })
    process.stdout.write(`${JSON.stringify(result)}\n`)
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'STAGING-BOOTSTRAP-DENIED: unknown error'}\n`)
    process.exitCode = 1
  }
}

if (process.argv[1]?.endsWith('runStagingDatabaseBootstrap.ts')) {
  void main()
}
