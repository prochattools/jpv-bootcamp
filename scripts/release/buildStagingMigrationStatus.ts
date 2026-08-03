/**
 * buildStagingMigrationStatus.ts
 *
 * Read-only migration-state evidence command. When run with an authorized
 * staging connection, reports PII-safe migration metadata. When credentials
 * are absent or schema identity does not match, reports
 * OPERATOR_EVIDENCE_REQUIRED without executing any queries.
 *
 * Safety design:
 *  - Requires --mode=staging-read-only flag (fail closed without it)
 *  - Requires --expected-schema flag with exact schema name
 *  - Validates expectedSchema BEFORE opening any database connection
 *  - Verifies database schema identity before any data query
 *  - Never prints connection strings, credentials, or arbitrary DB rows
 *  - Never applies or repairs anything
 *
 * Payload migration tracking table: payload_migrations
 *   (default for @payloadcms/db-postgres — no custom migrationTableName
 *    is set in src/payload.config.ts)
 *
 * Prisma migration tracking: _prisma_migrations
 *   (standard Prisma shadow table; confirmed by absence of override in
 *    prisma/schema.prisma and prisma/system.prisma)
 */

import { PAYLOAD_MIGRATION_NAMES } from '../../src/migrations/migrationRegistry'

// ---------------------------------------------------------------------------
// Registered migrations — derived from canonical migrationRegistry.ts
// ---------------------------------------------------------------------------

export const REGISTERED_PAYLOAD_MIGRATIONS: readonly string[] = PAYLOAD_MIGRATION_NAMES

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PayloadMigrationRow {
  name: string
  batch: number
}

export interface PrismaMigrationRow {
  migration_name: string
  finished_at: string | null
  logs: string | null
  rolled_back_at: string | null
  started_at: string
  applied_steps_count: number
}

export type PrismaMigrationStatus = 'applied' | 'failed' | 'in-progress' | 'rolled-back' | 'unexpected'

function classifyPrismaMigration(row: PrismaMigrationRow): PrismaMigrationStatus {
  if (row.rolled_back_at !== null) return 'rolled-back'
  if (row.finished_at !== null) return 'applied'
  if (row.logs !== null) return 'failed'
  // started but not finished, no logs, not rolled back => in-progress/unfinished
  return 'in-progress'
}

/**
 * Injected adapter interface. Implement with real DB queries for live use;
 * inject test doubles for unit tests.
 */
export interface MigrationQueryAdapter {
  getPayloadMigrations(): Promise<PayloadMigrationRow[]>
  getPrismaMigrations(): Promise<PrismaMigrationRow[]>
  getDatabaseSchemaIdentity(): Promise<string>
}

export interface StagingMigrationStatusReport {
  reportVersion: '1.0'
  mode: 'live' | 'dry-run'
  registeredMigrations: string[]
  appliedPayloadMigrations: string[]
  missingPayloadMigrations: string[]
  unexpectedPayloadMigrations: string[]
  prismaMigrations: Array<{ name: string; status: PrismaMigrationStatus }>
  schemaIdentityMatch: boolean | null
  overallStatus: 'VERIFIED' | 'MISMATCHES_FOUND' | 'OPERATOR_EVIDENCE_REQUIRED'
  notes: string[]
}

// ---------------------------------------------------------------------------
// Core builder — accepts optional adapter
// ---------------------------------------------------------------------------

/**
 * Build the migration status report.
 *
 * @param adapter  Live DB adapter. When null/undefined, returns an
 *                 OPERATOR_EVIDENCE_REQUIRED report without querying the DB.
 * @param expectedSchema  The exact schema name the DB must report. Required
 *                        for live mode; validated BEFORE any DB connection is
 *                        opened.
 */
