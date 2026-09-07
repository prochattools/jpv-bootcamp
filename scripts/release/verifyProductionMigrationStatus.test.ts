import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

import { PAYLOAD_MIGRATION_NAMES } from '../../src/lib/payloadMigrationRegistry'
import { ENVIRONMENT_TOPOLOGY } from '../../src/lib/environmentTopology'
import {
  REGISTERED_PRISMA_MIGRATIONS,
  type PayloadMigrationRow,
  type PgClientLike,
  type PrismaMigrationRow,
} from './buildStagingMigrationStatus'
import {
  PRODUCTION_ROOMS_HISTORICAL_ANOMALY_WINDOW,
  PRODUCTION_ROOMS_HISTORICAL_BASELINE_SHA256,
  PRODUCTION_ROOMS_PROTECTED_ORDERING_ANOMALIES,
} from './productionRoomsMigrationConstants'
import {
  buildProductionMigrationStatus,
  createProductionReadOnlyAdapter,
  parseProductionCliArgs,
  readProductionRevision,
  runProductionMigrationStatusCli,
  verifyProductionHistoricalPayloadBaseline,
  type ProductionHistoricalBaselineVerifier,
  type ProductionRevisionEvidence,
} from './verifyProductionMigrationStatus'

const EXPECTED_SHA = 'f93ffac7dd299c39d8daf242d6a436272cc79188'
const PRODUCTION_DATABASE_URL = 'postgresql://jpvbootcamp_production_app:synthetic-secret@10.0.2.4:5433/jpvbootcamp?schema=jpvbootcamp'

type ProductionPayloadRow = PayloadMigrationRow & { id: number | string }

function protectedProductionPayloadRows(): ProductionPayloadRow[] {
  const rows: ProductionPayloadRow[] = PAYLOAD_MIGRATION_NAMES.map((name, index) => ({
    id: index + 1,
    name,
    batch: 1,
  }))
  for (const historicalRow of PRODUCTION_ROOMS_HISTORICAL_ANOMALY_WINDOW) {
    rows[historicalRow.id - 1] = { ...historicalRow }
  }
  return rows
}

const PROTECTED_PAYLOAD_ROWS = protectedProductionPayloadRows()
const SYNTHETIC_BASELINE_SHA256 = createHash('sha256')
  .update(JSON.stringify(PROTECTED_PAYLOAD_ROWS.slice(0, PRODUCTION_ROOMS_HISTORICAL_ANOMALY_WINDOW.at(-1)!.id)))
  .digest('hex')
const syntheticHistoricalBaselineVerifier: ProductionHistoricalBaselineVerifier = (rows) =>
  verifyProductionHistoricalPayloadBaseline(rows, SYNTHETIC_BASELINE_SHA256)

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
        rows: PROTECTED_PAYLOAD_ROWS.map((row) => ({
          id: String(row.id),
          name: row.name,
          batch: String(row.batch),
        })) as unknown as Row[],
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

async function reportForEvidence(
  payloadMigrations: ProductionPayloadRow[],
  prismaMigrations: PrismaMigrationRow[] = REGISTERED_PRISMA_MIGRATIONS.map(appliedPrisma),
) {
  return buildProductionMigrationStatus({
    async collectMigrationEvidence() {
      return {
        schemaIdentity: 'jpvbootcamp',
        payloadMigrations,
        prismaMigrations,
      }
    },
  }, 'jpvbootcamp', EXPECTED_SHA, async () => validRevision(), syntheticHistoricalBaselineVerifier)
}

