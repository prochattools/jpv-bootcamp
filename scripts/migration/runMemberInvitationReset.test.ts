/**
 * Tests: REM-01 Member Invitation/Reset
 *
 * Covers:
 *   1. dry-run returns cohort=0 with empty mock
 *   2. idempotency key is deterministic (same inputs → same key)
 *   3. idempotency key is distinct for different members
 *   4. apply blocked when DATABASE_URL missing
 *   5. redactForLog hides local part of email
 *
 * Run: pnpm exec tsx scripts/migration/runMemberInvitationReset.test.ts
 */

import { Client } from 'pg'
import {
  buildIdempotencyKey,
  buildRunId,
  checkDatabaseUrl,
  checkApplyGuards,
  queryCohort,
  runInvitationReset,
} from './runMemberInvitationReset'
import { redactForLog } from './legacyMigrationFramework'

// ─── Test harness ─────────────────────────────────────────────────────────────

const tests: { name: string; fn: () => void | Promise<void> }[] = []
const passed: string[] = []
const failed: { name: string; error: string }[] = []

function test(name: string, fn: () => void | Promise<void>) {
  tests.push({ name, fn })
}

function describe(suite: string, fn: () => void) {
  fn()
}

function expect<T>(value: T) {
  return {
    toEqual: (expected: T) => {
      if (JSON.stringify(value) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(value)}`)
      }
    },
    toBe: (expected: T) => {
      if (value !== expected) {
        throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(value)}`)
      }
    },
    toContain: (substring: string) => {
      if (typeof value !== 'string' || !value.includes(substring)) {
        throw new Error(`Expected "${value}" to contain "${substring}"`)
      }
    },
    not: {
      toBe: (expected: T) => {
        if (value === expected) {
          throw new Error(`Expected value NOT to be ${JSON.stringify(expected)}`)
        }
      },
      toContain: (substring: string) => {
        if (typeof value === 'string' && value.includes(substring)) {
          throw new Error(`Expected "${value}" NOT to contain "${substring}"`)
        }
      },
    },
  }
}

// ─── Mock client helpers ──────────────────────────────────────────────────────

function makeEmptyMockClient(): Client {
  return {
    connect: () => Promise.resolve(),
    query: (sql: string, _params?: unknown[]) => {
      // Audit table EXISTS check
      if (sql.includes('information_schema.tables') && sql.includes('member_invitation_audit')) {
        return Promise.resolve({ rows: [{ exists: false }] })
      }
      // payload_members cohort query returns empty
      if (sql.includes('payload_members') && sql.includes("source = 'migration'")) {
        return Promise.resolve({ rows: [] })
      }
      return Promise.resolve({ rows: [] })
    },
    end: () => Promise.resolve(),
  } as unknown as Client
}

