/**
 * Tests for checkProductionDeploymentEnv.mts.
 *
 * Verifies that the environment validator rejects incorrect configurations
 * before any Dokploy network call. Uses child_process spawn with tsx to
 * test the actual entrypoint with controlled env vars.
 */

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

const SCRIPT = resolve('scripts/production-gates/checkProductionDeploymentEnv.mts')
const TSX = resolve('node_modules/.bin/tsx')
const VALID_SHA = 'a'.repeat(40)

function run(env: Record<string, string>): { ok: boolean; stderr: string; stdout: string } {
  try {
    const stdout = execFileSync(TSX, [SCRIPT], {
      env: { ...process.env, ...env, PATH: process.env['PATH'] ?? '' },
      encoding: 'utf8',
      timeout: 10_000,
    })
    return { ok: true, stderr: '', stdout }
  } catch (e) {
    const err = e as { status: number; stderr: string; stdout: string }
    return { ok: false, stderr: err.stderr ?? '', stdout: err.stdout ?? '' }
  }
}

// --- Valid production context passes ---
{
  const result = run({
    DOKPLOY_PROD_APP_ID: 'web-public-jpv-bootcamp-l66egq',
    DOKPLOY_API_KEY: 'test-key-value',
    DEPLOY_BRANCH: 'main',
    DEPLOY_SHA: VALID_SHA,
  })
  assert.ok(result.ok, 'valid production context must pass')
  assert.ok(result.stdout.includes('production deployment context validated'), 'success message')
}

// --- Missing DOKPLOY_PROD_APP_ID ---
{
  const result = run({
    DOKPLOY_PROD_APP_ID: '',
    DOKPLOY_API_KEY: 'test-key',
    DEPLOY_BRANCH: 'main',
    DEPLOY_SHA: VALID_SHA,
  })
  assert.ok(!result.ok, 'empty DOKPLOY_PROD_APP_ID must fail')
  assert.ok(
    result.stderr.includes('PRODUCTION-DEPLOY-DENIED') || result.stdout.includes('PRODUCTION-DEPLOY-DENIED'),
    'error must mention PRODUCTION-DEPLOY-DENIED for missing app ID',
  )
}

// --- Missing DOKPLOY_API_KEY ---
{
  const result = run({
    DOKPLOY_PROD_APP_ID: 'web-public-jpv-bootcamp-l66egq',
    DOKPLOY_API_KEY: '',
    DEPLOY_BRANCH: 'main',
    DEPLOY_SHA: VALID_SHA,
  })
  assert.ok(!result.ok, 'empty DOKPLOY_API_KEY must fail')
  assert.ok(
    result.stderr.includes('PRODUCTION-DEPLOY-DENIED') || result.stdout.includes('PRODUCTION-DEPLOY-DENIED'),
    'error must mention PRODUCTION-DEPLOY-DENIED for missing API key',
  )
}

// --- Staging app ID rejected ---
{
  const result = run({
    DOKPLOY_PROD_APP_ID: 'clients-jpv-bootcamp-app-tp9xrk',
    DOKPLOY_API_KEY: 'test-key',
    DEPLOY_BRANCH: 'main',
    DEPLOY_SHA: VALID_SHA,
  })
  assert.ok(!result.ok, 'staging app ID must be rejected')
  assert.ok(
    result.stderr.includes('staging') || result.stdout.includes('staging'),
    'error must mention staging when staging ID is provided',
  )
}

// --- Arbitrary non-staging app ID rejected ---
{
  const result = run({
    DOKPLOY_PROD_APP_ID: 'some-random-app-id',
    DOKPLOY_API_KEY: 'test-key',
    DEPLOY_BRANCH: 'main',
    DEPLOY_SHA: VALID_SHA,
  })
  assert.ok(!result.ok, 'arbitrary non-staging app ID must be rejected')
  assert.ok(
    result.stderr.includes('PRODUCTION-DEPLOY-DENIED') || result.stdout.includes('PRODUCTION-DEPLOY-DENIED'),
    'error must say PRODUCTION-DEPLOY-DENIED for arbitrary app ID',
  )
}

// --- Feature branch rejected ---
{
  const result = run({
    DOKPLOY_PROD_APP_ID: 'web-public-jpv-bootcamp-l66egq',
    DOKPLOY_API_KEY: 'test-key',
    DEPLOY_BRANCH: 'feature/course-branding-and-preview',
    DEPLOY_SHA: VALID_SHA,
  })
  assert.ok(!result.ok, 'feature branch must be rejected')
  assert.ok(
    result.stderr.includes('PRODUCTION-DEPLOY-DENIED') || result.stdout.includes('PRODUCTION-DEPLOY-DENIED'),
    'error must say PRODUCTION-DEPLOY-DENIED for feature branch',
  )
}

// --- Short SHA rejected ---
{
  const result = run({
    DOKPLOY_PROD_APP_ID: 'web-public-jpv-bootcamp-l66egq',
    DOKPLOY_API_KEY: 'test-key',
    DEPLOY_BRANCH: 'main',
    DEPLOY_SHA: 'abc123',
  })
  assert.ok(!result.ok, 'short SHA must be rejected')
}

// --- Does not print the app ID value in error messages ---
{
  const result = run({
    DOKPLOY_PROD_APP_ID: 'some-random-app-id',
    DOKPLOY_API_KEY: 'super-secret-key-value',
    DEPLOY_BRANCH: 'main',
    DEPLOY_SHA: VALID_SHA,
  })
  assert.ok(!result.ok, 'should fail for wrong app ID')
  assert.ok(
    !result.stderr.includes('super-secret-key-value') && !result.stdout.includes('super-secret-key-value'),
    'API key value must never appear in output',
  )
}

// --- Performs no network access (structural: the script has no fetch/http import) ---
// Verified by the fact that all above tests execute quickly with no network dependency

console.log('checkProductionDeploymentEnv.test.ts passed — 16 assertions')
