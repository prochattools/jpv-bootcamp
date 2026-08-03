/**
 * Tests for buildStagingMigrationStatus
 *
 * All tests use injected adapters — no real DB connections.
 */

import assert from 'node:assert/strict'

import {
  buildStagingMigrationStatus,
  REGISTERED_PAYLOAD_MIGRATIONS,
  type MigrationQueryAdapter,
  type StagingMigrationStatusReport,
} from './buildStagingMigrationStatus'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EXPECTED_SCHEMA = 'jpv_staging'

/** Build a fully-applied adapter for the 28 registered migrations. */
function makeFullyAppliedAdapter(schemaOverride?: string): MigrationQueryAdapter {
  return {
    getDatabaseSchemaIdentity: async () => schemaOverride ?? EXPECTED_SCHEMA,
    getPayloadMigrations: async () =>
      REGISTERED_PAYLOAD_MIGRATIONS.map((name) => ({
        name,
        applied: true,
        batch: 1,
      })),
    getPrismaMigrations: async () =>
      Array.from({ length: 3 }, (_, i) => ({
        migration_name: `20260101_000${i + 1}_example`,
        finished_at: new Date().toISOString(),
        logs: null,
      })),
  }
}

/** Adapter with one migration missing from the DB. */
function makeMissingMigrationsAdapter(): MigrationQueryAdapter {
  const applied = Array.from(REGISTERED_PAYLOAD_MIGRATIONS).slice(0, 26)
  return {
    getDatabaseSchemaIdentity: async () => EXPECTED_SCHEMA,
    getPayloadMigrations: async () =>
      applied.map((name) => ({ name, applied: true, batch: 1 })),
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
        applied: true,
        batch: 1,
      })),
    getPrismaMigrations: async () => [
      {
        migration_name: '20260101_0001_example',
        finished_at: new Date().toISOString(),
        logs: null,
      },
      {
        migration_name: '20260601_0002_failed',
        finished_at: null,
        logs: 'ERROR: relation already exists',
      },
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
    report.prismaMigrations.every((m) => !m.failed),
    true,
    'No Prisma failures expected',
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
// Test 4: failed Prisma migration → prismaMigrations has failed=true
// ---------------------------------------------------------------------------

async function testFailedPrismaMigrationIsMarked(): Promise<void> {
  const report = await buildStagingMigrationStatus(makeFailedPrismaAdapter(), EXPECTED_SCHEMA)

  const failedEntries = report.prismaMigrations.filter((m) => m.failed)
  assert(failedEntries.length > 0, 'At least one Prisma migration must be marked failed')
  assert.equal(failedEntries[0].name, '20260601_0002_failed')
  assert.equal(failedEntries[0].applied, false)

  // Overall status should reflect the failure
  assert.equal(report.overallStatus, 'MISMATCHES_FOUND')

  console.log('PASS test 4: failed Prisma migration → failed=true, MISMATCHES_FOUND')
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

  console.log('\nAll buildStagingMigrationStatus tests passed.')
}

run().catch((err: unknown) => {
  console.error('TEST FAILURE:', err)
  process.exit(1)
})
