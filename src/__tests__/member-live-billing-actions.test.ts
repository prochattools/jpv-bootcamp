import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  dbUpdate: vi.fn(),
  retrieve: vi.fn(),
  stripeUpdate: vi.fn(),
}))

vi.mock('@/libs/prisma', () => ({
  default: {
    customerProvisioning: {
      findUnique: mocks.findUnique,
      update: mocks.dbUpdate,
    },
  },
}))
vi.mock('@/lib/stripe-config', () => ({ getStripeConfig: () => ({ env: 'live' }) }))
vi.mock('@/lib/stripe', () => ({
  getStripe: () => ({ subscriptions: { retrieve: mocks.retrieve, update: mocks.stripeUpdate } }),
}))

import {
  recordCancellationRequest,
  reverseCancellationRequest,
} from '@/lib/billing/commitmentProjection'

const periodEnd = new Date('2026-09-25T00:00:00.000Z')

function cancellationRecord() {
  return {
    id: 42,
    billingCadence: 'annual',
    commitmentStatus: 'active',
    commitmentEndAt: null,
    subscriptionCurrentPeriodEnd: periodEnd,
    stripeSubscriptionId: 'sub_live_member',
  }
}

describe('member live billing actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.STRIPE_LIVE_MEMBER_BILLING_ACTIONS_ENABLED = 'true'
    mocks.findUnique.mockResolvedValue(cancellationRecord())
    mocks.retrieve.mockResolvedValue({
      id: 'sub_live_member', livemode: true, cancel_at: null, cancel_at_period_end: false,
    })
    mocks.stripeUpdate.mockResolvedValue({ id: 'sub_live_member', livemode: true })
    mocks.dbUpdate.mockResolvedValue({})
  })

  afterEach(() => {
    delete process.env.STRIPE_LIVE_MEMBER_BILLING_ACTIONS_ENABLED
  })

  it('refuses live cancellation before Stripe or local mutation when the gate is disabled', async () => {
    delete process.env.STRIPE_LIVE_MEMBER_BILLING_ACTIONS_ENABLED
    const result = await recordCancellationRequest({ memberEmail: 'member@example.com' })
    expect(result).toEqual({ ok: false, error: 'live_action_disabled' })
    expect(mocks.stripeUpdate).not.toHaveBeenCalled()
    expect(mocks.dbUpdate).not.toHaveBeenCalled()
  })

  it('does not write local cancellation state when Stripe fails', async () => {
    mocks.stripeUpdate.mockRejectedValueOnce(new Error('provider unavailable'))
    const result = await recordCancellationRequest({ memberEmail: 'member@example.com' })
    expect(result).toEqual({ ok: false, error: 'stripe_update_failed' })
    expect(mocks.dbUpdate).not.toHaveBeenCalled()
  })

  it('confirms live Stripe cancellation before updating local state', async () => {
    const result = await recordCancellationRequest({ memberEmail: 'member@example.com' })
    expect(result).toMatchObject({ ok: true, stripeScheduled: true })
    expect(mocks.stripeUpdate).toHaveBeenCalledWith(
      'sub_live_member',
      { cancel_at_period_end: true },
      { idempotencyKey: 'jpv-member-cancel-42-1790294400' },
    )
    expect(mocks.stripeUpdate.mock.invocationCallOrder[0]).toBeLessThan(mocks.dbUpdate.mock.invocationCallOrder[0]!)
  })

  it('confirms cancellation reversal in Stripe before clearing local state', async () => {
    mocks.findUnique.mockResolvedValue({
      id: 42,
      commitmentStatus: 'cancellation_requested',
      stripeSubscriptionId: 'sub_live_member',
      subscriptionCancelAtPeriodEnd: true,
      cancellationRequestedAt: new Date(),
      cancellationEffectiveAt: periodEnd,
    })
    mocks.retrieve.mockResolvedValue({
      id: 'sub_live_member', livemode: true, cancel_at: null, cancel_at_period_end: true,
    })

    const result = await reverseCancellationRequest({ memberEmail: 'member@example.com' })
    expect(result).toEqual({ ok: true })
    expect(mocks.stripeUpdate).toHaveBeenCalledWith(
      'sub_live_member',
      { cancel_at: null, cancel_at_period_end: false },
      { idempotencyKey: 'jpv-member-resume-42' },
    )
    expect(mocks.stripeUpdate.mock.invocationCallOrder[0]).toBeLessThan(mocks.dbUpdate.mock.invocationCallOrder[0]!)
  })
})
