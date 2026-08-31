import { beforeEach, describe, expect, it, vi } from 'vitest'

const { findUnique, getStripe } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  getStripe: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('@/libs/prisma', () => ({
  default: {
    customerProvisioning: { findUnique },
  },
}))

vi.mock('@/lib/stripe', () => ({ getStripe }))

import { getBillingStatus } from '@/lib/billing/billingStatusHelper'

describe('getBillingStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reconciles an older customer record from the linked Stripe customer when local status is missing', async () => {
    findUnique.mockResolvedValue({
      stripeCustomerId: 'cus_member',
      subscriptionStatus: null,
      subscriptionCurrentPeriodEnd: null,
      subscriptionCancelAtPeriodEnd: null,
      billingCadence: null,
      commitmentStatus: null,
      commitmentStartAt: null,
      commitmentEndAt: null,
      cancellationRequestedAt: null,
      cancellationEffectiveAt: null,
      paymentGraceEndsAt: null,
      paymentStatus: null,
      paymentFailedAt: null,
      paymentRefundedAt: null,
      paymentDisputeStatus: null,
      paymentDisputedAt: null,
      paymentDisputeResolvedAt: null,
    })
    const subscriptionsList = vi.fn().mockResolvedValue({
      data: [
        {
          created: 2,
          status: 'active',
          cancel_at_period_end: false,
          current_period_end: 1_800_000_000,
          items: { data: [{ price: { recurring: { interval: 'month' } } }] },
        },
      ],
    })
    getStripe.mockReturnValue({ subscriptions: { list: subscriptionsList } })

    const result = await getBillingStatus('member@example.com')

    expect(result.subscriptionStatus).toBe('active')
    expect(result.hasActiveSubscription).toBe(true)
    expect(result.billingAccessState).toBe('available')
    expect(result.billingCadence).toBe('monthly_commitment')
    expect(subscriptionsList).toHaveBeenCalledWith({
      customer: 'cus_member',
      status: 'all',
      limit: 100,
    })
  })

  it('does not replace an explicit local terminal state with provider enrichment', async () => {
    findUnique.mockResolvedValue({
      stripeCustomerId: 'cus_member',
      subscriptionStatus: 'canceled',
      subscriptionCurrentPeriodEnd: null,
      subscriptionCancelAtPeriodEnd: false,
      billingCadence: null,
      commitmentStatus: null,
      commitmentStartAt: null,
      commitmentEndAt: null,
      cancellationRequestedAt: null,
      cancellationEffectiveAt: null,
      paymentGraceEndsAt: null,
      paymentStatus: null,
      paymentFailedAt: null,
      paymentRefundedAt: null,
      paymentDisputeStatus: null,
      paymentDisputedAt: null,
      paymentDisputeResolvedAt: null,
    })

    const result = await getBillingStatus('member@example.com')

    expect(result.subscriptionStatus).toBe('canceled')
    expect(result.hasActiveSubscription).toBe(false)
    expect(getStripe).not.toHaveBeenCalled()
  })

  it('refreshes a recoverable incomplete projection from the current provider state', async () => {
    findUnique.mockResolvedValue({
      stripeCustomerId: 'cus_member',
      subscriptionStatus: 'incomplete',
      subscriptionCurrentPeriodEnd: null,
      subscriptionCancelAtPeriodEnd: null,
      billingCadence: null,
      commitmentStatus: null,
      commitmentStartAt: null,
      commitmentEndAt: null,
      cancellationRequestedAt: null,
      cancellationEffectiveAt: null,
      paymentGraceEndsAt: null,
      paymentStatus: null,
      paymentFailedAt: null,
      paymentRefundedAt: null,
      paymentDisputeStatus: null,
      paymentDisputedAt: null,
      paymentDisputeResolvedAt: null,
    })
    const subscriptionsList = vi.fn().mockResolvedValue({
      data: [
        {
          created: 2,
          status: 'active',
          cancel_at_period_end: false,
          current_period_end: 1_800_000_000,
          items: { data: [{ price: { recurring: { interval: 'month' } } }] },
        },
      ],
    })
    getStripe.mockReturnValue({ subscriptions: { list: subscriptionsList } })

    const result = await getBillingStatus('member@example.com')

    expect(result.subscriptionStatus).toBe('active')
    expect(result.hasActiveSubscription).toBe(true)
    expect(result.billingAccessState).toBe('available')
    expect(subscriptionsList).toHaveBeenCalledWith({
      customer: 'cus_member',
      status: 'all',
      limit: 100,
    })
  })
})
