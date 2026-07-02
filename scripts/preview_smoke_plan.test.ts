import assert from 'node:assert/strict'

import { buildPreviewSmokePlan, PREVIEW_SMOKE_CHECKS } from '../src/lib/previewSmokePlan'

const inert = buildPreviewSmokePlan()
assert.equal(inert.executable, false)
assert.equal(inert.errors.includes('execute_flag_required'), true)
assert.ok(PREVIEW_SMOKE_CHECKS.some((check) => check.key === 'root-page' && check.risk.networkRequired))
assert.ok(PREVIEW_SMOKE_CHECKS.some((check) => check.key === 'provider-apply' && check.risk.providerCallPossible))
assert.ok(PREVIEW_SMOKE_CHECKS.some((check) => check.key === 'resend-verification' && check.risk.mutationPossible))

const invalidExecute = buildPreviewSmokePlan({
  execute: true,
  target: 'http://preview.example.test',
})
assert.equal(invalidExecute.executable, false)
assert.equal(invalidExecute.errors.includes('exact_https_target_required'), true)
assert.equal(invalidExecute.errors.includes('smoke_authorization_required'), true)

const commitSha = '00d874480ef075ca8a853f9fa127e251d7b6a7ce'
const executable = buildPreviewSmokePlan({
  execute: true,
  target: 'https://preview.example.test',
  imageReference: `ghcr.io/prochattools/jpv-bootcamp:${commitSha}`,
  authorization: {
    smokeVerification: {
      authorized: true,
      target: 'https://preview.example.test',
      checks: ['root-page'],
      databaseAccessAllowed: false,
      providerEmailAllowed: false,
      operator: 'smoke-operator',
      stopConditions: ['stop on stack trace'],
    },
  },
})
assert.equal(executable.executable, true)
assert.deepEqual(executable.errors, [])

const serialized = JSON.stringify(executable)
for (const forbidden of ['password', 'token=', 'recipient@example', 'RESEND_API_KEY']) {
  assert.equal(serialized.includes(forbidden), false, forbidden)
}

console.log('preview_smoke_plan.test.ts passed')
