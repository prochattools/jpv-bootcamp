const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const script = path.join(__dirname, 'validate-plan-result-step3.js')
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jpv-step3-'))
const planPath = path.join(dir, 'plan.json')

function run(plan) {
  fs.writeFileSync(planPath, JSON.stringify(plan))
  return () => execFileSync(process.execPath, [
    script,
    planPath,
    'a'.repeat(40),
    'feature/course-branding-and-preview',
    'jpvbootcamp_staging',
    'staging',
    'jpvbootcamp-staging',
  ], { stdio: 'pipe' })
}

const healthyPlan = {
  version: 2,
  resultCode: 'plan_ok',
  blockerCodes: [],
  branch: 'feature/course-branding-and-preview',
  commit: 'a'.repeat(40),
  schema: 'jpvbootcamp_staging',
  environment: 'staging',
  targetId: 'jpvbootcamp-staging',
  appliedPayloadCount: 43,
  expectedPendingMigrations: ['future_a', 'future_b'],
  expectedPendingBatchIsOnlyMissing: true,
  unexpectedPayloadCount: 0,
  duplicatePayloadCount: 0,
  malformedPayloadCount: 0,
  orderingAnomalyCount: 0,
  prismaHealthy: true,
}

run(healthyPlan)()

assert.throws(
  run({ ...healthyPlan, orderingAnomalyCount: 1 }),
  /orderingAnomalyCount must be 0/,
)

fs.rmSync(dir, { recursive: true, force: true })
console.log('✓ dynamic plan semantics passed')
