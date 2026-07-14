import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  STAGING_SMOKE_MANIFEST,
  validateStagingSmokeManifest,
} from './release/stagingSmokeManifest'
import { buildStagingSmokePlan } from './release/stagingSmokePlan'

function main(): void {
  const validation = validateStagingSmokeManifest()
  assert.equal(validation.ok, true)
  assert.deepEqual(validation.errors, [])

  const categories = new Set(STAGING_SMOKE_MANIFEST.map((entry) => entry.category))
  for (const category of ['PUBLIC', 'MEMBER', 'ADMIN', 'SUPPORT', 'BILLING', 'EMAIL', 'MIGRATION', 'SECURITY', 'CONTENT']) {
    assert.equal(categories.has(category as never), true)
  }

  assert.equal(new Set(STAGING_SMOKE_MANIFEST.map((entry) => entry.id)).size, STAGING_SMOKE_MANIFEST.length)
  assert.ok(STAGING_SMOKE_MANIFEST.some((entry) => entry.id === 'content-programme-preview' && entry.currentStatus === 'blocked-by-content-approval'))
  assert.ok(STAGING_SMOKE_MANIFEST.some((entry) => entry.providerBacked && entry.currentStatus === 'documented-unexecuted'))

  const rendered = buildStagingSmokePlan()
  assert.equal(rendered.ok, true)
  assert.deepEqual(rendered.errors, [])
  assert.match(rendered.output, /Go\/No-Go: pending external operator execution and approval/)
  assert.match(rendered.output, /Provider-backed checks: documented, unexecuted/)
  assert.match(rendered.output, /Programme preview blocker: explicit/)

  const rerendered = buildStagingSmokePlan()
  assert.equal(rendered.output, rerendered.output)

  const invalidEnvironment = buildStagingSmokePlan({ environment: 'staging' })
  assert.equal(invalidEnvironment.ok, false)
  assert.equal(invalidEnvironment.errors.includes('repository_plan_environment_required'), true)

  const invalidExecute = buildStagingSmokePlan({ execute: true })
  assert.equal(invalidExecute.ok, false)
  assert.equal(invalidExecute.errors.includes('live_execution_not_supported'), true)

  const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts?: Record<string, string> }
  assert.equal(
    packageJson.scripts?.['staging:smoke-plan'],
    'tsx scripts/release/printStagingSmokePlan.ts',
  )

  const cliSource = readFileSync('scripts/release/printStagingSmokePlan.ts', 'utf8')
  assert.doesNotMatch(cliSource, /\bfetch\(|\baxios\b|\bprisma\./i)
  assert.doesNotMatch(cliSource, /\bdeploy\b|\bpayload:email:send\b|\bprisma migrate\b/i)

  console.log('staging_smoke_manifest.test.ts passed')
}

main()
