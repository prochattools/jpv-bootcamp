const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { execSync } = require('node:child_process')

const testDir = path.join(__dirname, '.test-step2-tmp')

function setup() {
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true })
  }
}

function teardown() {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true })
  }
}

function testPreservesApprovedFields() {
  setup()
  const input = {
    version: 2,
    resultCode: 'plan_ok',
    blockerCodes: [],
    branch: 'main',
    commit: 'abc123',
    schema: 'v1',
    environment: 'staging',
    targetId: 'jpvbootcamp_staging',
    appliedPayloadCount: 29,
    expectedPendingMigrations: ['20260817_193000_bunny_guid_first','20260817_193100_lesson_comments','20260817_193200_space_og_image','20260817_193300_space_reactions'],
    expectedPendingBatchIsOnlyMissing: true,
    unexpectedPayloadCount: 0,
    duplicatePayloadCount: 0,
    malformedPayloadCount: 0,
    orderingAnomalyCount: 0,
    prismaHealthy: true,
    // unknown field that should NOT be copied
    unknownField: 'should not appear',
  }

  const inputFile = path.join(testDir, 'input.json')
  const outputFile = path.join(testDir, 'output.json')

  fs.writeFileSync(inputFile, JSON.stringify(input))

  // Run step 2 sanitizer as subprocess
  execSync(`node ${path.join(__dirname, 'validate-plan-result-step2.js')} ${inputFile} ${outputFile}`)

  const output = JSON.parse(fs.readFileSync(outputFile, 'utf8'))

  // Verify all approved fields are present
  assert.equal(output.version, 2, 'version copied')
  assert.equal(output.resultCode, 'plan_ok', 'resultCode copied')
  assert.deepEqual(output.blockerCodes, [], 'blockerCodes copied')
  assert.equal(output.branch, 'main', 'branch copied')
  assert.equal(output.commit, 'abc123', 'commit copied')
  assert.equal(output.appliedPayloadCount, 29, 'appliedPayloadCount copied')
  assert.deepEqual(output.expectedPendingMigrations, ['20260817_193000_bunny_guid_first','20260817_193100_lesson_comments','20260817_193200_space_og_image','20260817_193300_space_reactions'], 'expectedPendingMigrations copied')
  assert.equal(output.expectedPendingBatchIsOnlyMissing, true, 'expectedPendingBatchIsOnlyMissing copied')
  assert.equal(output.orderingAnomalyCount, 0, 'orderingAnomalyCount copied')
  assert.equal(output.prismaHealthy, true, 'prismaHealthy copied')

  // Verify unknown field is NOT present
  assert.equal(output.unknownField, undefined, 'unknown field filtered')

  teardown()
  console.log('✓ preservesApprovedFields passed')
}

function testPreservesUnhealthyPrismaMigrations() {
  setup()
  const input = {
    version: 2,
    resultCode: 'blocked',
    blockerCodes: ['unhealthy_prisma_migrations'],
    branch: 'main',
    commit: 'abc123',
    schema: 'v1',
    environment: 'staging',
    targetId: 'jpvbootcamp_staging',
    appliedPayloadCount: 29,
    expectedPendingMigrations: ['20260817_193000_bunny_guid_first','20260817_193100_lesson_comments','20260817_193200_space_og_image','20260817_193300_space_reactions'],
    expectedPendingBatchIsOnlyMissing: true,
    unexpectedPayloadCount: 0,
    duplicatePayloadCount: 0,
    malformedPayloadCount: 0,
    orderingAnomalyCount: 0,
    prismaHealthy: false,
    unhealthyPrismaMigrations: [
      { migrationName: '20240115_add_field', status: 'failed' },
      { migrationName: '20240116_update_schema', status: 'in_progress' },
    ],
  }

  const inputFile = path.join(testDir, 'input.json')
  const outputFile = path.join(testDir, 'output.json')

  fs.writeFileSync(inputFile, JSON.stringify(input))

  execSync(`node ${path.join(__dirname, 'validate-plan-result-step2.js')} ${inputFile} ${outputFile}`)

  const output = JSON.parse(fs.readFileSync(outputFile, 'utf8'))

  // Verify unhealthyPrismaMigrations is copied when present
  assert.ok(output.unhealthyPrismaMigrations, 'unhealthyPrismaMigrations present')
  assert.equal(output.unhealthyPrismaMigrations.length, 2, 'array length correct')
  assert.equal(output.unhealthyPrismaMigrations[0].migrationName, '20240115_add_field')
  assert.equal(output.unhealthyPrismaMigrations[0].status, 'failed')

  teardown()
  console.log('✓ preservesUnhealthyPrismaMigrations passed')
}

function testOmitsUnhealthyPrismaMigrationsWhenAbsent() {
  setup()
  const input = {
    version: 2,
    resultCode: 'plan_ok',
    blockerCodes: [],
    branch: 'main',
    commit: 'abc123',
    schema: 'v1',
    environment: 'staging',
    targetId: 'jpvbootcamp_staging',
    appliedPayloadCount: 29,
    expectedPendingMigrations: ['20260817_193000_bunny_guid_first','20260817_193100_lesson_comments','20260817_193200_space_og_image','20260817_193300_space_reactions'],
    expectedPendingBatchIsOnlyMissing: true,
    unexpectedPayloadCount: 0,
    duplicatePayloadCount: 0,
    malformedPayloadCount: 0,
    orderingAnomalyCount: 0,
    prismaHealthy: true,
    // unhealthyPrismaMigrations intentionally absent
  }

  const inputFile = path.join(testDir, 'input.json')
  const outputFile = path.join(testDir, 'output.json')

  fs.writeFileSync(inputFile, JSON.stringify(input))

  execSync(`node ${path.join(__dirname, 'validate-plan-result-step2.js')} ${inputFile} ${outputFile}`)

  const output = JSON.parse(fs.readFileSync(outputFile, 'utf8'))

  // Verify unhealthyPrismaMigrations is NOT present when not in input
  assert.equal(output.unhealthyPrismaMigrations, undefined, 'unhealthyPrismaMigrations omitted when absent')

  teardown()
  console.log('✓ omitsUnhealthyPrismaMigrationsWhenAbsent passed')
}

testPreservesApprovedFields()
testPreservesUnhealthyPrismaMigrations()
testOmitsUnhealthyPrismaMigrationsWhenAbsent()
console.log('\n✓ All step2 sanitizer tests passed')
