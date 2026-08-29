const fs = require('fs')
const raw = fs.readFileSync(process.argv[2], 'utf8').trimEnd()
const p = JSON.parse(raw)
const safe = {
  version: p.version,
  resultCode: p.resultCode,
  blockerCodes: p.blockerCodes,
  branch: p.branch,
  commit: p.commit,
  schema: p.schema,
  environment: p.environment,
  targetId: p.targetId,
  appliedPayloadCount: p.appliedPayloadCount,
  expectedPendingMigrations: p.expectedPendingMigrations,
  expectedPendingBatchIsOnlyMissing: p.expectedPendingBatchIsOnlyMissing,
  unexpectedPayloadCount: p.unexpectedPayloadCount,
  duplicatePayloadCount: p.duplicatePayloadCount,
  malformedPayloadCount: p.malformedPayloadCount,
  orderingAnomalyCount: p.orderingAnomalyCount,
  prismaHealthy: p.prismaHealthy,
}
if (p.unhealthyPrismaMigrations !== undefined) {
  safe.unhealthyPrismaMigrations = p.unhealthyPrismaMigrations
}
fs.writeFileSync(process.argv[3], JSON.stringify(safe) + '\n', { mode: 0o600 })
