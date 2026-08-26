/**
 * Tests for provisionMemberSubscription in staging-auto-provision.ts.
 *
 * Covers:
 *   - fresh-create: member + billing + subscription created when none exist
 *   - existing-idempotent: subscription already exists → zero writes
 *   - existing-billing-idempotent: billing exists, subscription missing → reuses billing
 *   - null-user/req context: createLocalReq is called with a system admin user (not null)
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'

// ── Module mocks ──────────────────────────────────────────────────────────────

// Mock createLocalReq to return a synthetic req object without needing a real
// Payload config. The mock captures the user arg for assertion.
const mockCreateLocalReq = vi.fn().mockResolvedValue({ user: { id: 0, collection: 'payload_users' } })

vi.mock('payload', () => ({
  createLocalReq: (...args: unknown[]) => mockCreateLocalReq(...args),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

type Call = { method: string; options: Record<string, unknown> }

function buildPayloadMock(findByCollection: Record<string, unknown[]> = {}) {
  const calls: Call[] = []

  const payload = {
    find: vi.fn(async (options: Record<string, unknown>) => {
      calls.push({ method: 'find', options })
      const collection = options.collection as string
      const docs = findByCollection[collection] ?? []
      return { docs, totalDocs: docs.length }
    }),
    create: vi.fn(async (options: Record<string, unknown>) => {
      calls.push({ method: 'create', options })
      const collection = options.collection as string
      if (collection === 'payload_billing_accounts') return { id: 99 }
      if (collection === 'payload_subscriptions') return { id: 100 }
      return { id: 1 }
    }),
    update: vi.fn(async (options: Record<string, unknown>) => {
      calls.push({ method: 'update', options })
      return {}
    }),
  }

  return { payload, calls }
}

function setEnv(env: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
}

function setStagingMemberEnv() {
  setEnv({
    DEPLOYMENT_ENV: 'staging',
    STAGING_MEMBER_EMAIL: 'qa@example.com',
    STAGING_MEMBER_PASSWORD: 'test-pw',
    STAGING_ADMIN_EMAIL: undefined,
    STAGING_ADMIN_PASSWORD: undefined,
  })
}

function clearEnv() {
  setEnv({
    DEPLOYMENT_ENV: undefined,
    STAGING_MEMBER_EMAIL: undefined,
    STAGING_MEMBER_PASSWORD: undefined,
    STAGING_ADMIN_EMAIL: undefined,
    STAGING_ADMIN_PASSWORD: undefined,
  })
}

// ── Module import ─────────────────────────────────────────────────────────────

const { stagingAutoProvision } = await import('../lib/staging-auto-provision.js').catch(
  () => import('../lib/staging-auto-provision.ts'),
) as { stagingAutoProvision: (payload: unknown) => Promise<void> }

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('provisionMemberSubscription', () => {
  beforeEach(() => {
    clearEnv()
    mockCreateLocalReq.mockClear()
  })

  it('fresh-create: creates billing account and subscription when neither exists', async () => {
    setStagingMemberEnv()

    const existingMember = { id: 42, email: 'qa@example.com' }
    const { payload, calls } = buildPayloadMock({
      payload_members: [existingMember],
      payload_subscriptions: [],
      payload_billing_accounts: [],
    })

    await stagingAutoProvision(payload)

    const creates = calls.filter((c) => c.method === 'create')
    const billingCreate = creates.find((c) => c.options.collection === 'payload_billing_accounts')
    const subCreate = creates.find((c) => c.options.collection === 'payload_subscriptions')

    expect(billingCreate).toBeTruthy()
    expect(subCreate).toBeTruthy()

    const billingData = billingCreate!.options.data as Record<string, unknown>
    expect(billingData.member).toBe('42')
    expect(billingData.billingStatus).toBe('active')

    const subData = subCreate!.options.data as Record<string, unknown>
    expect(subData.member).toBe('42')
    expect(subData.plan).toBe('jpv_bootcamp_membership')
    expect(subData.status).toBe('active')
  })

  it('existing-idempotent: zero writes when active subscription exists', async () => {
    setStagingMemberEnv()

    const existingMember = { id: 51, email: 'qa@example.com' }
    const existingSub = { id: 1, member: '51', plan: 'jpv_bootcamp_membership', status: 'active' }
    const { payload, calls } = buildPayloadMock({
      payload_members: [existingMember],
      payload_subscriptions: [existingSub],
    })

    await stagingAutoProvision(payload)

    const creates = calls.filter((c) => c.method === 'create')
    const updates = calls.filter((c) => c.method === 'update')
    expect(creates).toHaveLength(0)
    expect(updates).toHaveLength(0)
  })

  it('existing-billing-idempotent: reuses existing billing account, creates subscription only', async () => {
    setStagingMemberEnv()

    const existingMember = { id: 51, email: 'qa@example.com' }
    const existingBilling = { id: 1, member: '51', billingStatus: 'active' }
    const { payload, calls } = buildPayloadMock({
      payload_members: [existingMember],
      payload_subscriptions: [],
      payload_billing_accounts: [existingBilling],
    })

    await stagingAutoProvision(payload)

    const creates = calls.filter((c) => c.method === 'create')
    expect(creates.find((c) => c.options.collection === 'payload_billing_accounts')).toBeUndefined()

    const subCreate = creates.find((c) => c.options.collection === 'payload_subscriptions')
    expect(subCreate).toBeTruthy()
    const subData = subCreate!.options.data as Record<string, unknown>
    expect(subData.billingAccount).toBe('1')
  })

  it('null-user/req context: createLocalReq is called with a non-null system admin user', async () => {
    setStagingMemberEnv()

    const existingMember = { id: 51, email: 'qa@example.com' }
    const { payload } = buildPayloadMock({
      payload_members: [existingMember],
      payload_subscriptions: [],
      payload_billing_accounts: [],
    })

    await stagingAutoProvision(payload)

    expect(mockCreateLocalReq).toHaveBeenCalledOnce()
    const [options] = mockCreateLocalReq.mock.calls[0] as [{ user: { id: number; collection: string; email: string } }]
    expect(options.user).toBeTruthy()
    expect(options.user.collection).toBe('payload_users')
    expect(options.user.id).toBeDefined()
  })

  it('non-staging env: createLocalReq is never called', async () => {
    setEnv({ DEPLOYMENT_ENV: 'production' })
    const { payload } = buildPayloadMock()
    await stagingAutoProvision(payload)
    expect(mockCreateLocalReq).not.toHaveBeenCalled()
  })
})
