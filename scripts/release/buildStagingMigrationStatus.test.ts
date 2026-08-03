/**
 * Tests for buildStagingMigrationStatus
 *
 * All tests use injected adapters — no real DB connections.
 */

import assert from 'node:assert/strict'

import {
  buildStagingMigrationStatus,
  parseCliArgs,
  REGISTERED_PAYLOAD_MIGRATIONS,
  type MigrationQueryAdapter,
  type PrismaMigrationRow,
  type StagingMigrationStatusReport,
} from './buildStagingMigrationStatus'

import { PAYLOAD_MIGRATION_NAMES } from '../../src/migrations/migrationRegistry'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EXPECTED_SCHEMA = 'jpv_staging'

function makePrismaRow(overrides: Partial<PrismaMigrationRow> & { migration_name: string }): PrismaMigrationRow {
  return {
    finished_at: new Date().toISOString(),
    logs: null,
    rolled_back_at: null,
    started_at: new Date().toISOString(),
    applied_steps_count: 1,
    ...overrides,
  }
}

/** Build a fully-applied adapter for the 28 registered migrations. */
function makeFullyAppliedAdapter(schemaOverride?: string): MigrationQueryAdapter {
  return {
    getDatabaseSchemaIdentity: async () => schemaOverride ?? EXPECTED_SCHEMA,
    getPayloadMigrations: async () =>
      REGISTERED_PAYLOAD_MIGRATIONS.map((name) => ({
        name,
        batch: 1,
      })),
    getPrismaMigrations: async () =>
      Array.from({ length: 3 }, (_, i) =>
        makePrismaRow({ migration_name: `20260101_000${i + 1}_example` }),
      ),
  }
}

/** Adapter with one migration missing from the DB. */
function makeMissingMigrationsAdapter(): MigrationQueryAdapter {
  const applied = Array.from(REGISTERED_PAYLOAD_MIGRATIONS).slice(0, 26)
  return {
    getDatabaseSchemaIdentity: async () => EXPECTED_SCHEMA,
    getPayloadMigrations: async () =>
      applied.map((name) => ({ name, batch: 1 })),
    getPrismaMigrations: async () => [],
  }
}

/** Adapter with one failed Prisma migration. */
function makeFailedPrismaAdapter(): MigrationQueryAdapter {
  return {
    getDatabaseSchemaIdentity: async () => EXPECTED_SCHEMA,
    getPayloadMigrations: async () =>
      REGISTERED_PAYLOAD_MIGRATIONS.map((name) => ({
        name,
        batch: 1,
      })),
    getPrismaMigrations: async () => [
      makePrismaRow({ migration_name: '20260101_0001_example' }),
      makePrismaRow({
        migration_name: '20260601_0002_failed',
        finished_at: null,
        logs: 'ERROR: relation already exists',
      }),
    ],
  }
}

// ---------------------------------------------------------------------------
// Test 1: null adapter → OPERATOR_EVIDENCE_REQUIRED
// ---------------------------------------------------------------------------

async function testNullAdapterReturnsOperatorEvidenceRequired(): Promise<void> {
  const report = await buildStagingMigrationStatus(null, EXPECTED_SCHEMA)

  assert.equal(
    report.overallStatus,
    'OPERATOR_EVIDENCE_REQUIRED',
    'null adapter must yield OPERATOR_EVIDENCE_REQUIRED',
  )
  assert.equal(report.mode, 'dry-run')
  assert.equal(report.schemaIdentityMatch, null)
  assert.equal(report.appliedPayloadMigrations.length, 0)

  const noteText = report.notes.join('\n')
  assert.match(
    noteText,
    /OPERATOR READ-ONLY MIGRATION EVIDENCE REQUIRED/,
    'notes must contain the OPERATOR READ-ONLY MIGRATION EVIDENCE REQUIRED message',
  )

  console.log('PASS test 1: null adapter → OPERATOR_EVIDENCE_REQUIRED')
}

// ---------------------------------------------------------------------------
// Test 2: fully applied adapter with schema match → VERIFIED
// ---------------------------------------------------------------------------

