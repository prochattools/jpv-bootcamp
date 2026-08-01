/**
 * Deterministic subprocess tests for checkProductionDeploymentEnv.mts.
 * Uses only fake values, inherits no deployment credentials, and performs no network access.
 */

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

const SCRIPT = resolve('scripts/production-gates/checkProductionDeploymentEnv.mts')
const TSX = resolve('node_modules/.bin/tsx')
const VALID_SHA = 'a'.repeat(40)
const VALID_APP_ID = 'web-public-jpv-bootcamp-l66egq'
const FAKE_API_KEY = 'FAKE_DOKPLOY_API_KEY_FOR_TESTS_ONLY'

interface RunResult {
  ok: boolean
  stderr: string
  stdout: string
}

function run(env: Record<string, string>): RunResult {
  const isolatedEnv: NodeJS.ProcessEnv = {
    PATH: process.env['PATH'] ?? '',
    HOME: process.env['HOME'] ?? '',
    TMPDIR: process.env['TMPDIR'] ?? '/tmp',
    FORCE_COLOR: '0',
    ...env,
  }

  try {
    const stdout = execFileSync(TSX, [SCRIPT], {
      env: isolatedEnv,
      encoding: 'utf8',
      timeout: 10_000,
    })
    return { ok: true, stderr: '', stdout }
  } catch (error) {
    const failure = error as { stderr?: string; stdout?: string }
    return { ok: false, stderr: failure.stderr ?? '', stdout: failure.stdout ?? '' }
  }
}

function combinedOutput(result: RunResult): string {
  return `${result.stdout}\n${result.stderr}`
}

function assertDeniedWithoutLeak(result: RunResult, sentinel: string, label: string): void {
  const output = combinedOutput(result)
  assert.ok(!result.ok, `${label}: validator must fail`)
  assert.match(output, /PRODUCTION-DEPLOY-DENIED/, `${label}: denied error prefix`)
  assert.ok(!output.includes(sentinel), `${label}: supplied sentinel must not appear in output`)
}

const validEnv = {
  DOKPLOY_PROD_APP_ID: VALID_APP_ID,
  DOKPLOY_API_KEY: FAKE_API_KEY,
  DEPLOY_BRANCH: 'main',
  DEPLOY_SHA: VALID_SHA,
}

{
  const result = run(validEnv)
  assert.ok(result.ok, 'valid fake production context must pass')
  assert.match(result.stdout, /production deployment context validated/, 'success message')
  assert.ok(!combinedOutput(result).includes(FAKE_API_KEY), 'success output must not print fake API key')
  assert.ok(!combinedOutput(result).includes(VALID_APP_ID), 'success output must not print app ID')
}

{
  const result = run({ ...validEnv, DOKPLOY_PROD_APP_ID: '' })
  assert.ok(!result.ok, 'missing app ID must fail')
  assert.match(combinedOutput(result), /PRODUCTION-DEPLOY-DENIED/, 'missing app ID denied')
}

{
  const sentinel = 'SENTINEL_ARBITRARY_APP_ID_MUST_NOT_APPEAR'
  assertDeniedWithoutLeak(
    run({ ...validEnv, DOKPLOY_PROD_APP_ID: sentinel }),
    sentinel,
    'arbitrary app ID',
  )
}

{
  const stagingId = 'clients-jpv-bootcamp-app-tp9xrk'
  const result = run({ ...validEnv, DOKPLOY_PROD_APP_ID: stagingId })
  assertDeniedWithoutLeak(result, stagingId, 'staging app ID')
  assert.match(combinedOutput(result), /denied staging identifier/, 'staging classification retained')
}

{
  const result = run({ ...validEnv, DOKPLOY_API_KEY: '' })
  assert.ok(!result.ok, 'missing API key must fail')
  assert.match(combinedOutput(result), /PRODUCTION-DEPLOY-DENIED/, 'missing API key denied')
}

{
  const sentinel = 'SENTINEL_INVALID_API_KEY_MUST_NOT_APPEAR'
  assertDeniedWithoutLeak(
    run({ ...validEnv, DOKPLOY_API_KEY: ` ${sentinel} ` }),
    sentinel,
    'whitespace-malformed API key',
  )
}

{
  const sentinel = 'SENTINEL_INVALID_BRANCH_MUST_NOT_APPEAR'
  assertDeniedWithoutLeak(
    run({ ...validEnv, DEPLOY_BRANCH: sentinel }),
    sentinel,
    'invalid branch',
  )
}

{
  const sentinel = 'SENTINEL_INVALID_SHA_MUST_NOT_APPEAR'
  assertDeniedWithoutLeak(
    run({ ...validEnv, DEPLOY_SHA: sentinel }),
    sentinel,
    'invalid SHA',
  )
}

{
  const uppercaseSha = 'A'.repeat(40)
  assertDeniedWithoutLeak(
    run({ ...validEnv, DEPLOY_SHA: uppercaseSha }),
    uppercaseSha,
    'uppercase SHA',
  )
}

console.log('checkProductionDeploymentEnv.test.ts passed')
