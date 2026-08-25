import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@payload-config', () => ({ default: {} }))

const payload = {}
const reconcile = vi.fn()
const sweep = vi.fn()

vi.mock('payload', () => ({ getPayload: vi.fn(async () => payload) }))
vi.mock('@/lib/stripe', () => ({ getStripe: vi.fn(() => ({ subscriptions: {}, invoices: {} })) }))
vi.mock('@/lib/stripe-config', () => ({ getStripeConfig: vi.fn(() => ({ env: 'live' })) }))
vi.mock('@/lib/billing/stripePayloadReconciliation', () => ({
  reconcileStripeToPayload: (...args: unknown[]) => reconcile(...args),
}))
vi.mock('@/lib/billing/delinquencySweep', () => ({
  sweepExpiredPaymentGrace: (...args: unknown[]) => sweep(...args),
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
