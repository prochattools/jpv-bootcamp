const fs = require('fs')
const raw = fs.readFileSync(process.argv[2], 'utf8')
const allowedCodes = new Set(JSON.parse(process.argv[3]))
// Only allow trailing whitespace — reject BOM, prefixes, multiple documents, control chars
const trimmed = raw.trimEnd()
if (trimmed !== trimmed.trimStart()) { process.stderr.write('PLAN-BLOCKED: leading whitespace or BOM\n'); process.exit(1) }
if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(trimmed)) { process.stderr.write('PLAN-BLOCKED: control characters detected\n'); process.exit(1) }
let parsed
try { parsed = JSON.parse(trimmed) } catch { process.stderr.write('PLAN-BLOCKED: invalid JSON\n'); process.exit(1) }
if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) { process.stderr.write('PLAN-BLOCKED: not a JSON object\n'); process.exit(1) }
// Validate SafeMigrationPlanEvidence schema — types and allowlisted values
if (parsed.version !== 2) { process.stderr.write('PLAN-BLOCKED: wrong version\n'); process.exit(1) }
if (parsed.resultCode !== 'plan_ok' && parsed.resultCode !== 'plan_blocked') { process.stderr.write('PLAN-BLOCKED: invalid resultCode\n'); process.exit(1) }
if (!Array.isArray(parsed.blockerCodes)) { process.stderr.write('PLAN-BLOCKED: blockerCodes not array\n'); process.exit(1) }
if (typeof parsed.branch !== 'string') { process.stderr.write('PLAN-BLOCKED: branch not string\n'); process.exit(1) }
if (typeof parsed.commit !== 'string') { process.stderr.write('PLAN-BLOCKED: commit not string\n'); process.exit(1) }
if (typeof parsed.schema !== 'string') { process.stderr.write('PLAN-BLOCKED: schema not string\n'); process.exit(1) }
if (typeof parsed.environment !== 'string') { process.stderr.write('PLAN-BLOCKED: environment not string\n'); process.exit(1) }
if (typeof parsed.targetId !== 'string') { process.stderr.write('PLAN-BLOCKED: targetId not string\n'); process.exit(1) }
if (typeof parsed.appliedPayloadCount !== 'number') { process.stderr.write('PLAN-BLOCKED: appliedPayloadCount not number\n'); process.exit(1) }
if (!Number.isSafeInteger(parsed.appliedPayloadCount) || parsed.appliedPayloadCount < 0) { process.stderr.write('PLAN-BLOCKED: appliedPayloadCount not nonnegative safe integer\n'); process.exit(1) }
if (!Array.isArray(parsed.expectedPendingMigrations)) { process.stderr.write('PLAN-BLOCKED: expectedPendingMigrations not array\n'); process.exit(1) }
for (const migration of parsed.expectedPendingMigrations) { if (typeof migration !== 'string' || migration.length === 0) { process.stderr.write('PLAN-BLOCKED: expectedPendingMigration entry not non-empty string\n'); process.exit(1) } }
if (typeof parsed.expectedPendingBatchIsOnlyMissing !== 'boolean') { process.stderr.write('PLAN-BLOCKED: expectedPendingBatchIsOnlyMissing not boolean\n'); process.exit(1) }
if (typeof parsed.unexpectedPayloadCount !== 'number') { process.stderr.write('PLAN-BLOCKED: unexpectedPayloadCount not number\n'); process.exit(1) }
if (!Number.isSafeInteger(parsed.unexpectedPayloadCount) || parsed.unexpectedPayloadCount < 0) { process.stderr.write('PLAN-BLOCKED: unexpectedPayloadCount not nonnegative safe integer\n'); process.exit(1) }
if (typeof parsed.duplicatePayloadCount !== 'number') { process.stderr.write('PLAN-BLOCKED: duplicatePayloadCount not number\n'); process.exit(1) }
if (!Number.isSafeInteger(parsed.duplicatePayloadCount) || parsed.duplicatePayloadCount < 0) { process.stderr.write('PLAN-BLOCKED: duplicatePayloadCount not nonnegative safe integer\n'); process.exit(1) }
if (typeof parsed.malformedPayloadCount !== 'number') { process.stderr.write('PLAN-BLOCKED: malformedPayloadCount not number\n'); process.exit(1) }
if (!Number.isSafeInteger(parsed.malformedPayloadCount) || parsed.malformedPayloadCount < 0) { process.stderr.write('PLAN-BLOCKED: malformedPayloadCount not nonnegative safe integer\n'); process.exit(1) }
if (typeof parsed.orderingAnomalyCount !== 'number') { process.stderr.write('PLAN-BLOCKED: orderingAnomalyCount not number\n'); process.exit(1) }
if (!Number.isSafeInteger(parsed.orderingAnomalyCount) || parsed.orderingAnomalyCount < 0) { process.stderr.write('PLAN-BLOCKED: orderingAnomalyCount not nonnegative safe integer\n'); process.exit(1) }
if (typeof parsed.prismaHealthy !== 'boolean') { process.stderr.write('PLAN-BLOCKED: prismaHealthy not boolean\n'); process.exit(1) }
if (parsed.unhealthyPrismaMigrations !== undefined) { if (!Array.isArray(parsed.unhealthyPrismaMigrations)) { process.stderr.write('PLAN-BLOCKED: unhealthyPrismaMigrations not array\n'); process.exit(1) } for (const m of parsed.unhealthyPrismaMigrations) { if (typeof m !== 'string') { process.stderr.write('PLAN-BLOCKED: unhealthyPrismaMigration entry not string\n'); process.exit(1) } } }
// Reject unknown keys
const ALLOWED_KEYS = new Set(['version','resultCode','blockerCodes','branch','commit','schema','environment','targetId','appliedPayloadCount','expectedPendingMigrations','expectedPendingBatchIsOnlyMissing','unexpectedPayloadCount','duplicatePayloadCount','malformedPayloadCount','orderingAnomalyCount','prismaHealthy','unhealthyPrismaMigrations'])
for (const k of Object.keys(parsed)) { if (!ALLOWED_KEYS.has(k)) { process.stderr.write('PLAN-BLOCKED: unknown key: '+k+'\n'); process.exit(1) } }
// Validate blockerCodes: strings and from allowlist only
for (const c of parsed.blockerCodes) {
  if (typeof c !== 'string') { process.stderr.write('PLAN-BLOCKED: blockerCode not string\n'); process.exit(1) }
  if (!allowedCodes.has(c)) { process.stderr.write('PLAN-BLOCKED: unknown blocker code: '+c+'\n'); process.exit(1) }
}
// Validate commit is 40-char hex or 'unknown'
if (parsed.commit !== 'unknown' && !/^[0-9a-f]{40}$/.test(parsed.commit)) { process.stderr.write('PLAN-BLOCKED: commit format invalid\n'); process.exit(1) }
// Validate schema matches expected
if (parsed.schema !== 'jpvbootcamp_staging' && parsed.schema !== '') { process.stderr.write('PLAN-BLOCKED: unexpected schema value\n'); process.exit(1) }
process.exit(0)
