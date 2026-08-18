import { Client } from 'pg'
import fs from 'node:fs'
import path from 'node:path'

import {
  quoteDatabaseIdentifier,
  resolveDatabaseConnectionConfig,
  validateDatabaseSchemaIdentifier,
} from '../../src/lib/databaseConnectionConfig'
import { PAYLOAD_MIGRATION_NAMES } from '../../src/lib/payloadMigrationRegistry'

export type PayloadMigrationRow = {
  name: string
  batch: number | string
}

export type PrismaMigrationRow = {
  migration_name: string
  started_at: string | null
  finished_at: string | null
  rolled_back_at: string | null
  applied_steps_count: number | string
  has_logs: boolean
}

export type PrismaMigrationStatus =
  | 'applied'
  | 'failed'
  | 'in-progress'
  | 'rolled-back'
  | 'unexpected'

export type ClassifiedPrismaMigration = {
  migrationName: string
  status: PrismaMigrationStatus
  appliedStepsCount: number
}

export type MigrationEvidence = {
  schemaIdentity: string | null
  payloadMigrations: PayloadMigrationRow[]
  prismaMigrations: PrismaMigrationRow[]
}

export interface MigrationEvidenceAdapter {
  collectMigrationEvidence(expectedSchema: string): Promise<MigrationEvidence>
}

export type StagingMigrationStatusResult =
  | 'VERIFIED'
  | 'MISMATCH'
  | 'OPERATOR_EVIDENCE_REQUIRED'

export type PayloadMigrationRecord = {
  name: string
  batch: number
}

export type MalformedPayloadMigrationRecord = {
  rowIndex: number
  reason: 'invalid_name' | 'invalid_batch'
}

export type StagingMigrationStatusReport = {
  result: StagingMigrationStatusResult
  schemaIdentity: string | null
  registeredPayloadMigrations: string[]
  appliedPayloadMigrations: string[]
  payloadMigrationRecords: PayloadMigrationRecord[]
  malformedPayloadMigrationRecords: MalformedPayloadMigrationRecord[]
  missingPayloadMigrations: string[]
  unexpectedPayloadMigrations: string[]
  registeredPrismaMigrations: string[]
  missingPrismaMigrations: string[]
  unexpectedPrismaMigrations: string[]
  prismaMigrations: ClassifiedPrismaMigration[]
  blockers: string[]
}

export const REGISTERED_PAYLOAD_MIGRATIONS = PAYLOAD_MIGRATION_NAMES
export const REGISTERED_PRISMA_MIGRATIONS = fs.readdirSync(
  path.resolve(import.meta.dirname, '../../prisma/migrations'),
  { withFileTypes: true },
).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()

function normalizePrismaAppliedStepsCount(value: number | string): number | null {
  if (typeof value === 'number') {
    return value
  }
  if (typeof value === 'string' && value.length > 0 && /^\d+$/.test(value)) {
    return Number.parseInt(value, 10)
  }
  return null
}

export function classifyPrismaMigration(row: PrismaMigrationRow): PrismaMigrationStatus {
  if (row.rolled_back_at) return 'rolled-back'
  if (!row.started_at) return 'unexpected'
  if (!row.finished_at) return 'in-progress'

  const stepsCount = normalizePrismaAppliedStepsCount(row.applied_steps_count)
  if (!Number.isInteger(stepsCount) || stepsCount < 0) return 'unexpected'
  return 'applied'
}

