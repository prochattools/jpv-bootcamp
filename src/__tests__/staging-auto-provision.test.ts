/**
 * Behavioral tests for staging-auto-provision.ts
 *
 * Verifies create-if-missing semantics: password must never be reset on startup.
 *
 * Tests:
 *   1. admin already exists and unlocked: payload.update is NOT called
 *   2. admin exists but locked: update called WITHOUT password field
 *   3. admin does not exist: create called with email + password
 *   4. non-staging env: no find/create called at all
 *
 * Usage (from repo root):
 *   pnpm exec tsx src/__tests__/staging-auto-provision.test.ts
 */

import assert from 'node:assert/strict'

// ── Minimal Payload mock ─────────────────────────────────────────────────────

type Call = { method: string; args: unknown[] }

function buildMockPayload(findDocs: unknown[]) {
  const calls: Call[] = []

  const payload = {
    find: async (...args: unknown[]) => {
      calls.push({ method: 'find', args })
      return { docs: findDocs, totalDocs: findDocs.length }
    },
    update: async (...args: unknown[]) => {
      calls.push({ method: 'update', args })
      return {}
    },
    create: async (...args: unknown[]) => {
      calls.push({ method: 'create', args })
      return {}
    },
  }

  return { payload, calls }
}

// ── Test harness ─────────────────────────────────────────────────────────────

type TestFn = () => Promise<void>
const results: Array<{ name: string; ok: boolean; error?: string }> = []

async function test(name: string, fn: TestFn) {
  try {
    await fn()
    results.push({ name, ok: true })
    console.log(`pass - ${name}`)
  } catch (err) {
    results.push({ name, ok: false, error: (err as Error).message })
    console.log(`fail - ${name}`)
    console.log(`       ${(err as Error).message}`)
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Import the module under test with fresh env vars.
 * We re-import by mutating process.env and using the exported function directly.
 * Since tsx does not reset modules, we inline the logic by re-exporting through
 * a shim approach: read the source assertions structurally.
 */

// We cannot dynamically re-import ESM with different env per test without a
// full module-cache bypass. Instead we test the observable behavior by calling
// the real exported function with controlled mocks and env.

// Load the module once; env mutations below are per-test via setup/teardown.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { stagingAutoProvision } = await import('../lib/staging-auto-provision.js').catch(
  () => import('../lib/staging-auto-provision.ts'),
) as { stagingAutoProvision: (payload: unknown) => Promise<void> }

function setEnv(env: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) {
      delete process.env[k]
    } else {
      process.env[k] = v
    }
  }
}

function clearStagingEnv() {
  setEnv({
    DEPLOYMENT_ENV: undefined,
    STAGING_ADMIN_EMAIL: undefined,
    STAGING_ADMIN_PASSWORD: undefined,
    STAGING_MEMBER_EMAIL: undefined,
    STAGING_MEMBER_PASSWORD: undefined,
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

await test('admin already exists and unlocked: payload.update is NOT called', async () => {
  clearStagingEnv()
  setEnv({
    DEPLOYMENT_ENV: 'staging',
    STAGING_ADMIN_EMAIL: 'admin@example.com',
    STAGING_ADMIN_PASSWORD: 'secret',
    // No member credentials — skip member provisioning
  })

  const existingAdmin = { id: 'user-1', email: 'admin@example.com', loginAttempts: 0, lockUntil: null }
  const { payload, calls } = buildMockPayload([existingAdmin])

  await stagingAutoProvision(payload)

  const updateCalls = calls.filter((c) => c.method === 'update')
  assert.equal(updateCalls.length, 0, `payload.update must NOT be called when admin exists and is unlocked (got ${updateCalls.length} update call(s))`)

  const createCalls = calls.filter((c) => c.method === 'create')
  assert.equal(createCalls.length, 0, 'payload.create must NOT be called when admin already exists')
})

await test('admin exists but locked: update called WITHOUT password field', async () => {
  clearStagingEnv()
  setEnv({
    DEPLOYMENT_ENV: 'staging',
    STAGING_ADMIN_EMAIL: 'admin@example.com',
    STAGING_ADMIN_PASSWORD: 'secret',
  })

  const lockedAdmin = { id: 'user-1', email: 'admin@example.com', loginAttempts: 5, lockUntil: '2026-01-01T00:00:00.000Z' }
  const { payload, calls } = buildMockPayload([lockedAdmin])

  await stagingAutoProvision(payload)

  const updateCalls = calls.filter((c) => c.method === 'update')
  assert.equal(updateCalls.length, 1, 'payload.update must be called once to unlock the account')

  const updateArgs = updateCalls[0]!.args[0] as { data: Record<string, unknown> }
  assert.ok(!('password' in updateArgs.data), `update data must NOT include password field, got: ${JSON.stringify(updateArgs.data)}`)
  assert.equal(updateArgs.data.loginAttempts, 0, 'update must reset loginAttempts to 0')
  assert.equal(updateArgs.data.lockUntil, null, 'update must clear lockUntil')
})

await test('admin does not exist: create called with email and password', async () => {
  clearStagingEnv()
  setEnv({
    DEPLOYMENT_ENV: 'staging',
    STAGING_ADMIN_EMAIL: 'admin@example.com',
    STAGING_ADMIN_PASSWORD: 'secret',
  })

  // Empty docs array — user does not exist
  const { payload, calls } = buildMockPayload([])

  await stagingAutoProvision(payload)

  const createCalls = calls.filter((c) => c.method === 'create')
  assert.equal(createCalls.length, 1, 'payload.create must be called once when admin does not exist')

  const createArgs = createCalls[0]!.args[0] as { data: Record<string, unknown> }
  assert.equal(createArgs.data.email, 'admin@example.com', 'create must include correct email')
  assert.equal(createArgs.data.password, 'secret', 'create must include password for new user')
})

await test('non-staging env: no find or create called', async () => {
  clearStagingEnv()
  // Explicit production must remain fail-closed even if stale staging
  // credentials are still present in the application environment.
  setEnv({
    DEPLOYMENT_ENV: 'production',
    STAGING_ADMIN_EMAIL: 'admin@example.com',
    STAGING_ADMIN_PASSWORD: 'secret',
    STAGING_MEMBER_EMAIL: 'member@example.com',
    STAGING_MEMBER_PASSWORD: 'secret',
  })

  const { payload, calls } = buildMockPayload([])

  await stagingAutoProvision(payload)

  assert.equal(calls.length, 0, `No Payload calls should be made in non-staging env, got: ${JSON.stringify(calls)}`)
})

// ── Summary ───────────────────────────────────────────────────────────────────

const failed = results.filter((r) => !r.ok)
console.log(`\nstaging-auto-provision tests complete`)
console.log(`${results.length - failed.length}/${results.length} passed`)

if (failed.length > 0) {
  process.exit(1)
}
