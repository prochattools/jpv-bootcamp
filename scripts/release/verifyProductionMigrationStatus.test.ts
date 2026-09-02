import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { PAYLOAD_MIGRATION_NAMES } from '../../src/lib/payloadMigrationRegistry'
import { ENVIRONMENT_TOPOLOGY } from '../../src/lib/environmentTopology'
import {
  REGISTERED_PRISMA_MIGRATIONS,
  type PgClientLike,
} from './buildStagingMigrationStatus'
import {
  buildProductionMigrationStatus,
  createProductionReadOnlyAdapter,
  parseProductionCliArgs,
  runProductionMigrationStatusCli,
  type ProductionRevisionEvidence,
} from './verifyProductionMigrationStatus'

const EXPECTED_SHA = 'f93ffac7dd299c39d8daf242d6a436272cc79188'
const PRODUCTION_DATABASE_URL = 'postgresql://jpvbootcamp_production_app:synthetic-secret@10.0.2.4:5433/jpvbootcamp?schema=jpvbootcamp'

function appliedPrisma(name: string) {
  return {
    migration_name: name,
    started_at: '2026-09-01T00:00:00.000Z',
    finished_at: '2026-09-01T00:00:01.000Z',
    rolled_back_at: null,
    applied_steps_count: 1,
    has_logs: false,
  }
}

class RecordingClient implements PgClientLike {
  readonly queries: string[] = []
  connectCalls = 0
  endCalls = 0
  fail = false

  async connect(): Promise<void> {
    this.connectCalls += 1
  }

  async query<Row extends Record<string, unknown> = Record<string, unknown>>(text: string): Promise<{ rows: Row[] }> {
    this.queries.push(text)
    if (this.fail) throw new Error('connection password=synthetic-secret')
    if (text.includes('current_database()')) {
      return {
        rows: [{
          database: ENVIRONMENT_TOPOLOGY.production.database,
          schema: ENVIRONMENT_TOPOLOGY.production.schema,
          role: ENVIRONMENT_TOPOLOGY.production.databaseRole,
        }] as unknown as Row[],
      }
    }
    if (text.includes('.payload_migrations')) {
      return {
        rows: PAYLOAD_MIGRATION_NAMES.map((name) => ({ name, batch: '1' })) as unknown as Row[],
      }
    }
    if (text.includes('._prisma_migrations')) {
      return { rows: REGISTERED_PRISMA_MIGRATIONS.map(appliedPrisma) as unknown as Row[] }
    }
    return { rows: [] }
  }

  async end(): Promise<void> {
    this.endCalls += 1
  }
}

function validRevision(expectedSha = EXPECTED_SHA): ProductionRevisionEvidence {
  return {
    expectedSha,
    observedCommitSha: expectedSha,
    observedImageTag: expectedSha,
    source: 'deployment-health',
  }
}

function validArgs(): string[] {
  return [
    '--mode=production-read-only',
    '--expected-schema=jpvbootcamp',
    '--acknowledge-read-only',
  ]
}