async function main(): Promise<void> {
  const source = readFileSync('scripts/release/verifyProductionMigrationStatus.ts', 'utf8')

  assert.match(source, /BEGIN TRANSACTION READ ONLY/)
  assert.match(source, /SELECT id, name, batch/)
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
  assert.deepEqual(parseProductionCliArgs(['--', ...validArgs()]), parseProductionCliArgs(validArgs()))
  assert.throws(() => parseProductionCliArgs(['--', '--', ...validArgs()]))
  assert.throws(() => parseProductionCliArgs(['--mode=production-read-only', '--mode=production-read-only']))
  assert.equal(parseProductionCliArgs(['--expected-schema=jpvbootcamp_staging']).expectedSchema, 'jpvbootcamp_staging')
  assert.throws(() => parseProductionCliArgs(['--unknown']))

  const protectedBaseline = verifyProductionHistoricalPayloadBaseline(
    PROTECTED_PAYLOAD_ROWS,
    SYNTHETIC_BASELINE_SHA256,
  )
  assert.equal(protectedBaseline.matches, true)
  assert.equal(protectedBaseline.observedSha256, SYNTHETIC_BASELINE_SHA256)
  assert.equal(
    verifyProductionHistoricalPayloadBaseline(PROTECTED_PAYLOAD_ROWS).expectedSha256,
    PRODUCTION_ROOMS_HISTORICAL_BASELINE_SHA256,
  )
  assert.equal(verifyProductionHistoricalPayloadBaseline(PROTECTED_PAYLOAD_ROWS).matches, false)

  const changedOrderRows = protectedProductionPayloadRows()
  ;[changedOrderRows[44], changedOrderRows[45]] = [changedOrderRows[45], changedOrderRows[44]]
  assert.equal(
    verifyProductionHistoricalPayloadBaseline(changedOrderRows, SYNTHETIC_BASELINE_SHA256).matches,
    false,
  )

  const changedIdRows = protectedProductionPayloadRows()
  changedIdRows[44] = { ...changedIdRows[44], id: 445 }
  assert.equal(
    verifyProductionHistoricalPayloadBaseline(changedIdRows, SYNTHETIC_BASELINE_SHA256).matches,
    false,
  )

  const changedBatchRows = protectedProductionPayloadRows()
  changedBatchRows[44] = { ...changedBatchRows[44], batch: 130 }
  assert.equal(
    verifyProductionHistoricalPayloadBaseline(changedBatchRows, SYNTHETIC_BASELINE_SHA256).matches,
    false,
  )

  const malformedIdRows = protectedProductionPayloadRows()
  malformedIdRows[44] = { ...malformedIdRows[44], id: '045' }
  assert.equal(
    verifyProductionHistoricalPayloadBaseline(malformedIdRows, SYNTHETIC_BASELINE_SHA256).matches,
    false,
  )

  const missingHistoricalRow = protectedProductionPayloadRows()
  missingHistoricalRow.splice(49, 1)
  assert.equal(
    verifyProductionHistoricalPayloadBaseline(missingHistoricalRow, SYNTHETIC_BASELINE_SHA256).matches,
    false,
  )

  const client = new RecordingClient()
  const adapter = createProductionReadOnlyAdapter({
    databaseUrl: PRODUCTION_DATABASE_URL,
    expectedSchema: 'jpvbootcamp',
    clientFactory: () => client,
  })
  const report = await buildProductionMigrationStatus(
    adapter,
    'jpvbootcamp',
    EXPECTED_SHA,
    async () => validRevision(),
    syntheticHistoricalBaselineVerifier,
  )
  assert.equal(report.result, 'VERIFIED')
  assert.deepEqual(report.migrationLedger.payload.pending, [])
  assert.deepEqual(report.migrationLedger.prisma.pending, [])
  assert.deepEqual(report.migrationLedger.payload.orderingAnomalies, [...PRODUCTION_ROOMS_PROTECTED_ORDERING_ANOMALIES])
  assert.equal(report.migrationLedger.payload.historicalBaseline.matches, true)
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

  const pendingReport = await reportForEvidence(
    protectedProductionPayloadRows().slice(0, -1),
    REGISTERED_PRISMA_MIGRATIONS.slice(0, -1).map(appliedPrisma),
  )
  assert.equal(pendingReport.result, 'MISMATCH')
  assert.deepEqual(pendingReport.migrationLedger.payload.pending, [PAYLOAD_MIGRATION_NAMES.at(-1)])
  assert.deepEqual(pendingReport.migrationLedger.prisma.pending, [REGISTERED_PRISMA_MIGRATIONS.at(-1)])

  const extraOrderingAnomalyRows = protectedProductionPayloadRows()
  ;[extraOrderingAnomalyRows[53], extraOrderingAnomalyRows[54]] = [extraOrderingAnomalyRows[54], extraOrderingAnomalyRows[53]]
  const extraOrderingAnomalyReport = await reportForEvidence(extraOrderingAnomalyRows)
  assert.equal(extraOrderingAnomalyReport.result, 'MISMATCH')
  assert.ok(extraOrderingAnomalyReport.blockers.includes('Payload migration ordering anomalies exist'))
  assert.ok(extraOrderingAnomalyReport.blockers.includes('Protected production Payload migration ordering fingerprint does not match'))

  const unexpectedRows = protectedProductionPayloadRows()
  unexpectedRows.push({ id: 56, name: '20990101_000000_unexpected', batch: 20 })
  const unexpectedReport = await reportForEvidence(unexpectedRows)
  assert.equal(unexpectedReport.result, 'MISMATCH')
  assert.deepEqual(unexpectedReport.migrationLedger.payload.unexpected, ['20990101_000000_unexpected'])

  const duplicateRows = protectedProductionPayloadRows()
  duplicateRows.push({ id: 56, name: duplicateRows[54].name, batch: 20 })
  const duplicateReport = await reportForEvidence(duplicateRows)
  assert.equal(duplicateReport.result, 'MISMATCH')
  assert.deepEqual(duplicateReport.migrationLedger.payload.duplicate, [duplicateRows[54].name])

  const malformedPayloadRows = protectedProductionPayloadRows()
  malformedPayloadRows[54] = { ...malformedPayloadRows[54], batch: 0 }
  const malformedPayloadReport = await reportForEvidence(malformedPayloadRows)
  assert.equal(malformedPayloadReport.result, 'MISMATCH')
  assert.equal(malformedPayloadReport.migrationLedger.payload.malformedRows, 1)

  const unhealthyPrisma = REGISTERED_PRISMA_MIGRATIONS.map(appliedPrisma)
  unhealthyPrisma[0] = { ...unhealthyPrisma[0], finished_at: null }
  const unhealthyPrismaReport = await reportForEvidence(protectedProductionPayloadRows(), unhealthyPrisma)
  assert.equal(unhealthyPrismaReport.result, 'MISMATCH')
  assert.equal(unhealthyPrismaReport.migrationLedger.prisma.statuses[0].status, 'in-progress')

  const unexpectedPrismaReport = await reportForEvidence(protectedProductionPayloadRows(), [
    ...REGISTERED_PRISMA_MIGRATIONS.map(appliedPrisma),
    appliedPrisma('20990101000000_unexpected'),
  ])
  assert.equal(unexpectedPrismaReport.result, 'MISMATCH')
  assert.deepEqual(unexpectedPrismaReport.migrationLedger.prisma.unexpected, ['20990101000000_unexpected'])

  const duplicatePrismaRows = REGISTERED_PRISMA_MIGRATIONS.map(appliedPrisma)
  duplicatePrismaRows.push(appliedPrisma(REGISTERED_PRISMA_MIGRATIONS[0]))
  const duplicatePrismaReport = await reportForEvidence(protectedProductionPayloadRows(), duplicatePrismaRows)
  assert.equal(duplicatePrismaReport.result, 'MISMATCH')
  assert.deepEqual(duplicatePrismaReport.migrationLedger.prisma.duplicate, [REGISTERED_PRISMA_MIGRATIONS[0]])

  const mismatchedRevision = await buildProductionMigrationStatus(
    adapter,
    'jpvbootcamp',
    EXPECTED_SHA,
    async () => validRevision('0000000000000000000000000000000000000000'),
    syntheticHistoricalBaselineVerifier,
  )
  assert.equal(mismatchedRevision.result, 'MISMATCH')
  assert.ok(mismatchedRevision.blockers.includes('Deployed production revision does not match the expected revision'))

  const conflictingRevision = await buildProductionMigrationStatus(adapter, 'jpvbootcamp', EXPECTED_SHA, async () => ({
    ...validRevision(),
    observedImageTag: '0000000000000000000000000000000000000000',
  }), syntheticHistoricalBaselineVerifier)
  assert.equal(conflictingRevision.result, 'MISMATCH')
  assert.ok(conflictingRevision.blockers.includes('Deployed production revision does not match the expected revision'))

  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = (async () => new Response(JSON.stringify({
      commitSha: EXPECTED_SHA,
      imageTag: 'malformed-image-tag',
    }), { status: 200 })) as typeof fetch
    await assert.rejects(() => readProductionRevision(EXPECTED_SHA), /image tag is invalid/)

    globalThis.fetch = (async () => new Response(JSON.stringify({
      commitSha: 'malformed-commit-sha',
      imageTag: EXPECTED_SHA,
    }), { status: 200 })) as typeof fetch
    await assert.rejects(() => readProductionRevision(EXPECTED_SHA), /commit SHA is invalid/)

    globalThis.fetch = (async () => new Response(JSON.stringify({
      commitSha: null,
      imageTag: EXPECTED_SHA,
    }), { status: 200 })) as typeof fetch
    assert.deepEqual(await readProductionRevision(EXPECTED_SHA), {
      expectedSha: EXPECTED_SHA,
      observedCommitSha: null,
      observedImageTag: EXPECTED_SHA,
      source: 'deployment-health',
    })
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.throws(() => createProductionReadOnlyAdapter({
    databaseUrl: 'postgresql://jpvbootcamp_staging_app:synthetic-secret@10.0.2.4:5433/jpvbootcamp_staging?schema=jpvbootcamp',
    expectedSchema: 'jpvbootcamp',
    clientFactory: () => {
      throw new Error('client must not be constructed')
    },
  }))

  for (const override of [
    'host=127.0.0.1',
    'port=9999',
    'user=other_role',
    'password=other_secret',
    'database=other_database',
    'db=other_database',
  ]) {
    assert.throws(() => createProductionReadOnlyAdapter({
      databaseUrl: `${PRODUCTION_DATABASE_URL}&${override}`,
      expectedSchema: 'jpvbootcamp',
      clientFactory: () => {
        throw new Error('client must not be constructed')
      },
    }), /Production database boundary mismatch/)
  }

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
