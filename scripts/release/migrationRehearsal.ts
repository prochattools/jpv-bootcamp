import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { Client } from 'pg'

import { runStagingMigrationPreflight } from './stagingMigrationPreflight'

const EXPECTED_BRANCH = 'feature/course-branding-and-preview'
const MIGRATION_PATH = 'prisma/migrations/20260712_151700_add_support_requests/migration.sql'
const SUPPORT_TABLE = 'support_requests'
const EXECUTE_CONFIRMATION = 'support-migration-rehearsal'
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])
const DISPOSABLE_NAME_PATTERN = /(test|local|rehearsal|e2e)/i
const FORBIDDEN_NAME_PATTERN = /(prod|production|staging|preview|live)/i
const REQUIRED_INDEXES = [
  'support_requests_created_at_idx',
  'support_requests_dedupe_key_key',
  'support_requests_normalized_email_idx',
  'support_requests_notification_status_idx',
  'support_requests_review_status_idx',
] as const
const REQUIRED_COLUMNS = [
  'id',
  'created_at',
  'updated_at',
  'normalized_email',
  'name',
  'question',
  'source',
  'page',
  'dedupe_key',
  'review_status',
  'notification_status',
  'notification_attempt_count',
  'notification_last_attempt_at',
  'notification_next_attempt_at',
  'notification_last_error_code',
  'reviewed_at',
  'reviewed_by_account_id',
] as const
const EXTERNAL_OPERATIONS_NOT_PERFORMED = [
  'No staging or production database was touched.',
  'No live Stripe call was made.',
  'No live email was sent.',
  'No provider verification was executed.',
  'No deployment was triggered.',
]

export type MigrationRehearsalMode = 'static' | 'execute'

export type MigrationRehearsalOptions = {
  cwd?: string
  mode?: MigrationRehearsalMode
  databaseUrl?: string
  confirmDisposableDb?: string
  log?: (message: string) => void
  now?: Date
  preflightRunner?: () => string | void
  outputPath?: string
}

export type MigrationRehearsalStep = {
  id: string
  label: string
  status: 'passed' | 'planned'
  detail: string
}

export type MigrationRehearsalResult = {
  ok: boolean
  branch: string
  head: string
  mode: MigrationRehearsalMode
  migrationPath: string
  migrationChecksum: string
  supportRequestsMigrationExecuted: boolean
  databaseHostClassification: 'not-requested' | 'local/test only'
  databaseNameClassification: 'not-requested' | 'local/test only'
  schemaName: string | null
  timestamp: string
  finalStatus:
    | 'STATIC REHEARSAL READY'
    | 'DISPOSABLE DATABASE REHEARSAL PASSED'
  blockedLiveStep: string | null
  baselineInventory: {
    tableCount: number | null
    supportRequestsPresent: boolean | null
  }
  postApplyVerification: {
    supportRequestsPresent: boolean | null
    columnCount: number | null
    indexesVerified: string[]
  }
  rollbackResult: 'not-executed-static-only' | 'support_requests removed via disposable-db rollback notes'
  teardownResult: 'not-executed-static-only' | 'baseline restored'
  steps: MigrationRehearsalStep[]
  commandsExecuted: string[]
  externalOperationsNotPerformed: string[]
}

type LocalDatabaseTarget = {
  hostname: string
  database: string
  schema: string
}

type SupportColumnRow = {
  column_name: string
  column_default: string | null
}

function getBranch(cwd: string): string {
  return execFileSync('git', ['branch', '--show-current'], { cwd, encoding: 'utf8' }).trim()
}

function getHead(cwd: string): string {
  return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd, encoding: 'utf8' }).trim()
}

function read(cwd: string, relativePath: string): string {
  return readFileSync(path.join(cwd, relativePath), 'utf8')
}

function requireFile(cwd: string, relativePath: string): void {
  if (!existsSync(path.join(cwd, relativePath))) {
    throw new Error(`required_file_missing:${relativePath}`)
  }
}

