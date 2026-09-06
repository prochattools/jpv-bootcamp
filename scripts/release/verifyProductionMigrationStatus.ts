import { Client } from 'pg'

import {
  assertProductionSchema,
  quoteDatabaseIdentifier,
  resolveDatabaseConnectionConfig,
  validateDatabaseSchemaIdentifier,
} from '../../src/lib/databaseConnectionConfig'
import { ENVIRONMENT_TOPOLOGY } from '../../src/lib/environmentTopology'
import {
  buildStagingMigrationStatus,
  REGISTERED_PAYLOAD_MIGRATIONS,
  REGISTERED_PRISMA_MIGRATIONS,
  type PayloadMigrationRow,
  type MigrationEvidence,
  type MigrationEvidenceAdapter,
  type PgClientFactory,
  type PgClientLike,
  type PrismaMigrationRow,
} from './buildStagingMigrationStatus'

const PRODUCTION = ENVIRONMENT_TOPOLOGY.production
const FULL_SHA = /^[0-9a-f]{40}$/
const PRODUCTION_HEALTH_URL = `${PRODUCTION.origin}/api/health/deployment`

export type ProductionRevisionEvidence = {
  expectedSha: string
  observedCommitSha: string | null
  observedImageTag: string | null
  source: 'deployment-health'
}

export type ProductionMigrationStatusReport = {
  result: 'VERIFIED' | 'MISMATCH' | 'OPERATOR_EVIDENCE_REQUIRED' | 'ERROR'
  mode: 'production-read-only'
  target: {
    origin: string
    database: string
    schema: string
    role: string
  }
  deployedRevision: ProductionRevisionEvidence | null
  migrationLedger: {
    payload: {
      expected: string[]
      applied: string[]
      pending: string[]
      unexpected: string[]
      duplicate: string[]
      malformedRows: number
      orderingAnomalies: string[]
    }
    prisma: {
      expected: string[]
      pending: string[]
      unexpected: string[]
      duplicate: string[]
      statuses: Array<{ name: string; status: string }>
    }
  }
  rollbackReadiness: {
    mutationPerformed: false
    readOnlyTransaction: true
    action: 'none'
    note: string
  }
  blockers: string[]
}

export type ProductionReadOnlyAdapterOptions = {
  databaseUrl: string
  expectedSchema: string
  connectionTimeoutMillis?: number
  statementTimeoutMillis?: number
  clientFactory?: PgClientFactory
}

function defaultPgClientFactory(config: {
  connectionString: string
  connectionTimeoutMillis: number
}): PgClientLike {
  return new Client(config) as unknown as PgClientLike
}

function validateTimeout(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 1 || value > 30_000) {
    throw new Error(`${label} must be a positive integer no greater than 30000ms`)
  }
  return value
}

function safeProductionUrl(rawUrl: string, expectedSchema: string): {
  connectionString: string
} {
  const config = resolveDatabaseConnectionConfig(rawUrl, undefined)
  assertProductionSchema(config)

  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error('Production database URL is invalid')
  }

  const schemaParams = parsed.searchParams.getAll('schema')
  const port = parsed.port || '5432'
  const database = parsed.pathname.replace(/^\//, '')
  const role = decodeURIComponent(parsed.username || '')
  if (
    schemaParams.length !== 1 ||
    schemaParams[0] !== expectedSchema ||
    parsed.hostname !== PRODUCTION.databaseHost ||
    port !== PRODUCTION.databasePort ||
    database !== PRODUCTION.database ||
    role !== PRODUCTION.databaseRole
  ) {
    throw new Error('Production database boundary mismatch')
  }
  return { connectionString: config.connectionString }
}