export async function buildStagingMigrationStatus(
  adapter: MigrationEvidenceAdapter | null,
  expectedSchema: string,
): Promise<StagingMigrationStatusReport> {
  const safeExpectedSchema = validateDatabaseSchemaIdentifier(expectedSchema)
  const registered = [...REGISTERED_PAYLOAD_MIGRATIONS]

  if (!adapter) {
    return {
      result: 'OPERATOR_EVIDENCE_REQUIRED',
      schemaIdentity: null,
      registeredPayloadMigrations: registered,
      appliedPayloadMigrations: [],
      payloadMigrationRecords: [],
      malformedPayloadMigrationRecords: [],
      missingPayloadMigrations: registered,
      unexpectedPayloadMigrations: [],
      registeredPrismaMigrations: [...REGISTERED_PRISMA_MIGRATIONS],
      missingPrismaMigrations: [...REGISTERED_PRISMA_MIGRATIONS],
      unexpectedPrismaMigrations: [],
      prismaMigrations: [],
      blockers: ['Operator-authorized read-only staging database evidence is required'],
    }
  }

  const evidence = await adapter.collectMigrationEvidence(safeExpectedSchema)

  // Classify every raw row — never silently discard.
  const payloadMigrationRecords: PayloadMigrationRecord[] = []
  const malformedPayloadMigrationRecords: MalformedPayloadMigrationRecord[] = []
  const namesSeen = new Set<string>()

  for (let rowIndex = 0; rowIndex < evidence.payloadMigrations.length; rowIndex += 1) {
    const row = evidence.payloadMigrations[rowIndex]
    const nameValid =
      typeof row.name === 'string' &&
      row.name.length > 0 &&
      !/[\x00-\x1f\x7f]/.test(row.name)

    // Normalize numeric string (from node-postgres numeric column) to number.
    // Reject null, undefined, empty strings, non-numeric strings, non-integers, or values < 1.
    let batchNumber: number | null = null
    let batchValid = false
    if (typeof row.batch === 'number') {
      batchNumber = row.batch
      batchValid = Number.isSafeInteger(batchNumber) && batchNumber >= 1
    } else if (typeof row.batch === 'string' && row.batch.length > 0) {
      // Safely parse string batch from node-postgres numeric column.
      // Reject leading zeros, whitespace, '+' prefix, or any non-numeric chars.
      if (/^\d+$/.test(row.batch)) {
        batchNumber = Number.parseInt(row.batch, 10)
        batchValid = Number.isSafeInteger(batchNumber) && batchNumber >= 1
      }
    }

    if (!nameValid) {
      malformedPayloadMigrationRecords.push({ rowIndex, reason: 'invalid_name' })
      continue
    }
    // Track the name even when batch is invalid, so later rows with the same name
    // are detected as duplicates regardless of which row was first malformed.
    const isDuplicate = namesSeen.has(row.name)
    namesSeen.add(row.name)
    if (isDuplicate) {
      malformedPayloadMigrationRecords.push({ rowIndex, reason: 'invalid_name' })
      continue
    }
    if (!batchValid) {
      malformedPayloadMigrationRecords.push({ rowIndex, reason: 'invalid_batch' })
      continue
    }
    // batchNumber is guaranteed to be a safe integer >= 1 by the above checks
    payloadMigrationRecords.push({ name: row.name, batch: batchNumber! })
  }

  const appliedPayloadMigrations = payloadMigrationRecords.map((row) => row.name)
  const appliedSet = new Set(appliedPayloadMigrations)
  const registeredSet = new Set<string>(registered)
  const missingPayloadMigrations = registered.filter((name) => !appliedSet.has(name))
  const unexpectedPayloadMigrations = appliedPayloadMigrations.filter((name) => !registeredSet.has(name))
  const prismaMigrations = evidence.prismaMigrations.map((row) => ({
    migrationName: row.migration_name,
    status: classifyPrismaMigration(row),
    appliedStepsCount: normalizePrismaAppliedStepsCount(row.applied_steps_count) ?? 0,
  }))
  const registeredPrismaSet = new Set(REGISTERED_PRISMA_MIGRATIONS)
  const evidencedPrismaNames = prismaMigrations.map((row) => row.migrationName)
  const evidencedPrismaSet = new Set(evidencedPrismaNames)
  const missingPrismaMigrations = REGISTERED_PRISMA_MIGRATIONS.filter((name) => !evidencedPrismaSet.has(name))
  const unexpectedPrismaMigrations = evidencedPrismaNames.filter((name) => !registeredPrismaSet.has(name))

  const blockers: string[] = []
  if (malformedPayloadMigrationRecords.length > 0) blockers.push('Malformed Payload migration evidence exists')
  if (evidence.schemaIdentity !== safeExpectedSchema) blockers.push('Database schema identity mismatch')
  if (missingPayloadMigrations.length > 0) blockers.push('Registered Payload migrations are missing from applied-state evidence')
  if (unexpectedPayloadMigrations.length > 0) blockers.push('Unexpected Payload migration records exist')
  if (prismaMigrations.length === 0) blockers.push('Prisma migration evidence is empty')
  if (missingPrismaMigrations.length > 0) blockers.push('Registered Prisma migrations are missing from applied-state evidence')
  if (unexpectedPrismaMigrations.length > 0) blockers.push('Unexpected Prisma migration records exist')
  if (evidencedPrismaSet.size !== evidencedPrismaNames.length) blockers.push('Duplicate Prisma migration records exist')
  if (prismaMigrations.some((row) => row.status !== 'applied')) {
    blockers.push('One or more Prisma migrations are failed, unfinished, rolled back, or malformed')
  }

  return {
    result: blockers.length === 0 ? 'VERIFIED' : 'MISMATCH',
    schemaIdentity: evidence.schemaIdentity,
    registeredPayloadMigrations: registered,
    appliedPayloadMigrations,
    payloadMigrationRecords,
    malformedPayloadMigrationRecords,
    missingPayloadMigrations,
    unexpectedPayloadMigrations,
    registeredPrismaMigrations: [...REGISTERED_PRISMA_MIGRATIONS],
    missingPrismaMigrations,
    unexpectedPrismaMigrations,
    prismaMigrations,
    blockers,
  }
}

