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
  EXPECTED_PRODUCTION_PREFLIGHT_PRISMA_PENDING,
  parseProductionCliArgs,
  PROTECTED_PRODUCTION_PAYLOAD_HISTORICAL_FINGERPRINT,
  PROTECTED_PRODUCTION_PAYLOAD_ORDERING_ANOMALIES,
  readProductionRevision,
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
  rollbackFail = false
  endFail = false

  async connect(): Promise<void> {
    this.connectCalls += 1
  }

  async query<Row extends Record<string, unknown> = Record<string, unknown>>(text: string): Promise<{ rows: Row[] }> {
    this.queries.push(text)
    if (this.fail) throw new Error('connection password=synthetic-secret')
    if (text === 'ROLLBACK' && this.rollbackFail) throw new Error('rollback failed')
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
        rows: protectedPayloadRows() as unknown as Row[],
      }
    }
    if (text.includes('._prisma_migrations')) {
      return { rows: REGISTERED_PRISMA_MIGRATIONS.map(appliedPrisma) as unknown as Row[] }
    }
    return { rows: [] }
  }

  async end(): Promise<void> {
    this.endCalls += 1
    if (this.endFail) throw new Error('close failed')
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

function protectedPayloadRows(): Array<{ id: number; name: string; batch: number }> {
  const names = [...PAYLOAD_MIGRATION_NAMES]
  const [administrator, billingPause, portalEngagement] = names.slice(47, 50)
  names.splice(47, 3, billingPause, portalEngagement, administrator)
  return names.map((name, index) => {
    const id = index + 1
    const batch = id <= 29
      ? 1
      : id <= 33
        ? 2
        : id <= 35
          ? 3
          : id <= 49
            ? id - 32
            : id <= 51
              ? 18
              : id <= 52
                ? 19
                : id === 53
                  ? 20
                  : id === 54
                    ? 21
                    : 22
    return { id, name, batch }
  })
}

function protectedPreflightAdapter(payloadRows = protectedPayloadRows()) {
  return {
    async collectMigrationEvidence() {
      return {
        schemaIdentity: 'jpvbootcamp',
        payloadMigrations: payloadRows,
        prismaMigrations: REGISTERED_PRISMA_MIGRATIONS
          .slice(0, -EXPECTED_PRODUCTION_PREFLIGHT_PRISMA_PENDING.length)
          .map(appliedPrisma),
      }
    },
  }
}

function validArgs(): string[] {
  return [
    '--mode=production-read-only',
    '--expected-schema=jpvbootcamp',
    '--acknowledge-read-only',
  ]
}

async function testDeploymentHealthIdentityContract(): Promise<void> {
  const originalFetch = globalThis.fetch
  const requests: string[] = []
  try {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      requests.push(String(input))
      return new Response(JSON.stringify({
        ok: true,
        status: 'live',
        deploymentEnv: 'production',
        commitSha: null,
        imageTag: EXPECTED_SHA,
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    }) as typeof fetch
    const evidence = await readProductionRevision(EXPECTED_SHA)
    assert.equal(evidence.observedCommitSha, null)
    assert.equal(evidence.observedImageTag, EXPECTED_SHA)
    assert.equal(requests[0], 'https://jpvbootcamp.com/api/health/deployment')

    globalThis.fetch = (async () => new Response(JSON.stringify({
      ok: true,
      status: 'live',
      deploymentEnv: 'staging',
      commitSha: EXPECTED_SHA,
    }), { status: 200 })) as typeof fetch
    await assert.rejects(() => readProductionRevision(EXPECTED_SHA), /identity is invalid/)

    globalThis.fetch = (async () => new Response(JSON.stringify({
      ok: true,
      status: 'degraded',
      deploymentEnv: 'production',
      commitSha: EXPECTED_SHA,
    }), { status: 200 })) as typeof fetch
    await assert.rejects(() => readProductionRevision(EXPECTED_SHA), /identity is invalid/)
  } finally {
    globalThis.fetch = originalFetch
  }
}

async function testProductionPreflightPolicy(): Promise<void> {
  const report = await buildProductionMigrationStatus(
    protectedPreflightAdapter(),
    'jpvbootcamp',
    EXPECTED_SHA,
    async () => validRevision(),
  )
  assert.equal(report.result, 'VERIFIED')
  assert.equal(report.verificationState, 'VERIFIED_WITH_EXPECTED_PENDING_PRISMA')
  assert.deepEqual(report.migrationLedger.prisma.pending, [...EXPECTED_PRODUCTION_PREFLIGHT_PRISMA_PENDING])
  assert.deepEqual(report.migrationLedger.payload.pending, [])
  assert.deepEqual(report.protectedPayload.orderingAnomalies, [...PROTECTED_PRODUCTION_PAYLOAD_ORDERING_ANOMALIES])
  assert.equal(report.protectedPayload.historicalFingerprint, PROTECTED_PRODUCTION_PAYLOAD_HISTORICAL_FINGERPRINT)
  assert.equal(report.protectedPayload.fingerprintMatches, true)
  assert.equal(report.protectedPayload.accepted, true)

  const extraAnomalyRows = protectedPayloadRows()
  ;[extraAnomalyRows[10], extraAnomalyRows[11]] = [extraAnomalyRows[11], extraAnomalyRows[10]]
  const extraAnomaly = await buildProductionMigrationStatus(
    protectedPreflightAdapter(extraAnomalyRows),
    'jpvbootcamp',
    EXPECTED_SHA,
    async () => validRevision(),
  )
  assert.equal(extraAnomaly.result, 'MISMATCH')
  assert.equal(extraAnomaly.protectedPayload.accepted, false)

  const changedHistoryRows = protectedPayloadRows()
  changedHistoryRows[0] = { ...changedHistoryRows[0], name: 'changed_historical_row' }
  const changedHistory = await buildProductionMigrationStatus(
    protectedPreflightAdapter(changedHistoryRows),
    'jpvbootcamp',
    EXPECTED_SHA,
    async () => validRevision(),
  )
  assert.equal(changedHistory.result, 'MISMATCH')
  assert.equal(changedHistory.protectedPayload.fingerprintMatches, false)

  const duplicate = await buildProductionMigrationStatus(
    protectedPreflightAdapter([...protectedPayloadRows(), protectedPayloadRows()[0]]),
    'jpvbootcamp',
    EXPECTED_SHA,
    async () => validRevision(),
  )
  assert.equal(duplicate.result, 'MISMATCH')

  const malformedRows = protectedPayloadRows()
  malformedRows[20] = { ...malformedRows[20], batch: Number.NaN }
  const malformed = await buildProductionMigrationStatus(
    protectedPreflightAdapter(malformedRows),
    'jpvbootcamp',
    EXPECTED_SHA,
    async () => validRevision(),
  )
  assert.equal(malformed.result, 'MISMATCH')

  const pendingPayload = await buildProductionMigrationStatus(
    protectedPreflightAdapter(protectedPayloadRows().slice(0, -1)),
    'jpvbootcamp',
    EXPECTED_SHA,
    async () => validRevision(),
  )
  assert.equal(pendingPayload.result, 'MISMATCH')
}

async function main(): Promise<void> {
  const source = readFileSync('scripts/release/verifyProductionMigrationStatus.ts', 'utf8')
  const healthRouteSource = readFileSync('src/app/api/health/deployment/route.ts', 'utf8')

  assert.match(source, /BEGIN TRANSACTION READ ONLY/)
  assert.match(source, /method: 'GET'/)
  assert.match(source, /PRODUCTION_HEALTH_URL/)
  assert.match(source, /deploymentEnv !== PRODUCTION\.deploymentEnv/)
  assert.match(healthRouteSource, /status: 'live'/)
  assert.match(healthRouteSource, /deploymentEnv: readEnv\('DEPLOYMENT_ENV'\)/)
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

  await testDeploymentHealthIdentityContract()
  await testProductionPreflightPolicy()

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

  const rollbackFailureClient = new RecordingClient()
  rollbackFailureClient.rollbackFail = true
  await assert.rejects(
    () => createProductionReadOnlyAdapter({
      databaseUrl: PRODUCTION_DATABASE_URL,
      expectedSchema: 'jpvbootcamp',
      clientFactory: () => rollbackFailureClient,
    }).collectMigrationEvidence('jpvbootcamp'),
    /Read-only production rollback failed/,
  )
  assert.equal(rollbackFailureClient.endCalls, 1)

  const closeFailureClient = new RecordingClient()
  closeFailureClient.endFail = true
  await assert.rejects(
    () => createProductionReadOnlyAdapter({
      databaseUrl: PRODUCTION_DATABASE_URL,
      expectedSchema: 'jpvbootcamp',
      clientFactory: () => closeFailureClient,
    }).collectMigrationEvidence('jpvbootcamp'),
    /Read-only production connection close failed/,
  )

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