export function createProductionReadOnlyAdapter(
  options: ProductionReadOnlyAdapterOptions,
): MigrationEvidenceAdapter {
  const expectedSchema = validateDatabaseSchemaIdentifier(options.expectedSchema)
  if (expectedSchema !== PRODUCTION.schema) throw new Error('Production schema mismatch')
  const database = safeProductionUrl(options.databaseUrl, expectedSchema)
  const schemaIdentifier = quoteDatabaseIdentifier(expectedSchema)
  const clientFactory = options.clientFactory ?? defaultPgClientFactory
  const connectionTimeoutMillis = validateTimeout(options.connectionTimeoutMillis ?? 5_000, 'Connection timeout')
  const statementTimeoutMillis = validateTimeout(options.statementTimeoutMillis ?? 5_000, 'Statement timeout')

  return {
    async collectMigrationEvidence(requestedSchema: string): Promise<MigrationEvidence> {
      const safeRequestedSchema = validateDatabaseSchemaIdentifier(requestedSchema)
      if (safeRequestedSchema !== expectedSchema) throw new Error('Requested schema does not match production')

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

        const identityResult = await client.query<{
          database: string | null
          schema: string | null
          role: string | null
        }>('SELECT current_database() AS database, current_schema() AS schema, current_user AS role')
        const identity = identityResult.rows[0]
        if (
          identity?.database !== PRODUCTION.database ||
          identity.schema !== expectedSchema ||
          identity.role !== PRODUCTION.databaseRole
        ) {
          throw new Error('Database-reported production identity mismatch')
        }

        const payloadResult = await client.query<PayloadMigrationRow>(
          `SELECT name, batch FROM ${schemaIdentifier}.payload_migrations ORDER BY id ASC`,
        )
        const prismaResult = await client.query<PrismaMigrationRow>(
          `SELECT migration_name, started_at, finished_at, rolled_back_at, applied_steps_count, (logs IS NOT NULL) AS has_logs FROM ${schemaIdentifier}._prisma_migrations ORDER BY started_at ASC`,
        )

        return {
          schemaIdentity: identity.schema,
          payloadMigrations: payloadResult.rows.map((row) => ({
            name: row.name,
            batch: row.batch,
          })),
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
        throw new Error('Read-only production migration query failed')
      } finally {
        let cleanupError: Error | null = null
        if (transactionStarted) {
          try {
            await client.query('ROLLBACK')
          } catch {
            if (!primaryError) cleanupError = new Error('Read-only production rollback failed')
          }
        }
        try {
          await client.end()
        } catch {
          if (!primaryError && !cleanupError) cleanupError = new Error('Read-only production connection close failed')
        }
        if (cleanupError) throw cleanupError
      }
    },
  }
}

export type ProductionRevisionReader = (expectedSha: string) => Promise<ProductionRevisionEvidence>

function parseOptionalRevisionField(value: unknown, label: string): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' && FULL_SHA.test(value)) return value
  throw new Error(`Production deployment ${label} is invalid`)
}