export interface PgClientLike {
  connect(): Promise<void>
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: Row[] }>
  end(): Promise<void>
}

export type PgClientFactory = (config: {
  connectionString: string
  connectionTimeoutMillis: number
}) => PgClientLike

function defaultPgClientFactory(config: {
  connectionString: string
  connectionTimeoutMillis: number
}): PgClientLike {
  return new Client(config) as unknown as PgClientLike
}

export type StagingReadOnlyAdapterOptions = {
  databaseUrl: string
  expectedSchema: string
  schemaOverride?: string
  connectionTimeoutMillis?: number
  statementTimeoutMillis?: number
  clientFactory?: PgClientFactory
}

function validateShortTimeout(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 1 || value > 30_000) {
    throw new Error(`${label} must be a positive integer no greater than 30000ms`)
  }
  return value
}

export function createStagingReadOnlyAdapter(
  options: StagingReadOnlyAdapterOptions,
): MigrationEvidenceAdapter {
  const expectedSchema = validateDatabaseSchemaIdentifier(options.expectedSchema)
  const database = resolveDatabaseConnectionConfig(options.databaseUrl, options.schemaOverride)
  if (!database.connectionString) throw new Error('Staging database connection is not configured')
  if (database.metadata.protocol !== 'postgres:' && database.metadata.protocol !== 'postgresql:') {
    throw new Error('Staging database connection must use PostgreSQL')
  }
  if (database.schema !== expectedSchema) throw new Error('Configured database schema does not match the expected staging schema')

  const schemaIdentifier = quoteDatabaseIdentifier(expectedSchema)
  const clientFactory = options.clientFactory ?? defaultPgClientFactory
  const connectionTimeoutMillis = validateShortTimeout(options.connectionTimeoutMillis ?? 5_000, 'Connection timeout')
  const statementTimeoutMillis = validateShortTimeout(options.statementTimeoutMillis ?? 5_000, 'Statement timeout')

  return {
    async collectMigrationEvidence(requestedSchema: string): Promise<MigrationEvidence> {
      const safeRequestedSchema = validateDatabaseSchemaIdentifier(requestedSchema)
      if (safeRequestedSchema !== expectedSchema) throw new Error('Requested schema does not match the guarded staging schema')

      const client = clientFactory({
        connectionString: database.connectionString,
        connectionTimeoutMillis,
      })
      let transactionStarted = false
      let primaryError: unknown = null

      try {
        await client.connect()
        await client.query('BEGIN TRANSACTION READ ONLY')
        transactionStarted = true
        await client.query(`SET LOCAL statement_timeout = '${statementTimeoutMillis}ms'`)
        await client.query(`SET LOCAL search_path TO ${schemaIdentifier}`)

        const schemaResult = await client.query<{ current_schema: string | null }>(
          'SELECT current_schema() AS current_schema',
        )
        const schemaIdentity = schemaResult.rows[0]?.current_schema ?? null
        if (schemaIdentity !== expectedSchema) {
          throw new Error('Database-reported schema does not match the expected staging schema')
        }

        const payloadResult = await client.query<PayloadMigrationRow>(
          `SELECT name, batch FROM ${schemaIdentifier}.payload_migrations ORDER BY id ASC`,
        )
        const prismaResult = await client.query<PrismaMigrationRow>(
          `SELECT migration_name, started_at, finished_at, rolled_back_at, applied_steps_count, (logs IS NOT NULL) AS has_logs FROM ${schemaIdentifier}._prisma_migrations ORDER BY started_at ASC`,
        )

        return {
          schemaIdentity,
          payloadMigrations: payloadResult.rows.map((row) => ({ name: row.name, batch: row.batch })),
          prismaMigrations: prismaResult.rows.map((row) => ({
            migration_name: row.migration_name,
            started_at: row.started_at,
            finished_at: row.finished_at,
            rolled_back_at: row.rolled_back_at,
            applied_steps_count: row.applied_steps_count,
            has_logs: Boolean(row.has_logs),
          })),
        }
      } catch (error: unknown) {
        primaryError = error
        if (error instanceof Error && error.message === 'Database-reported schema does not match the expected staging schema') {
          throw error
        }
        throw new Error('Read-only staging migration query failed')
      } finally {
        let cleanupError: Error | null = null
        if (transactionStarted) {
          try {
            await client.query('ROLLBACK')
          } catch {
            if (!primaryError) cleanupError = new Error('Read-only staging migration rollback failed')
          }
        }
        try {
          await client.end()
        } catch {
          if (!primaryError && !cleanupError) {
            cleanupError = new Error('Read-only staging migration connection close failed')
          }
        }
        if (cleanupError) throw cleanupError
      }
    },
  }
}

