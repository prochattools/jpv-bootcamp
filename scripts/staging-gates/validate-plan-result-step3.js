const fs = require('fs')
const p = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const [,,, expectedSha, requiredBranch, requiredSchema, requiredEnv, requiredTarget] = process.argv
const fails = []
if (p.blockerCodes.length !== 0) fails.push('plan_ok with non-empty blockerCodes: ['+p.blockerCodes.join(',')+']')
if (p.resultCode !== 'plan_ok') fails.push('resultCode must be plan_ok, got '+p.resultCode)
if (p.branch !== requiredBranch) fails.push('branch mismatch: expected '+requiredBranch+', got '+p.branch)
if (p.commit !== expectedSha) fails.push('commit mismatch: expected '+expectedSha+', got '+p.commit)
if (p.schema !== requiredSchema) fails.push('schema mismatch: expected '+requiredSchema+', got '+p.schema)
if (p.environment !== requiredEnv) fails.push('environment mismatch: expected '+requiredEnv+', got '+p.environment)
if (p.targetId !== requiredTarget) fails.push('targetId mismatch: expected '+requiredTarget+', got '+p.targetId)
if (!Array.isArray(p.expectedPendingMigrations)) {
  fails.push('expectedPendingMigrations must be an array')
}
if (!p.expectedPendingBatchIsOnlyMissing) fails.push('expectedPendingBatchIsOnlyMissing must be true')
if (p.unexpectedPayloadCount !== 0) fails.push('unexpectedPayloadCount must be 0, got '+p.unexpectedPayloadCount)
if (p.duplicatePayloadCount !== 0) fails.push('duplicatePayloadCount must be 0, got '+p.duplicatePayloadCount)
if (p.malformedPayloadCount !== 0) fails.push('malformedPayloadCount must be 0, got '+p.malformedPayloadCount)
if (p.orderingAnomalyCount !== 0) fails.push('orderingAnomalyCount must be 0, got '+p.orderingAnomalyCount)
if (!p.prismaHealthy) fails.push('prismaHealthy must be true')
if (fails.length > 0) {
  process.stderr.write('PLAN-BLOCKED: plan_ok semantic verification failed:\n')
  for (const f of fails) process.stderr.write('  - '+f+'\n')
  process.exit(1)
}
process.exit(0)