export async function readProductionRevision(expectedSha: string): Promise<ProductionRevisionEvidence> {
  const response = await fetch(PRODUCTION_HEALTH_URL, {
    method: 'GET',
    headers: { accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error('Production deployment health is unavailable')
  const body: unknown = await response.json()
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Production deployment health response is invalid')
  }
  const record = body as Record<string, unknown>
  const observedCommitSha = parseOptionalRevisionField(record.commitSha, 'commit SHA')
  const observedImageTag = parseOptionalRevisionField(record.imageTag, 'image tag')
  if (!observedCommitSha && !observedImageTag) throw new Error('Production deployment revision is absent')
  return { expectedSha, observedCommitSha, observedImageTag, source: 'deployment-health' }
}

function blankReport(result: ProductionMigrationStatusReport['result'], blockers: string[]): ProductionMigrationStatusReport {
  return {
    result,
    mode: 'production-read-only',
    target: {
      origin: PRODUCTION.origin,
      database: PRODUCTION.database,
      schema: PRODUCTION.schema,
      role: PRODUCTION.databaseRole,
    },
    deployedRevision: null,
    migrationLedger: {
      payload: {
        expected: [...REGISTERED_PAYLOAD_MIGRATIONS],
        applied: [],
        pending: [...REGISTERED_PAYLOAD_MIGRATIONS],
        unexpected: [],
        duplicate: [],
        malformedRows: 0,
        orderingAnomalies: [],
      },
      prisma: {
        expected: [...REGISTERED_PRISMA_MIGRATIONS],
        pending: [...REGISTERED_PRISMA_MIGRATIONS],
        unexpected: [],
        duplicate: [],
        statuses: [],
      },
    },
    rollbackReadiness: {
      mutationPerformed: false,
      readOnlyTransaction: true,
      action: 'none',
      note: 'No production migration, schema, data, or deployment mutation is performed by this command.',
    },
    blockers,
  }
}

export async function buildProductionMigrationStatus(
  adapter: MigrationEvidenceAdapter | null,
  expectedSchema: string,
  expectedSha: string,
  revisionReader: ProductionRevisionReader | null = readProductionRevision,
): Promise<ProductionMigrationStatusReport> {
  const safeExpectedSchema = validateDatabaseSchemaIdentifier(expectedSchema)
  if (safeExpectedSchema !== PRODUCTION.schema) throw new Error('Production schema mismatch')
  if (!FULL_SHA.test(expectedSha)) throw new Error('Expected production revision is invalid')
  if (!adapter || !revisionReader) return blankReport('OPERATOR_EVIDENCE_REQUIRED', ['Operator-authorized production database and deployment-health evidence is required'])

  let revision: ProductionRevisionEvidence
  try {
    revision = await revisionReader(expectedSha)
  } catch {
    return blankReport('OPERATOR_EVIDENCE_REQUIRED', ['Production deployment revision evidence is unavailable'])
  }

  const observedRevisions = [revision.observedCommitSha, revision.observedImageTag].filter(
    (value): value is string => value !== null,
  )
  const revisionMatches = observedRevisions.length > 0 && observedRevisions.every((value) => value === expectedSha)
  let status
  try {
    status = await buildStagingMigrationStatus(adapter, safeExpectedSchema)
  } catch {
    return {
      ...blankReport('ERROR', ['Production migration evidence could not be collected']),
      deployedRevision: revision,
    }
  }

  const blockers = [...status.blockers]
  if (!revisionMatches) blockers.unshift('Deployed production revision does not match the expected revision')
  const report: ProductionMigrationStatusReport = {
    result: blockers.length === 0 ? 'VERIFIED' : 'MISMATCH',
    mode: 'production-read-only',
    target: {
      origin: PRODUCTION.origin,
      database: PRODUCTION.database,
      schema: safeExpectedSchema,
      role: PRODUCTION.databaseRole,
    },
    deployedRevision: revision,
    migrationLedger: {
      payload: {
        expected: status.registeredPayloadMigrations,
        applied: status.appliedPayloadMigrations,
        pending: status.missingPayloadMigrations,
        unexpected: status.unexpectedPayloadMigrations,
        duplicate: status.duplicatePayloadMigrations,
        malformedRows: status.malformedPayloadMigrationRecords.length,
        orderingAnomalies: status.orderingAnomalies,
      },
      prisma: {
        expected: status.registeredPrismaMigrations,
        pending: status.missingPrismaMigrations,
        unexpected: status.unexpectedPrismaMigrations,
        duplicate: status.prismaMigrations
          .map((row) => row.migrationName)
          .filter((name, index, names) => names.indexOf(name) !== index),
        statuses: status.prismaMigrations.map((row) => ({ name: row.migrationName, status: row.status })),
      },
    },
    rollbackReadiness: {
      mutationPerformed: false,
      readOnlyTransaction: true,
      action: 'none',
      note: 'No production migration, schema, data, or deployment mutation is performed by this command.',
    },
    blockers,
  }
  return report
}

export type ProductionMigrationStatusCliArgs = {
  help: boolean
  mode: string | null
  expectedSchema: string | null
  acknowledgeReadOnly: boolean
}

export function parseProductionCliArgs(args: string[]): ProductionMigrationStatusCliArgs {
  const parsed: ProductionMigrationStatusCliArgs = {
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
    const flag = equalsIndex >= 0 ? arg.slice(0, equalsIndex) : arg
    if (flag !== '--mode' && flag !== '--expected-schema') throw new Error('Unknown or positional argument')
    if (seen.has(flag)) throw new Error(`Duplicate ${flag} flag`)
    seen.add(flag)
    const value = equalsIndex >= 0 ? arg.slice(equalsIndex + 1) : args[++index]
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`)
    if (flag === '--mode') parsed.mode = value
    if (flag === '--expected-schema') parsed.expectedSchema = validateDatabaseSchemaIdentifier(value)
  }
  return parsed
}

export const PRODUCTION_MIGRATION_STATUS_USAGE = [
  'Usage: DEPLOYMENT_ENV=production EXPECTED_DEPLOYMENT_SHA=<40-char-sha> pnpm production:migration-status:read-only -- --mode=production-read-only --expected-schema=jpvbootcamp --acknowledge-read-only',
  'This command performs only read-only production migration metadata queries and a deployment-health GET.',
].join('\n')

export type ProductionMigrationStatusCliDependencies = {
  clientFactory?: PgClientFactory
  revisionReader?: ProductionRevisionReader
}

export async function runProductionMigrationStatusCli(
  args: string[],
  environment: NodeJS.ProcessEnv = process.env,
  output: (value: string) => void = console.log,
  dependencies: ProductionMigrationStatusCliDependencies = {},
): Promise<number> {
  let parsed: ProductionMigrationStatusCliArgs
  try {
    parsed = parseProductionCliArgs(args)
  } catch {
    output(PRODUCTION_MIGRATION_STATUS_USAGE)
    return 1
  }
  if (parsed.help) {
    output(PRODUCTION_MIGRATION_STATUS_USAGE)
    return 0
  }
  if (parsed.mode !== 'production-read-only' || parsed.expectedSchema !== PRODUCTION.schema || !parsed.acknowledgeReadOnly) {
    output(PRODUCTION_MIGRATION_STATUS_USAGE)
    return 1
  }
  if (environment.DEPLOYMENT_ENV?.trim() !== PRODUCTION.deploymentEnv) {
    output(JSON.stringify(blankReport('ERROR', ['DEPLOYMENT_ENV must be exactly production'])))
    return 1
  }
  const expectedSha = environment.EXPECTED_DEPLOYMENT_SHA?.trim() ?? ''
  if (!FULL_SHA.test(expectedSha)) {
    output(JSON.stringify(blankReport('OPERATOR_EVIDENCE_REQUIRED', ['EXPECTED_DEPLOYMENT_SHA must be a full lowercase 40-character SHA'])))
    return 3
  }
  const databaseUrl = environment.DATABASE_URL?.trim()
  if (!databaseUrl) {
    output(JSON.stringify(blankReport('OPERATOR_EVIDENCE_REQUIRED', ['DATABASE_URL must be supplied by the governed production runtime'])))
    return 3
  }
  try {
    const adapter = createProductionReadOnlyAdapter({
      databaseUrl,
      expectedSchema: parsed.expectedSchema,
      clientFactory: dependencies.clientFactory,
    })
    const report = await buildProductionMigrationStatus(
      adapter,
      parsed.expectedSchema,
      expectedSha,
      dependencies.revisionReader,
    )
    output(JSON.stringify(report, null, 2))
    return report.result === 'VERIFIED' ? 0 : report.result === 'OPERATOR_EVIDENCE_REQUIRED' ? 3 : report.result === 'ERROR' ? 1 : 2
  } catch {
    output(JSON.stringify(blankReport('ERROR', ['Production migration status could not be collected'])))
    return 1
  }
}

if (require.main === module) {
  runProductionMigrationStatusCli(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode
  }).catch(() => {
    console.error(JSON.stringify(blankReport('ERROR', ['Production migration status could not be collected'])))
    process.exitCode = 1
  })
}