async function testFullyAppliedAdapterReturnsVerified(): Promise<void> {
  const report = await buildStagingMigrationStatus(makeFullyAppliedAdapter(), EXPECTED_SCHEMA)

  assert.equal(report.overallStatus, 'VERIFIED')
  assert.equal(report.mode, 'live')
  assert.equal(report.schemaIdentityMatch, true)
  assert.equal(report.missingPayloadMigrations.length, 0)
  assert.equal(report.unexpectedPayloadMigrations.length, 0)
  assert.equal(
    report.prismaMigrations.every((m) => m.status === 'applied'),
    true,
    'No Prisma non-applied expected',
  )

  console.log('PASS test 2: fully applied → VERIFIED')
}

// ---------------------------------------------------------------------------
// Test 3: missing migrations adapter → MISMATCHES_FOUND
// ---------------------------------------------------------------------------

async function testMissingMigrationsReturnsMismatches(): Promise<void> {
  const report = await buildStagingMigrationStatus(makeMissingMigrationsAdapter(), EXPECTED_SCHEMA)

  assert.equal(report.overallStatus, 'MISMATCHES_FOUND')
  assert(
    report.missingPayloadMigrations.length > 0,
    'missingPayloadMigrations must be populated',
  )
  // The last two registered migrations are missing (indices 26 and 27)
  assert.equal(report.missingPayloadMigrations.length, 2)

  console.log('PASS test 3: missing migrations → MISMATCHES_FOUND')
}

// ---------------------------------------------------------------------------
// Test 4: failed Prisma migration → status=failed, MISMATCHES_FOUND
// ---------------------------------------------------------------------------

async function testFailedPrismaMigrationIsMarked(): Promise<void> {
  const report = await buildStagingMigrationStatus(makeFailedPrismaAdapter(), EXPECTED_SCHEMA)

  const failedEntries = report.prismaMigrations.filter((m) => m.status === 'failed')
  assert(failedEntries.length > 0, 'At least one Prisma migration must be marked failed')
  assert.equal(failedEntries[0].name, '20260601_0002_failed')

  // Overall status should reflect the failure
  assert.equal(report.overallStatus, 'MISMATCHES_FOUND')

  console.log('PASS test 4: failed Prisma migration → status=failed, MISMATCHES_FOUND')
}

// ---------------------------------------------------------------------------
// Test 5: schema identity mismatch → OPERATOR_EVIDENCE_REQUIRED (no queries)
// ---------------------------------------------------------------------------

async function testSchemaIdentityMismatchAbortsQueries(): Promise<void> {
  let queriesExecuted = 0

  const mismatchAdapter: MigrationQueryAdapter = {
    getDatabaseSchemaIdentity: async () => 'wrong_schema',
    getPayloadMigrations: async () => {
      queriesExecuted++
      return []
    },
    getPrismaMigrations: async () => {
      queriesExecuted++
      return []
    },
  }

  const report = await buildStagingMigrationStatus(mismatchAdapter, EXPECTED_SCHEMA)

  assert.equal(
    report.overallStatus,
    'OPERATOR_EVIDENCE_REQUIRED',
    'schema mismatch must yield OPERATOR_EVIDENCE_REQUIRED',
  )
  assert.equal(report.schemaIdentityMatch, false)
  assert.equal(
    queriesExecuted,
    0,
    'No data queries must be executed after schema identity mismatch',
  )

  const noteText = report.notes.join('\n')
  assert.match(noteText, /mismatch/, 'notes must describe the schema mismatch')

  console.log('PASS test 5: schema mismatch → OPERATOR_EVIDENCE_REQUIRED, no data queries')
}

// ---------------------------------------------------------------------------
// Test 6: output never contains connection strings
// ---------------------------------------------------------------------------

async function testOutputNeverContainsConnectionStrings(): Promise<void> {
  const reports: StagingMigrationStatusReport[] = []

  reports.push(await buildStagingMigrationStatus(null, EXPECTED_SCHEMA))
  reports.push(await buildStagingMigrationStatus(makeFullyAppliedAdapter(), EXPECTED_SCHEMA))
  reports.push(await buildStagingMigrationStatus(makeMissingMigrationsAdapter(), EXPECTED_SCHEMA))

  for (const report of reports) {
    const serialized = JSON.stringify(report)

    assert(
      !serialized.includes('postgres://'),
      'Report must not contain postgres:// connection strings',
    )
    assert(
      !serialized.includes('postgresql://'),
      'Report must not contain postgresql:// connection strings',
    )
    assert(
      !serialized.includes('DATABASE_URL'),
      'Report must not contain DATABASE_URL references',
    )
    assert(
      !serialized.includes('password'),
      'Report must not contain "password" text',
    )
  }

  console.log('PASS test 6: output never contains connection strings')
}