export type MigrationStatusCliArgs = {
  help: boolean
  mode: string | null
  expectedSchema: string | null
  acknowledgeReadOnly: boolean
}

export function parseCliArgs(args: string[]): MigrationStatusCliArgs {
  const parsed: MigrationStatusCliArgs = {
    help: false,
    mode: null,
    expectedSchema: null,
    acknowledgeReadOnly: false,
  }
  const seen = new Set<string>()

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--help' || arg === '-h') {
      if (seen.has('help')) throw new Error('Duplicate help flag')
      seen.add('help')
      parsed.help = true
      continue
    }
    if (arg === '--acknowledge-read-only') {
      if (seen.has('acknowledge')) throw new Error('Duplicate read-only acknowledgement')
      seen.add('acknowledge')
      parsed.acknowledgeReadOnly = true
      continue
    }

    const equalsIndex = arg.indexOf('=')
    const [flag, equalsValue] = equalsIndex >= 0
      ? [arg.slice(0, equalsIndex), arg.slice(equalsIndex + 1)]
      : [arg, undefined]
    if (flag !== '--mode' && flag !== '--expected-schema') {
      throw new Error('Unknown or positional argument')
    }
    if (seen.has(flag)) throw new Error(`Duplicate ${flag} flag`)
    seen.add(flag)
    const value = equalsValue !== undefined ? equalsValue : args[++index]
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`)
    if (flag === '--mode') parsed.mode = value
    if (flag === '--expected-schema') parsed.expectedSchema = value
  }

  if (parsed.expectedSchema !== null) {
    parsed.expectedSchema = validateDatabaseSchemaIdentifier(parsed.expectedSchema)
  }
  return parsed
}

export const MIGRATION_STATUS_USAGE = [
  'Usage: pnpm staging:migration-status -- --mode=staging-read-only --expected-schema=<schema> --acknowledge-read-only',
  'This command performs read-only migration metadata queries only.',
].join('\n')

export type MigrationStatusCliDependencies = {
  clientFactory?: PgClientFactory
}

export async function runMigrationStatusCli(
  args: string[],
  environment: NodeJS.ProcessEnv = process.env,
  output: (value: string) => void = console.log,
  dependencies: MigrationStatusCliDependencies = {},
): Promise<number> {
  let parsed: MigrationStatusCliArgs
  try {
    parsed = parseCliArgs(args)
  } catch {
    output(MIGRATION_STATUS_USAGE)
    return 1
  }

  if (parsed.help) {
    output(MIGRATION_STATUS_USAGE)
    return 0
  }
  if (parsed.mode !== 'staging-read-only' || !parsed.expectedSchema || !parsed.acknowledgeReadOnly) {
    output(MIGRATION_STATUS_USAGE)
    return 1
  }

  const databaseUrl = environment.DATABASE_URL?.trim()
  if (!databaseUrl) {
    const report = await buildStagingMigrationStatus(null, parsed.expectedSchema)
    output(JSON.stringify(report, null, 2))
    return 3
  }

  try {
    const adapter = createStagingReadOnlyAdapter({
      databaseUrl,
      expectedSchema: parsed.expectedSchema,
      schemaOverride: environment.PAYLOAD_MIGRATION_SCHEMA,
      clientFactory: dependencies.clientFactory,
    })
    const report = await buildStagingMigrationStatus(adapter, parsed.expectedSchema)
    output(JSON.stringify(report, null, 2))
    return report.result === 'VERIFIED' ? 0 : 2
  } catch {
    output(JSON.stringify({ result: 'ERROR', message: 'Staging migration status could not be collected' }))
    return 1
  }
}

if (require.main === module) {
  runMigrationStatusCli(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode
  }).catch(() => {
    console.error(JSON.stringify({ result: 'ERROR', message: 'Staging migration status could not be collected' }))
    process.exitCode = 1
  })
}