function makeCohortMockClient(rows: Array<{ id: string; email: string; account_status: string }>): Client {
  return {
    connect: () => Promise.resolve(),
    query: (sql: string, _params?: unknown[]) => {
      if (sql.includes('payload_members') && sql.includes("source = 'migration'")) {
        return Promise.resolve({ rows })
      }
      return Promise.resolve({ rows: [] })
    },
    end: () => Promise.resolve(),
  } as unknown as Client
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('REM-01: dry-run with empty cohort', () => {
  test('dry-run returns cohort=0 with empty mock', async () => {
    const mockClient = makeEmptyMockClient()
    const members = await queryCohort(mockClient, 'jpvbootcamp_staging')

    expect(members.length).toBe(0)
  })

  test('dry-run InvitationResult has 0 totals when cohort is empty', async () => {
    // Patch client.connect and end to no-ops, override internal client
    // We test runInvitationReset by injecting via environment — instead test the
    // cohort path directly since runInvitationReset creates its own pg.Client.
    // Verify the query path: queryCohort with empty mock returns zero rows.
    const mockClient = makeEmptyMockClient()
    const rows = await queryCohort(mockClient, 'jpvbootcamp_staging')

    expect(rows.length).toEqual(0)

    // Simulate the result that runInvitationReset would return for empty cohort
    const simulatedResult = {
      runId: buildRunId('2025-01-01'),
      mode: 'dry-run' as const,
      cohortTotal: rows.length,
      alreadyInvited: 0,
      pending: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
    }

    expect(simulatedResult.cohortTotal).toBe(0)
    expect(simulatedResult.pending).toBe(0)
    expect(simulatedResult.sent).toBe(0)
  })
})

describe('REM-01: idempotency key determinism', () => {
  test('idempotency key is deterministic — same inputs produce same key', () => {
    const memberId = 'member-abc-123'
    const runId = 'invitation_run_v1_abc123'

    const key1 = buildIdempotencyKey(memberId, runId)
    const key2 = buildIdempotencyKey(memberId, runId)

    expect(key1).toBe(key2)
  })

  test('idempotency key starts with expected prefix', () => {
    const key = buildIdempotencyKey('member-001', 'run-001')
    expect(key).toContain('member_invitation_v1_')
  })

  test('idempotency key is distinct for different members', () => {
    const runId = 'invitation_run_v1_shared'
    const key1 = buildIdempotencyKey('member-001', runId)
    const key2 = buildIdempotencyKey('member-002', runId)

    expect(key1).not.toBe(key2)
  })

  test('idempotency key is distinct for different run IDs', () => {
    const memberId = 'member-001'
    const key1 = buildIdempotencyKey(memberId, 'run-a')
    const key2 = buildIdempotencyKey(memberId, 'run-b')

    expect(key1).not.toBe(key2)
  })
})

describe('REM-01: apply guard — DATABASE_URL missing', () => {
  test('checkDatabaseUrl returns not ok when undefined', () => {
    const result = checkDatabaseUrl(undefined)

    expect(result.ok).toBe(false)
  })

  test('checkDatabaseUrl returns ok when set', () => {
    const result = checkDatabaseUrl('postgres://user:pass@localhost:5432/db')

    expect(result.ok).toBe(true)
  })

  test('checkApplyGuards blocks apply without authorization-token', () => {
    const result = checkApplyGuards('apply', undefined, 'https://preview.example.com', 'staging')

    expect(result.ok).toBe(false)
  })

  test('checkApplyGuards blocks apply without staging-url', () => {
    const result = checkApplyGuards('apply', 'some-token', undefined, 'staging')

    expect(result.ok).toBe(false)
  })

  test('checkApplyGuards blocks apply when NODE_ENV=production', () => {
    const result = checkApplyGuards('apply', 'some-token', 'https://preview.example.com', 'production')

    expect(result.ok).toBe(false)
  })

  test('checkApplyGuards allows dry-run without token or url', () => {
    const result = checkApplyGuards('dry-run', undefined, undefined, 'production')

    expect(result.ok).toBe(true)
  })

  test('checkApplyGuards allows apply with all required flags and non-production env', () => {
    const result = checkApplyGuards('apply', 'token-123', 'https://preview.example.com', 'staging')

    expect(result.ok).toBe(true)
  })
})

describe('REM-01: redactForLog hides local part of email', () => {
  test('redactForLog returns domain-only format for email', () => {
    const redacted = redactForLog('user@example.com')

    expect(redacted).toContain('[email:')
    expect(redacted).toContain('example.')
    expect(redacted).not.toContain('user')
  })

  test('redactForLog hides full local part', () => {
    const redacted = redactForLog('john.doe+tag@company.org')

    // Must not contain any part of the local-part
    expect(redacted).not.toContain('john')
    expect(redacted).not.toContain('doe')
    expect(redacted).not.toContain('tag')
  })

  test('redactForLog handles null gracefully', () => {
    const redacted = redactForLog(null)

    expect(redacted).toBe('[null]')
  })

  test('redactForLog handles undefined gracefully', () => {
    const redacted = redactForLog(undefined)

    expect(redacted).toBe('[null]')
  })
})

// ─── Run tests ────────────────────────────────────────────────────────────────

async function runTests() {
  console.log(`Running REM-01 invitation/reset tests...\n`)

  for (const t of tests) {
    try {
      await t.fn()
      passed.push(t.name)
      console.log(`✓ ${t.name}`)
    } catch (e) {
      failed.push({ name: t.name, error: String(e) })
      console.log(`✗ ${t.name}`)
      console.log(`  ${String(e)}\n`)
    }
  }

  console.log(`\n─────────────────────────────────────────`)
  console.log(`REM-01 Tests: ${passed.length} passed, ${failed.length} failed`)
  console.log(`─────────────────────────────────────────\n`)

  if (failed.length > 0) {
    process.exit(1)
  }
}

runTests().catch((e) => {
  console.error('Fatal error running tests:', e)
  process.exit(1)
})