// ---------------------------------------------------------------------------
// Test 7: registeredMigrations count equals 28
// ---------------------------------------------------------------------------

async function testRegisteredMigrationsCountIs28(): Promise<void> {
  // Verify the canonical constant directly
  assert.equal(
    REGISTERED_PAYLOAD_MIGRATIONS.length,
    28,
    'REGISTERED_PAYLOAD_MIGRATIONS must have exactly 28 entries',
  )

  // Also verify it appears correctly in a live report
  const report = await buildStagingMigrationStatus(makeFullyAppliedAdapter(), EXPECTED_SCHEMA)
  assert.equal(
    report.registeredMigrations.length,
    28,
    'registeredMigrations in live report must be 28',
  )

  console.log('PASS test 7: registeredMigrations count is 28')
}

// ---------------------------------------------------------------------------
// Test 8: CLI parser - space-separated mode
// ---------------------------------------------------------------------------

async function testCliParserSpaceSeparated(): Promise<void> {
  const result = parseCliArgs(['--mode', 'staging-read-only', '--expected-schema', 'my_schema'])
  assert.equal(result.mode, 'staging-read-only')
  assert.equal(result.expectedSchema, 'my_schema')
  assert.equal(result.errors.length, 0)

  console.log('PASS test 8: CLI parser - space-separated mode')
}

// ---------------------------------------------------------------------------
// Test 9: CLI parser - equals-separated mode
// ---------------------------------------------------------------------------

async function testCliParserEqualsSeparated(): Promise<void> {
  const result = parseCliArgs(['--mode=staging-read-only', '--expected-schema=my_schema'])
  assert.equal(result.mode, 'staging-read-only')
  assert.equal(result.expectedSchema, 'my_schema')
  assert.equal(result.errors.length, 0)

  console.log('PASS test 9: CLI parser - equals-separated mode')
}

// ---------------------------------------------------------------------------
// Test 10: CLI parser - duplicate mode flag error
// ---------------------------------------------------------------------------

async function testCliParserDuplicateModeError(): Promise<void> {
  const result = parseCliArgs([
    '--mode=staging-read-only',
    '--mode=staging-read-only',
    '--expected-schema=s',
  ])
  assert(result.errors.length > 0, 'Duplicate --mode must produce errors')

  console.log('PASS test 10: CLI parser - duplicate mode flag error')
}

// ---------------------------------------------------------------------------
// Test 11: Registry match test
// ---------------------------------------------------------------------------

async function testRegistryMatch(): Promise<void> {
  assert.deepEqual(
    Array.from(REGISTERED_PAYLOAD_MIGRATIONS),
    Array.from(PAYLOAD_MIGRATION_NAMES),
    'REGISTERED_PAYLOAD_MIGRATIONS must exactly match PAYLOAD_MIGRATION_NAMES from migrationRegistry',
  )

  console.log('PASS test 11: REGISTERED_PAYLOAD_MIGRATIONS matches canonical PAYLOAD_MIGRATION_NAMES')
}

// ---------------------------------------------------------------------------
// Test 12: Unfinished Prisma migration prevents VERIFIED
// ---------------------------------------------------------------------------

async function testUnfinishedPrismaPreventsVerified(): Promise<void> {
  const adapter: MigrationQueryAdapter = {
    getDatabaseSchemaIdentity: async () => EXPECTED_SCHEMA,
    getPayloadMigrations: async () =>
      REGISTERED_PAYLOAD_MIGRATIONS.map((name) => ({ name, batch: 1 })),
    getPrismaMigrations: async () => [
      makePrismaRow({
        migration_name: '20260101_0001_in_progress',
        finished_at: null,
        logs: null,
        rolled_back_at: null,
        applied_steps_count: 0,
      }),
    ],
  }

  const report = await buildStagingMigrationStatus(adapter, EXPECTED_SCHEMA)
  assert.equal(
    report.overallStatus,
    'MISMATCHES_FOUND',
    'In-progress migration must prevent VERIFIED',
  )
  const inProgress = report.prismaMigrations.find((m) => m.name === '20260101_0001_in_progress')
  assert.ok(inProgress, 'in-progress migration must appear in report')
  assert.equal(inProgress.status, 'in-progress')

  console.log('PASS test 12: unfinished Prisma migration prevents VERIFIED')
}

