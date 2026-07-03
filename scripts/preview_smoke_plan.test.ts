import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  buildPreviewSmokePlan,
  PREVIEW_SMOKE_CHECKS,
  validatePreviewSmokeEvidence,
} from '../src/lib/previewSmokePlan'

const inert = buildPreviewSmokePlan()
assert.equal(inert.executable, false)
assert.equal(inert.errors.includes('execute_flag_required'), true)
assert.ok(PREVIEW_SMOKE_CHECKS.some((check) => check.key === 'public-root' && check.risk.networkRequired))
assert.ok(PREVIEW_SMOKE_CHECKS.some((check) => check.key === 'provider-apply' && check.risk.providerCallPossible))
assert.ok(PREVIEW_SMOKE_CHECKS.some((check) => check.key === 'test-member-account-flows' && check.risk.mutationPossible))
assert.ok(PREVIEW_SMOKE_CHECKS.every((check) => check.prerequisites.length > 0))
assert.ok(PREVIEW_SMOKE_CHECKS.every((check) => check.requiredEvidenceFields.length > 0))
assert.ok(PREVIEW_SMOKE_CHECKS.every((check) => check.stopConditions.length > 0))
assert.deepEqual(PREVIEW_SMOKE_CHECKS.map((check) => check.key), [...PREVIEW_SMOKE_CHECKS].map((check) => check.key))

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
      checks: ['public-root'],
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
for (const forbidden of ['token=', 'recipient@example', 'RESEND_API_KEY', 'customer_id=', 'postgres://']) {
  assert.equal(serialized.includes(forbidden), false, forbidden)
}

const validEvidence = validatePreviewSmokeEvidence({
  schemaVersion: 1,
  commitSha,
  imageReference: `ghcr.io/prochattools/jpv-bootcamp:${commitSha}`,
  environmentLabel: 'preview',
  checkKey: 'public-root',
  startTime: '2026-07-03T00:00:00.000Z',
  endTime: '2026-07-03T00:01:00.000Z',
  status: 'passed',
  safeStatus: 'ok',
  operator: 'smoke-operator',
  approvalReference: 'approval-1',
  notes: 'repository-only evidence',
  artifactDigest: 'sha256:0123456789abcdef',
  authorizationCategory: 'smokeVerification',
})
assert.equal(validEvidence.ok, true)
assert.deepEqual(validEvidence.errors, [])

for (const bad of [
  { schemaVersion: 2 },
  { commitSha: 'short' },
  { checkKey: 'unknown-check' },
  { startTime: '2026-07-03T00:01:00.000Z', endTime: '2026-07-03T00:00:00.000Z' },
  { status: 'passed', safeStatus: 'unsafe' },
  { status: 'failed' },
  { notes: 'password=abc' },
] as Array<Partial<Parameters<typeof validatePreviewSmokeEvidence>[0]>>) {
  assert.equal(validatePreviewSmokeEvidence({
    schemaVersion: 1,
    commitSha,
    environmentLabel: 'preview',
    checkKey: 'public-root',
    startTime: '2026-07-03T00:00:00.000Z',
    endTime: '2026-07-03T00:01:00.000Z',
    status: 'passed',
    safeStatus: 'ok',
    artifactDigest: 'sha256:0123456789abcdef',
    authorizationCategory: 'smokeVerification',
    ...bad,
  }).ok, false)
}

const cliSource = readFileSync('scripts/preview/smoke-check.mts', 'utf8')
assert.match(cliSource, /mode === 'print-plan'/)
assert.match(cliSource, /mode === 'validate-plan'/)
assert.match(cliSource, /mode === 'validate-evidence'/)
assert.doesNotMatch(cliSource, /\bfetch\(/)
assert.doesNotMatch(cliSource, /\baxios\b/)
assert.doesNotMatch(cliSource, /\bprisma\./i)

console.log('preview_smoke_plan.test.ts passed')
