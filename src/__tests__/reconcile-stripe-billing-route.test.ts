import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@payload-config', () => ({ default: {} }))

const payload = {}
const reconcile = vi.fn()
const sweep = vi.fn()
const identityReport = vi.fn()
const identityBackfill = vi.fn()
const identityReportData = {
  livemode: true,
  generatedAt: '2026-08-27T00:00:00.000Z',
  totals: {
    stripeActiveSubscriptions: 13,
    payloadActiveMembers: 9,
    matchedByCustomerId: 7,
    matchedByEmail: 2,
    unmatched: 4,
    ambiguous: 0,
    inactiveLocalMember: 0,
    invalid: 0,
  },
  rows: [{
    subscriptionId: 'sub_unmatched',
    customerId: 'cus_unmatched',
    email: 'unmatched@example.test',
    displayName: 'Unmatched',
    status: 'active',
    match: 'unmatched',
    memberId: null,
    reason: 'no_payload_member_or_billing_account_match',
  }],
}

vi.mock('payload', () => ({ getPayload: vi.fn(async () => payload) }))
vi.mock('@/lib/stripe', () => ({ getStripe: vi.fn(() => ({ subscriptions: {}, invoices: {} })) }))
vi.mock('@/lib/stripe-config', () => ({ getStripeConfig: vi.fn(() => ({ env: 'live' })) }))
vi.mock('@/lib/billing/stripePayloadReconciliation', () => ({
  reconcileStripeToPayload: (...args: unknown[]) => reconcile(...args),
}))
vi.mock('@/lib/billing/delinquencySweep', () => ({
  sweepExpiredPaymentGrace: (...args: unknown[]) => sweep(...args),
}))
vi.mock('@/lib/billing/stripeMemberIdentityReconciliation', () => ({
  buildStripeMemberIdentityReport: (...args: unknown[]) => identityReport(...args),
  applyStripeMemberIdentityBackfill: (...args: unknown[]) => identityBackfill(...args),
}))

import { POST } from '@/app/api/admin/reconcile-stripe-billing/route'

const totals = {
  subscriptions: 25,
  invoices: 78,
  wouldSync: 0,
  synced: 97,
  deduped: 0,
  reviewRequired: 6,
  skipped: 0,
  failed: 0,
}

function request(token = 'worker-secret', body?: Record<string, unknown>) {
  return new Request('http://localhost/api/admin/reconcile-stripe-billing', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('POST /api/admin/reconcile-stripe-billing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.BILLING_RECONCILIATION_WORKER_SECRET = 'worker-secret'
    reconcile.mockResolvedValue({ runId: 'run', totals, checkpoint: null })
    sweep.mockResolvedValue({ examined: 2, blocked: 1, alreadyBlocked: 1, skippedManualStatus: 0, failed: 0 })
    identityReport.mockResolvedValue(identityReportData)
    identityBackfill.mockResolvedValue({
      report: identityReportData,
      created: 4,
      alreadyPresent: 0,
    })
  })

  it('rejects an invalid worker token', async () => {
    const response = await POST(request('wrong-secret'))
    expect(response.status).toBe(401)
    expect(reconcile).not.toHaveBeenCalled()
    expect(sweep).not.toHaveBeenCalled()
  })

  it('runs a communication-suppressed bounded backfill', async () => {
    const response = await POST(request('worker-secret', {
      confirmation: 'initial_backfill_suppress_communications',
      maxObjects: 50_000,
      checkpoint: { phase: 'invoices', startingAfter: 'in_123' },
    }))
    expect(response.status).toBe(200)
    expect(reconcile).toHaveBeenCalledWith(expect.objectContaining({
      payload,
      mode: 'apply',
      livemode: true,
      maxObjects: 10_000,
      suppressCommunications: true,
      checkpoint: { phase: 'invoices', startingAfter: 'in_123' },
    }))
    expect(sweep).toHaveBeenCalledWith({ payload })
  })

  it('runs a no-write dry-run without the delinquency sweep', async () => {
    const response = await POST(request('worker-secret', { mode: 'dry-run', maxObjects: 50 }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.mode).toBe('dry-run')
    expect(body.delinquency).toBeNull()
    expect(reconcile).toHaveBeenCalledWith(expect.objectContaining({
      payload,
      mode: 'dry-run',
      maxObjects: 50,
    }))
    expect(sweep).not.toHaveBeenCalled()
  })

  it('returns the live identity report without running a write path', async () => {
    const response = await POST(request('worker-secret', { mode: 'identity-dry-run' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.mode).toBe('identity-dry-run')
    expect(body.identityReport.totals).toMatchObject({
      stripeActiveSubscriptions: 13,
      payloadActiveMembers: 9,
      unmatched: 4,
    })
    expect(identityReport).toHaveBeenCalledWith(expect.objectContaining({ payload, livemode: true }))
    expect(identityBackfill).not.toHaveBeenCalled()
    expect(reconcile).not.toHaveBeenCalled()
  })

  it('requires the explicit production identity backfill confirmation', async () => {
    const response = await POST(request('worker-secret', {
      mode: 'identity-apply',
      expectedUnmatched: 4,
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ ok: false, error: 'identity_backfill_confirmation_required' })
    expect(identityBackfill).not.toHaveBeenCalled()
  })

  it('applies the guarded identity backfill and then synchronizes billing projections', async () => {
    const response = await POST(new Request('http://localhost/api/admin/reconcile-stripe-billing', {
      method: 'POST',
      headers: {
        authorization: 'Bearer worker-secret',
        'content-type': 'application/json',
        'x-jpv-reconciliation-confirmation': 'identity-backfill-production',
      },
      body: JSON.stringify({ mode: 'identity-apply', expectedUnmatched: 4 }),
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.mode).toBe('identity-apply')
    expect(body.identityBackfill).toMatchObject({ created: 4, alreadyPresent: 0 })
    expect(identityBackfill).toHaveBeenCalledWith(expect.objectContaining({
      payload,
      livemode: true,
      expectedUnmatched: 4,
    }))
    expect(reconcile).toHaveBeenCalledWith(expect.objectContaining({
      payload,
      mode: 'apply',
      suppressCommunications: true,
      livemode: true,
    }))
    expect(sweep).not.toHaveBeenCalled()
  })

  it('rejects an unknown reconciliation mode before any work begins', async () => {
    const response = await POST(request('worker-secret', { mode: 'preview' }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ ok: false, error: 'invalid_mode' })
    expect(reconcile).not.toHaveBeenCalled()
    expect(sweep).not.toHaveBeenCalled()
  })

  it('does not sweep delinquency when a dry-run cannot reach Stripe', async () => {
    reconcile.mockRejectedValueOnce(new Error('stripe unavailable'))

    const response = await POST(request('worker-secret', { mode: 'dry-run' }))

    expect(response.status).toBe(500)
    expect(sweep).not.toHaveBeenCalled()
  })

  it('still enforces expired grace periods when Stripe reconciliation fails', async () => {
    reconcile.mockRejectedValueOnce(new Error('stripe unavailable'))
    const response = await POST(request())
    const body = await response.json()
    expect(response.status).toBe(500)
    expect(body.reconciliationError).toBe('stripe_reconciliation_failed')
    expect(body.delinquency.blocked).toBe(1)
    expect(sweep).toHaveBeenCalledWith({ payload })
  })
})