// ---------------------------------------------------------------------------
// Test 13: Rolled-back Prisma migration prevents VERIFIED
// ---------------------------------------------------------------------------

async function testRolledBackPrismaPreventsVerified(): Promise<void> {
  const adapter: MigrationQueryAdapter = {
    getDatabaseSchemaIdentity: async () => EXPECTED_SCHEMA,
    getPayloadMigrations: async () =>
      REGISTERED_PAYLOAD_MIGRATIONS.map((name) => ({ name, batch: 1 })),
    getPrismaMigrations: async () => [
      makePrismaRow({
        migration_name: '20260101_0001_rolled_back',
        finished_at: null,
        rolled_back_at: new Date().toISOString(),
      }),
    ],
  }

  const report = await buildStagingMigrationStatus(adapter, EXPECTED_SCHEMA)
  assert.equal(
    report.overallStatus,
    'MISMATCHES_FOUND',
    'Rolled-back migration must prevent VERIFIED',
  )
  const rb = report.prismaMigrations.find((m) => m.name === '20260101_0001_rolled_back')
  assert.ok(rb, 'rolled-back migration must appear in report')
  assert.equal(rb.status, 'rolled-back')

  console.log('PASS test 13: rolled-back Prisma migration prevents VERIFIED')
}

// ---------------------------------------------------------------------------
// Test 14: Schema validated before data queries
// ---------------------------------------------------------------------------

async function testMissingExpectedSchemaThrowsBeforeAdapter(): Promise<void> {
  let adapterCalled = false
  const adapter: MigrationQueryAdapter = {
    getDatabaseSchemaIdentity: async () => {
      adapterCalled = true
      return EXPECTED_SCHEMA
    },
    getPayloadMigrations: async () => [],
    getPrismaMigrations: async () => [],
  }

  // No expectedSchema => must throw before calling getDatabaseSchemaIdentity
  await assert.rejects(
    () => buildStagingMigrationStatus(adapter, undefined),
    (err: unknown) => {
      assert.ok(err instanceof Error)
      assert.ok(err.message.includes('schema_identity_check_required'))
      return true
    },
  )
  // getDatabaseSchemaIdentity must NOT have been called
  assert.equal(adapterCalled, false, 'adapter must not be called when expectedSchema is missing')

  console.log('PASS test 14: missing expectedSchema throws before adapter is called')
}

// ---------------------------------------------------------------------------
// Test 15: batch=-1 rows are NOT counted as applied
// ---------------------------------------------------------------------------

async function testBatchNegativeOneNotApplied(): Promise<void> {
  // Only 26 of 28 applied with batch=1, remaining 2 with batch=-1 (dev push)
  const allRows = REGISTERED_PAYLOAD_MIGRATIONS.map((name, i) => ({
    name,
    batch: i < 26 ? 1 : -1,
  }))

  const adapter: MigrationQueryAdapter = {
    getDatabaseSchemaIdentity: async () => EXPECTED_SCHEMA,
    getPayloadMigrations: async () => allRows,
    getPrismaMigrations: async () => [],
  }

  const report = await buildStagingMigrationStatus(adapter, EXPECTED_SCHEMA)
  assert.equal(
    report.overallStatus,
    'MISMATCHES_FOUND',
    'batch=-1 rows must not count as applied',
  )
  assert.equal(report.missingPayloadMigrations.length, 2)

  console.log('PASS test 15: batch=-1 rows not counted as applied')
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function run(): Promise<void> {
  await testNullAdapterReturnsOperatorEvidenceRequired()
  await testFullyAppliedAdapterReturnsVerified()
  await testMissingMigrationsReturnsMismatches()
  await testFailedPrismaMigrationIsMarked()
  await testSchemaIdentityMismatchAbortsQueries()
  await testOutputNeverContainsConnectionStrings()
  await testRegisteredMigrationsCountIs28()
  await testCliParserSpaceSeparated()
  await testCliParserEqualsSeparated()
  await testCliParserDuplicateModeError()
  await testRegistryMatch()
  await testUnfinishedPrismaPreventsVerified()
  await testRolledBackPrismaPreventsVerified()
  await testMissingExpectedSchemaThrowsBeforeAdapter()
  await testBatchNegativeOneNotApplied()

  console.log('\nAll buildStagingMigrationStatus tests passed.')
}

run().catch((err: unknown) => {
  console.error('TEST FAILURE:', err)
  process.exit(1)
})