async function main(): Promise<void> {
  const source = readFileSync('scripts/release/verifyProductionMigrationStatus.ts', 'utf8')

  assert.match(source, /BEGIN TRANSACTION READ ONLY/)
  assert.match(source, /method: 'GET'/)
  assert.match(source, /PRODUCTION_HEALTH_URL/)
  assert.doesNotMatch(source, /\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE|CREATE)\s+/i)
  assert.doesNotMatch(source, /\bprisma\s+migrate\b|\bmigrate\s+deploy\b|\b(?:db|payload):(?:reset|seed|cleanup|init)\b/i)
  assert.doesNotMatch(source, /feature\/member-portal-rooms/)

  assert.deepEqual(parseProductionCliArgs(validArgs()), {
    help: false,
    mode: 'production-read-only',
    expectedSchema: 'jpvbootcamp',
    acknowledgeReadOnly: true,
  })
  assert.throws(() => parseProductionCliArgs(['--mode=production-read-only', '--mode=production-read-only']))
  assert.equal(parseProductionCliArgs(['--expected-schema=jpvbootcamp_staging']).expectedSchema, 'jpvbootcamp_staging')
  assert.throws(() => parseProductionCliArgs(['--unknown']))

  const client = new RecordingClient()
  const adapter = createProductionReadOnlyAdapter({
    databaseUrl: PRODUCTION_DATABASE_URL,
    expectedSchema: 'jpvbootcamp',
    clientFactory: () => client,
  })
  const report = await buildProductionMigrationStatus(adapter, 'jpvbootcamp', EXPECTED_SHA, async () => validRevision())
  assert.equal(report.result, 'VERIFIED')
  assert.deepEqual(report.migrationLedger.payload.pending, [])
  assert.deepEqual(report.migrationLedger.prisma.pending, [])
  assert.equal(report.deployedRevision?.observedCommitSha, EXPECTED_SHA)
  assert.equal(report.rollbackReadiness.mutationPerformed, false)
  assert.equal(report.rollbackReadiness.action, 'none')
  assert.ok(client.queries.includes('BEGIN TRANSACTION READ ONLY'))
  assert.ok(client.queries.includes('ROLLBACK'))
  assert.equal(client.connectCalls, 1)
  assert.equal(client.endCalls, 1)
  for (const query of client.queries) {
    assert.doesNotMatch(query, /\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE|CREATE)\b/i)
  }

  const pendingReport = await buildProductionMigrationStatus({
    async collectMigrationEvidence() {
      return {
        schemaIdentity: 'jpvbootcamp',
        payloadMigrations: PAYLOAD_MIGRATION_NAMES.slice(0, -1).map((name) => ({ name, batch: 1 })),
        prismaMigrations: REGISTERED_PRISMA_MIGRATIONS.slice(0, -1).map(appliedPrisma),
      }
    },
  }, 'jpvbootcamp', EXPECTED_SHA, async () => validRevision())
  assert.equal(pendingReport.result, 'MISMATCH')
  assert.deepEqual(pendingReport.migrationLedger.payload.pending, [PAYLOAD_MIGRATION_NAMES.at(-1)])
  assert.deepEqual(pendingReport.migrationLedger.prisma.pending, [REGISTERED_PRISMA_MIGRATIONS.at(-1)])

  const mismatchedRevision = await buildProductionMigrationStatus(adapter, 'jpvbootcamp', EXPECTED_SHA, async () => validRevision('0000000000000000000000000000000000000000'))
  assert.equal(mismatchedRevision.result, 'MISMATCH')
  assert.ok(mismatchedRevision.blockers.includes('Deployed production revision does not match the expected revision'))

  assert.throws(() => createProductionReadOnlyAdapter({
    databaseUrl: 'postgresql://jpvbootcamp_staging_app:synthetic-secret@10.0.2.4:5433/jpvbootcamp_staging?schema=jpvbootcamp',
    expectedSchema: 'jpvbootcamp',
    clientFactory: () => {
      throw new Error('client must not be constructed')
    },
  }))

  let constructed = 0
  const output: string[] = []
  const missingDbExit = await runProductionMigrationStatusCli(validArgs(), {
    DEPLOYMENT_ENV: 'production',
    EXPECTED_DEPLOYMENT_SHA: EXPECTED_SHA,
  }, (value) => output.push(value), {
    clientFactory: () => {
      constructed += 1
      return new RecordingClient()
    },
    revisionReader: async () => validRevision(),
  })
  assert.equal(missingDbExit, 3)
  assert.equal(constructed, 0)
  assert.match(output.join('\n'), /DATABASE_URL must be supplied/)

  const wrongEnvironmentExit = await runProductionMigrationStatusCli(validArgs(), {
    DEPLOYMENT_ENV: 'staging',
    EXPECTED_DEPLOYMENT_SHA: EXPECTED_SHA,
    DATABASE_URL: PRODUCTION_DATABASE_URL,
  }, (value) => output.push(value), {
    clientFactory: () => {
      constructed += 1
      return new RecordingClient()
    },
  })
  assert.equal(wrongEnvironmentExit, 1)
  assert.equal(constructed, 0)

  const secretSafeOutput: string[] = []
  const failedExit = await runProductionMigrationStatusCli(validArgs(), {
    DEPLOYMENT_ENV: 'production',
    EXPECTED_DEPLOYMENT_SHA: EXPECTED_SHA,
    DATABASE_URL: PRODUCTION_DATABASE_URL,
  }, (value) => secretSafeOutput.push(value), {
    clientFactory: () => {
      const failingClient = new RecordingClient()
      failingClient.fail = true
      return failingClient
    },
    revisionReader: async () => validRevision(),
  })
  assert.equal(failedExit, 1)
  assert.doesNotMatch(secretSafeOutput.join('\n'), /synthetic-secret|password=/i)

  console.log('verifyProductionMigrationStatus.test.ts passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