function migrationSql(cwd: string): string {
  requireFile(cwd, MIGRATION_PATH)
  return read(cwd, MIGRATION_PATH)
}

function migrationChecksum(cwd: string): string {
  return createHash('sha256').update(migrationSql(cwd), 'utf8').digest('hex')
}

function executableMigrationSql(sql: string): string {
  return sql
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n')
    .trim()
}

function rollbackStatements(sql: string): string[] {
  return sql
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('-- DROP '))
    .map((line) => line.replace(/^--\s*/, ''))
}

export function parseDisposableDatabaseUrl(databaseUrl: string | undefined): LocalDatabaseTarget {
  if (!databaseUrl) throw new Error('database_url_required')

  let parsed: URL
  try {
    parsed = new URL(databaseUrl)
  } catch {
    throw new Error('database_url_malformed')
  }

  if (!['postgresql:', 'postgres:'].includes(parsed.protocol)) {
    throw new Error('database_protocol_rejected')
  }
  if (!LOCAL_HOSTS.has(parsed.hostname)) {
    if (parsed.hostname.includes('staging') || parsed.hostname.includes('preview') || parsed.hostname.includes('prod')) {
      throw new Error('database_host_rejected_non_local')
    }
    throw new Error('database_host_unknown')
  }

  const database = parsed.pathname.replace(/^\//, '')
  if (!database) throw new Error('database_name_missing')
  if (FORBIDDEN_NAME_PATTERN.test(database)) throw new Error('database_name_resembles_staging_or_production')
  if (!DISPOSABLE_NAME_PATTERN.test(database)) throw new Error('database_name_not_disposable')

  const username = decodeURIComponent(parsed.username || '')
  const password = decodeURIComponent(parsed.password || '')
  if (!DISPOSABLE_NAME_PATTERN.test(username) && !DISPOSABLE_NAME_PATTERN.test(password)) {
    throw new Error('database_credentials_not_test_only')
  }

  const schema = parsed.searchParams.get('schema') ?? 'public'
  if (!DISPOSABLE_NAME_PATTERN.test(schema) && schema !== 'public') {
    throw new Error('database_schema_not_disposable')
  }
  if (FORBIDDEN_NAME_PATTERN.test(schema)) {
    throw new Error('database_schema_resembles_staging_or_production')
  }

  return {
    hostname: parsed.hostname,
    database,
    schema,
  }
}

async function queryTableNames(client: Client, schema: string): Promise<string[]> {
  const result = await client.query<{ table_name: string }>(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = $1
        AND table_type = 'BASE TABLE'
      ORDER BY table_name`,
    [schema],
  )
  return result.rows.map((row) => row.table_name)
}

async function queryIndexes(client: Client, schema: string): Promise<string[]> {
  const result = await client.query<{ indexname: string }>(
    `SELECT indexname
       FROM pg_indexes
      WHERE schemaname = $1
        AND tablename = $2
      ORDER BY indexname`,
    [schema, SUPPORT_TABLE],
  )
  return result.rows.map((row) => row.indexname)
}

async function queryColumns(client: Client, schema: string): Promise<SupportColumnRow[]> {
  const result = await client.query<SupportColumnRow>(
    `SELECT column_name, column_default
       FROM information_schema.columns
      WHERE table_schema = $1
        AND table_name = $2
      ORDER BY ordinal_position`,
    [schema, SUPPORT_TABLE],
  )
  return result.rows
}

function verifyPostApply(columns: SupportColumnRow[], indexes: string[]): void {
  const names = columns.map((column) => column.column_name)
  for (const required of REQUIRED_COLUMNS) {
    if (!names.includes(required)) throw new Error(`missing_support_column:${required}`)
  }
  for (const required of REQUIRED_INDEXES) {
    if (!indexes.includes(required)) throw new Error(`missing_support_index:${required}`)
  }

  const reviewStatus = columns.find((column) => column.column_name === 'review_status')
  const notificationStatus = columns.find((column) => column.column_name === 'notification_status')
  const notificationAttempts = columns.find((column) => column.column_name === 'notification_attempt_count')
  if (!reviewStatus?.column_default?.includes("'pending'")) {
    throw new Error('review_status_default_missing')
  }
  if (!notificationStatus?.column_default?.includes("'pending'")) {
    throw new Error('notification_status_default_missing')
  }
  if (!notificationAttempts?.column_default?.includes('0')) {
    throw new Error('notification_attempt_count_default_missing')
  }
}

function formatStep(step: MigrationRehearsalStep): string {
  return `${step.status.toUpperCase()} ${step.id}: ${step.label} — ${step.detail}`
}

function renderSummary(result: MigrationRehearsalResult): string {
  const lines = [
    'STAGING MIGRATION REHEARSAL',
    `Branch: ${result.branch}`,
    `HEAD: ${result.head}`,
    `Mode: ${result.mode}`,
    `Migration checksum: ${result.migrationChecksum}`,
    `Database host classification: ${result.databaseHostClassification}`,
    `Database name classification: ${result.databaseNameClassification}`,
    `Final status: ${result.finalStatus}`,
  ]
  if (result.blockedLiveStep) {
    lines.push(`Blocked live step: ${result.blockedLiveStep}`)
  }
  for (const step of result.steps) {
    lines.push(formatStep(step))
  }
  return lines.join('\n')
}

export function buildMigrationRehearsalEvidenceMarkdown(result: MigrationRehearsalResult): string {
  const lines = [
    '# Migration Rehearsal Evidence',
    '',
    '## Identity',
    `- Branch: \`${result.branch}\``,
    `- Commit: \`${result.head}\``,
    `- Rehearsal mode: \`${result.mode}\``,
    `- Timestamp: \`${result.timestamp}\``,
    '',
    '## Migration',
    `- Path: \`${result.migrationPath}\``,
    `- Checksum: \`${result.migrationChecksum}\``,
    '',
    '## Database classification',
    `- Host classification: \`${result.databaseHostClassification}\``,
    `- Database classification: \`${result.databaseNameClassification}\``,
    `- Schema: \`${result.schemaName ?? 'not-requested'}\``,
    '',
    '## Preflight results',
    `- Final status: \`${result.finalStatus}\``,
    `- Support migration executed: \`${result.supportRequestsMigrationExecuted ? 'yes' : 'no'}\``,
    `- Blocked live step: \`${result.blockedLiveStep ?? 'none'}\``,
    '',
    '## Baseline inventory',
    `- Table count: \`${result.baselineInventory.tableCount ?? 'not-executed'}\``,
    `- support_requests present before apply: \`${result.baselineInventory.supportRequestsPresent ?? 'not-executed'}\``,
    '',
    '## Post-apply verification',
    `- support_requests present after apply: \`${result.postApplyVerification.supportRequestsPresent ?? 'not-executed'}\``,
    `- Column count: \`${result.postApplyVerification.columnCount ?? 'not-executed'}\``,
    `- Verified indexes: \`${result.postApplyVerification.indexesVerified.join(', ') || 'not-executed'}\``,
    '',
    '## Rollback and teardown',
    `- Rollback result: \`${result.rollbackResult}\``,
    `- Teardown result: \`${result.teardownResult}\``,
    '',
    '## Commands executed',
    ...result.commandsExecuted.map((command) => `- \`${command}\``),
    '',
    '## External operations not performed',
    ...result.externalOperationsNotPerformed.map((item) => `- ${item}`),
    '',
    '## Step ledger',
    ...result.steps.map((step) => `- ${formatStep(step)}`),
    '',
  ]

  if (!result.supportRequestsMigrationExecuted) {
    lines.push(
      'Static-only note: no database migration was executed in this rehearsal; the live disposable-database execution step remains blocked until an explicit localhost-only test database is supplied with the required confirmation sentinel.',
      '',
    )
  }

  return lines.join('\n')
}

async function runExecuteMode(
  target: LocalDatabaseTarget,
  databaseUrl: string,
  cwd: string,
  result: MigrationRehearsalResult,
): Promise<void> {
  const sql = migrationSql(cwd)
  const applySql = executableMigrationSql(sql)
  const rollbackSql = rollbackStatements(sql)

  const client = new Client({ connectionString: databaseUrl })
  await client.connect()
  result.commandsExecuted.push('pg.connect [local/test only]')

  try {
    const baselineTables = await queryTableNames(client, target.schema)
    result.baselineInventory = {
      tableCount: baselineTables.length,
      supportRequestsPresent: baselineTables.includes(SUPPORT_TABLE),
    }
    if (baselineTables.includes(SUPPORT_TABLE)) {
      throw new Error('support_requests_already_present')
    }

    await client.query(applySql)
    result.commandsExecuted.push(`pg.apply migration.sql (${MIGRATION_PATH})`)

    const postTables = await queryTableNames(client, target.schema)
    const columns = await queryColumns(client, target.schema)
    const indexes = await queryIndexes(client, target.schema)
    verifyPostApply(columns, indexes)
    result.postApplyVerification = {
      supportRequestsPresent: postTables.includes(SUPPORT_TABLE),
      columnCount: columns.length,
      indexesVerified: [...indexes],
    }
    result.steps.push({
      id: 'baseline-inventory',
      label: 'Capture baseline schema inventory',
      status: 'passed',
      detail: `support_requests absent before apply in schema ${target.schema}`,
    })
    result.steps.push({
      id: 'apply',
      label: 'Apply the reviewed support_requests migration',
      status: 'passed',
      detail: 'Executed only against the explicit localhost-only disposable database.',
    })
    result.steps.push({
      id: 'post-apply',
      label: 'Verify support_requests structure after apply',
      status: 'passed',
      detail: `Verified ${columns.length} columns and ${indexes.length} indexes.`,
    })

    for (const statement of rollbackSql) {
      await client.query(statement)
    }
    result.commandsExecuted.push('pg.rollback support_requests via documented disposable rollback notes')

    const finalTables = await queryTableNames(client, target.schema)
    const finalNames = JSON.stringify(finalTables)
    const baselineNames = JSON.stringify(baselineTables)
    if (finalNames !== baselineNames) {
      throw new Error('baseline_not_restored_after_teardown')
    }
    result.rollbackResult = 'support_requests removed via disposable-db rollback notes'
    result.teardownResult = 'baseline restored'
    result.steps.push({
      id: 'rollback',
      label: 'Rollback the disposable rehearsal',
      status: 'passed',
      detail: 'Executed only against the disposable database using the migration rollback notes.',
    })
    result.steps.push({
      id: 'teardown',
      label: 'Verify teardown restored the baseline schema',
      status: 'passed',
      detail: `Baseline table inventory restored for schema ${target.schema}.`,
    })
  } finally {
    await client.end()
  }
}

export async function runMigrationRehearsal(
  options: MigrationRehearsalOptions = {},
): Promise<MigrationRehearsalResult> {
  const cwd = options.cwd ?? process.cwd()
  const log = options.log ?? console.log
  const branch = getBranch(cwd)
  if (branch !== EXPECTED_BRANCH) throw new Error(`branch_mismatch:${branch}`)

  const head = getHead(cwd)
  const mode = options.mode ?? 'static'
  const timestamp = (options.now ?? new Date()).toISOString()
  const preflightRunner = options.preflightRunner ?? (() => runStagingMigrationPreflight({ cwd }))

  const result: MigrationRehearsalResult = {
    ok: true,
    branch,
    head,
    mode,
    migrationPath: MIGRATION_PATH,
    migrationChecksum: migrationChecksum(cwd),
    supportRequestsMigrationExecuted: false,
    databaseHostClassification: 'not-requested',
    databaseNameClassification: 'not-requested',
    schemaName: null,
    timestamp,
    finalStatus: 'STATIC REHEARSAL READY',
    blockedLiveStep:
      'No approved localhost-only disposable Prisma rehearsal database was supplied for this run.',
    baselineInventory: {
      tableCount: null,
      supportRequestsPresent: null,
    },
    postApplyVerification: {
      supportRequestsPresent: null,
      columnCount: null,
      indexesVerified: [],
    },
    rollbackResult: 'not-executed-static-only',
    teardownResult: 'not-executed-static-only',
    steps: [],
    commandsExecuted: ['pnpm staging:migration-preflight'],
    externalOperationsNotPerformed: [...EXTERNAL_OPERATIONS_NOT_PERFORMED],
  }

  preflightRunner()
  result.steps.push({
    id: 'preflight',
    label: 'Run read-only migration preflight',
    status: 'passed',
    detail: 'Verified branch policy, unapplied evidence, runbook contract, and supporting static tests.',
  })
  result.steps.push({
    id: 'checksum',
    label: 'Capture migration checksum',
    status: 'passed',
    detail: `SHA-256 ${result.migrationChecksum}`,
  })

  if (mode === 'static') {
    result.steps.push({
      id: 'baseline-inventory',
      label: 'Capture baseline schema inventory',
      status: 'planned',
      detail: 'Planned only; requires an explicit localhost-only disposable database URL and confirmation flag.',
    })
    result.steps.push({
      id: 'apply',
      label: 'Apply the reviewed support_requests migration',
      status: 'planned',
      detail: 'Planned only; dry-run mode never executes database SQL.',
    })
    result.steps.push({
      id: 'post-apply',
      label: 'Verify support_requests structure after apply',
      status: 'planned',
      detail: 'Planned only; dry-run mode records the verification contract without mutating a database.',
    })
    result.steps.push({
      id: 'rollback',
      label: 'Rollback the disposable rehearsal',
      status: 'planned',
      detail: 'Planned only; rollback and teardown remain mandatory before any disposable execution is considered complete.',
    })
    result.steps.push({
      id: 'teardown',
      label: 'Verify teardown restored the baseline schema',
      status: 'planned',
      detail: 'Planned only; baseline restoration is mandatory for disposable execution.',
    })
  } else {
    if (options.confirmDisposableDb !== EXECUTE_CONFIRMATION) {
      throw new Error('execute_confirmation_missing')
    }
    const target = parseDisposableDatabaseUrl(options.databaseUrl)
    result.databaseHostClassification = 'local/test only'
    result.databaseNameClassification = 'local/test only'
    result.schemaName = target.schema
    result.blockedLiveStep = null
    await runExecuteMode(target, options.databaseUrl!, cwd, result)
    result.supportRequestsMigrationExecuted = true
    result.finalStatus = 'DISPOSABLE DATABASE REHEARSAL PASSED'
  }

  const output = renderSummary(result)
  log(output)
  if (options.outputPath) {
    writeFileSync(options.outputPath, buildMigrationRehearsalEvidenceMarkdown(result), 'utf8')
  }
  return result
}

function parseArg(name: string, argv: string[]): string | undefined {
  const prefix = `--${name}=`
  return argv.find((value) => value.startsWith(prefix))?.slice(prefix.length)
}

function modeFromArgv(argv: string[]): MigrationRehearsalMode {
  return argv.includes('--execute') ? 'execute' : 'static'
}

function main(): void {
  const argv = process.argv.slice(2)
  runMigrationRehearsal({
    mode: modeFromArgv(argv),
    databaseUrl: parseArg('database-url', argv),
    confirmDisposableDb: parseArg('confirm-disposable-db', argv),
    outputPath: parseArg('output', argv),
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main()
}