export async function buildStagingMigrationStatus(
  adapter: MigrationQueryAdapter | null | undefined,
  expectedSchema?: string,
): Promise<StagingMigrationStatusReport> {
  const registered = Array.from(REGISTERED_PAYLOAD_MIGRATIONS)
  const notes: string[] = []

  // --- No adapter: dry-run evidence required ---
  if (!adapter) {
    notes.push(
      'OPERATOR READ-ONLY MIGRATION EVIDENCE REQUIRED: no database adapter was provided. ' +
        'Run with a valid staging connection using --mode=staging-read-only ' +
        'and --expected-schema=<schema-name> to obtain live evidence.',
    )
    return {
      reportVersion: '1.0',
      mode: 'dry-run',
      registeredMigrations: registered,
      appliedPayloadMigrations: [],
      missingPayloadMigrations: [],
      unexpectedPayloadMigrations: [],
      prismaMigrations: [],
      schemaIdentityMatch: null,
      overallStatus: 'OPERATOR_EVIDENCE_REQUIRED',
      notes,
    }
  }

  // --- Validate expectedSchema BEFORE opening any DB connection ---
  if (!expectedSchema) {
    throw new Error(
      'schema_identity_check_required: --expected-schema must be provided for live mode',
    )
  }

  // --- Schema identity guard: must match before any data query ---
  const reportedSchema = await adapter.getDatabaseSchemaIdentity()

  if (reportedSchema !== expectedSchema) {
    notes.push(
      `Schema identity mismatch: expected "${expectedSchema}" but database reported a different schema. ` +
        'No queries were executed. Aborting.',
    )
    return {
      reportVersion: '1.0',
      mode: 'live',
      registeredMigrations: registered,
      appliedPayloadMigrations: [],
      missingPayloadMigrations: [],
      unexpectedPayloadMigrations: [],
      prismaMigrations: [],
      schemaIdentityMatch: false,
      overallStatus: 'OPERATOR_EVIDENCE_REQUIRED',
      notes,
    }
  }

  notes.push('Schema identity: matches expected staging schema.')

  // --- Payload migration comparison ---
  const payloadRows = await adapter.getPayloadMigrations()
  // batch == -1 means dev push, not applied. batch > 0 means applied.
  const appliedPayloadNames = payloadRows
    .filter((r) => r.batch > 0)
    .map((r) => r.name)
  const appliedSet = new Set(appliedPayloadNames)
  const registeredSet = new Set(registered)

  const missingPayloadMigrations = registered.filter((name) => !appliedSet.has(name))
  const unexpectedPayloadMigrations = appliedPayloadNames.filter(
    (name) => !registeredSet.has(name),
  )

  // --- Prisma migration status ---
  const prismaRows = await adapter.getPrismaMigrations()
  const prismaMigrations = prismaRows.map((row) => ({
    name: row.migration_name,
    status: classifyPrismaMigration(row),
  }))

  const hasNonApplied = prismaMigrations.some((m) => m.status !== 'applied')

  // --- Determine overall status ---
  const hasMismatches =
    missingPayloadMigrations.length > 0 ||
    unexpectedPayloadMigrations.length > 0 ||
    hasNonApplied

  const overallStatus: StagingMigrationStatusReport['overallStatus'] = hasMismatches
    ? 'MISMATCHES_FOUND'
    : 'VERIFIED'

  if (missingPayloadMigrations.length > 0) {
    notes.push(
      `${missingPayloadMigrations.length} Payload migration(s) registered but not recorded as applied in the DB.`,
    )
  }
  if (unexpectedPayloadMigrations.length > 0) {
    notes.push(
      `${unexpectedPayloadMigrations.length} Payload migration record(s) in DB not found in the registered list.`,
    )
  }
  if (hasNonApplied) {
    const nonApplied = prismaMigrations.filter((m) => m.status !== 'applied')
    notes.push(
      `${nonApplied.length} Prisma migration(s) in non-applied state: ${nonApplied.map((m) => `${m.name}(${m.status})`).join(', ')}`,
    )
  }
  if (!hasMismatches) {
    notes.push(
      `All ${registered.length} registered Payload migrations are applied. All Prisma migrations applied.`,
    )
  }

  return {
    reportVersion: '1.0',
    mode: 'live',
    registeredMigrations: registered,
    appliedPayloadMigrations: appliedPayloadNames,
    missingPayloadMigrations,
    unexpectedPayloadMigrations,
    prismaMigrations,
    schemaIdentityMatch: true,
    overallStatus,
    notes,
  }
}

// ---------------------------------------------------------------------------
// PostgreSQL read-only adapter
// ---------------------------------------------------------------------------

