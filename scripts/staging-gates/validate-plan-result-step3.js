const fs = require('fs')
const p = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const [,,, expectedSha, expectedPending, requiredBranch, requiredSchema, requiredEnv, requiredTarget, expectedCountStr] = process.argv
const expectedCount = parseInt(expectedCountStr, 10)
const fails = []
if (p.blockerCodes.length !== 0) fails.push('plan_ok with non-empty blockerCodes: ['+p.blockerCodes.join(',')+']')
if (p.branch !== requiredBranch) fails.push('branch mismatch: expected '+requiredBranch+', got '+p.branch)
if (p.commit !== expectedSha) fails.push('commit mismatch: expected '+expectedSha+', got '+p.commit)
if (p.schema !== requiredSchema) fails.push('schema mismatch: expected '+requiredSchema+', got '+p.schema)
if (p.environment !== requiredEnv) fails.push('environment mismatch: expected '+requiredEnv+', got '+p.environment)
if (p.targetId !== requiredTarget) fails.push('targetId mismatch: expected '+requiredTarget+', got '+p.targetId)
if (p.appliedPayloadCount !== expectedCount) fails.push('appliedPayloadCount mismatch: expected '+expectedCount+', got '+p.appliedPayloadCount)
if (p.expectedPendingMigration !== expectedPending) fails.push('expectedPendingMigration mismatch: expected '+expectedPending+', got '+p.expectedPendingMigration)
if (!p.expectedPendingMigrationIsOnlyMissing) fails.push('expectedPendingMigrationIsOnlyMissing must be true')
if (p.unexpectedPayloadCount !== 0) fails.push('unexpectedPayloadCount must be 0, got '+p.unexpectedPayloadCount)
if (p.duplicatePayloadCount !== 0) fails.push('duplicatePayloadCount must be 0, got '+p.duplicatePayloadCount)
if (p.malformedPayloadCount !== 0) fails.push('malformedPayloadCount must be 0, got '+p.malformedPayloadCount)
if (!p.prismaHealthy) fails.push('prismaHealthy must be true')
if (fails.length > 0) {
  process.stderr.write('PLAN-BLOCKED: plan_ok semantic verification failed:\n')
  for (const f of fails) process.stderr.write('  - '+f+'\n')
  process.exit(1)
}
process.exit(0)