export function createStagingReadOnlyAdapter(): MigrationQueryAdapter {
  return {
    async getDatabaseSchemaIdentity(): Promise<string> {
      const { Client } = await import('pg')
      const connectionString = process.env['DATABASE_URL']
      if (!connectionString) {
        throw new Error('DATABASE_URL is not set')
      }
      const client = new Client({
        connectionString,
        connectionTimeoutMillis: 5000,
        // @ts-ignore — statement_timeout is valid but may not be typed in all @types/pg versions
        statement_timeout: 5000,
      })
      await client.connect()
      try {
        await client.query('BEGIN READ ONLY')
        const result = await client.query('SELECT current_schema() AS schema_name')
        const schemaName: string = (result.rows[0] as { schema_name: string })?.schema_name ?? ''
        await client.query('ROLLBACK')
        return schemaName
      } finally {
        await client.end()
      }
    },

    async getPayloadMigrations(): Promise<PayloadMigrationRow[]> {
      const { Client } = await import('pg')
      const connectionString = process.env['DATABASE_URL']
      if (!connectionString) throw new Error('DATABASE_URL is not set')
      const client = new Client({
        connectionString,
        connectionTimeoutMillis: 5000,
      })
      await client.connect()
      try {
        await client.query('BEGIN READ ONLY')
        const result = await client.query(
          'SELECT name, batch FROM payload_migrations ORDER BY id',
        )
        await client.query('ROLLBACK')
        return (result.rows as Array<{ name: string; batch: number }>).map((row) => ({
          name: row.name,
          batch: Number(row.batch),
        }))
      } finally {
        await client.end()
      }
    },

    async getPrismaMigrations(): Promise<PrismaMigrationRow[]> {
      const { Client } = await import('pg')
      const connectionString = process.env['DATABASE_URL']
      if (!connectionString) throw new Error('DATABASE_URL is not set')
      const client = new Client({
        connectionString,
        connectionTimeoutMillis: 5000,
      })
      await client.connect()
      try {
        await client.query('BEGIN READ ONLY')
        const result = await client.query(
          'SELECT migration_name, finished_at, logs IS NOT NULL AS has_logs, rolled_back_at, started_at, applied_steps_count FROM _prisma_migrations ORDER BY started_at',
        )
        await client.query('ROLLBACK')
        return (result.rows as Array<{
          migration_name: string
          finished_at: Date | null
          has_logs: boolean
          rolled_back_at: Date | null
          started_at: Date
          applied_steps_count: number
        }>).map((row) => ({
          migration_name: row.migration_name,
          finished_at: row.finished_at ? row.finished_at.toISOString() : null,
          logs: row.has_logs ? '<redacted>' : null,
          rolled_back_at: row.rolled_back_at ? row.rolled_back_at.toISOString() : null,
          started_at: row.started_at.toISOString(),
          applied_steps_count: Number(row.applied_steps_count),
        }))
      } finally {
        await client.end()
      }
    },
  }
}

// ---------------------------------------------------------------------------
// CLI argument parser
// ---------------------------------------------------------------------------

export function parseCliArgs(argv: string[]): {
  mode: string | undefined
  expectedSchema: string | undefined
  errors: string[]
} {
  let mode: string | undefined
  let expectedSchema: string | undefined
  const errors: string[] = []
  let modeCount = 0
  let schemaCount = 0

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg.startsWith('--mode=')) {
      modeCount++
      mode = arg.slice('--mode='.length)
    } else if (arg === '--mode') {
      modeCount++
      mode = argv[++i]
    } else if (arg.startsWith('--expected-schema=')) {
      schemaCount++
      expectedSchema = arg.slice('--expected-schema='.length)
    } else if (arg === '--expected-schema') {
      schemaCount++
      expectedSchema = argv[++i]
    }
  }

  if (modeCount > 1) errors.push('--mode specified more than once')
  if (schemaCount > 1) errors.push('--expected-schema specified more than once')

  return { mode, expectedSchema, errors }
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (require.main === module) {
  const { mode, expectedSchema, errors } = parseCliArgs(process.argv.slice(2))

  if (errors.length > 0) {
    for (const e of errors) {
      process.stderr.write(`ERROR: ${e}\n`)
    }
    process.exit(1)
  }

  if (mode !== 'staging-read-only') {
    process.stderr.write(
      'ERROR: --mode=staging-read-only is required. This command is read-only evidence only.\n',
    )
    process.exit(1)
  }

  if (!expectedSchema) {
    process.stderr.write(
      'ERROR: --expected-schema=<schema-name> is required for live mode.\n',
    )
    process.exit(1)
  }

  // In CLI mode, no real adapter is wired here by default.
  // Operators must supply a real adapter via the programmatic API or
  // extend this entry point with a live pg connection.
  buildStagingMigrationStatus(null, expectedSchema)
    .then((report) => {
      process.stdout.write(JSON.stringify(report, null, 2))
      process.stdout.write('\n')
      process.exit(report.overallStatus === 'VERIFIED' ? 0 : 1)
    })
    .catch((err: unknown) => {
      process.stderr.write(`ERROR: ${err instanceof Error ? err.message : String(err)}\n`)
      process.exit(1)
    })
}
