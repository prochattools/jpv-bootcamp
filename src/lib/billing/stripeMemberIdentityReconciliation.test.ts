import { beforeEach, describe, expect, it, vi } from 'vitest'

import type Stripe from 'stripe'

import type { PayloadCourseWriteAPI, PayloadDocument } from '@/lib/payloadCourse/accessService'
import {
  applyStripeMemberIdentityBackfill,
  buildStripeMemberIdentityReport,
} from '@/lib/billing/stripeMemberIdentityReconciliation'

vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: vi.fn() }))

function makeSubscription(
  id: string,
  customer: Stripe.Customer,
  status: Stripe.Subscription.Status = 'active',
): Stripe.Subscription {
  return {
    id,
    object: 'subscription',
    status,
    customer,
    items: { object: 'list', data: [], has_more: false, url: '' },
    cancel_at_period_end: false,
    canceled_at: null,
    current_period_start: 100,
    current_period_end: 200,
  } as Stripe.Subscription
}

function makeStripe(subscriptions: Stripe.Subscription[]): Stripe {
  return {
    subscriptions: {
      list: vi.fn(async () => ({ object: 'list', data: subscriptions, has_more: false, url: '' })),
    },
    customers: {
      retrieve: vi.fn(),
    },
  } as unknown as Stripe
}

function makePayload(data: Record<string, PayloadDocument[]>): PayloadCourseWriteAPI {
  return {
    find: vi.fn(async ({ collection }: { collection: string }) => ({
      docs: data[collection] ?? [],
      hasNextPage: false,
    })),
    findByID: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  } as unknown as PayloadCourseWriteAPI
}

describe('Stripe member identity reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('prefers customer IDs and only falls back to unambiguous normalized email', async () => {
    const linkedCustomer = { id: 'cus_linked', object: 'customer', email: 'linked@example.test', name: 'Linked' } as Stripe.Customer
    const emailCustomer = { id: 'cus_email', object: 'customer', email: ' EMAILMATCH@example.test ', name: 'Email Match' } as Stripe.Customer
    const unmatchedCustomer = { id: 'cus_unmatched', object: 'customer', email: 'new@example.test', name: 'New Member' } as Stripe.Customer
    const payload = makePayload({
      payload_members: [
        { id: 'member-linked', email: 'different@example.test', accountStatus: 'active' },
        { id: 'member-email', email: 'emailmatch@example.test', accountStatus: 'active' },
      ],
      payload_billing_accounts: [{ id: 'billing-1', member: 'member-linked', stripeCustomerId: 'cus_linked' }],
    })
    const stripe = makeStripe([
      makeSubscription('sub-linked', linkedCustomer),
      makeSubscription('sub-email', emailCustomer),
      makeSubscription('sub-unmatched', unmatchedCustomer),
    ])

    const report = await buildStripeMemberIdentityReport({
      payload,
      stripe,
      livemode: true,
      now: () => new Date('2026-08-27T00:00:00.000Z'),
    })

    expect(report.generatedAt).toBe('2026-08-27T00:00:00.000Z')
    expect(report.totals).toEqual({
      stripeActiveSubscriptions: 3,
      payloadActiveMembers: 2,
      matchedByCustomerId: 1,
      matchedByEmail: 1,
      unmatched: 1,
      ambiguous: 0,
      inactiveLocalMember: 0,
      invalid: 0,
    })
    expect(report.rows.map((row) => [row.subscriptionId, row.match, row.memberId])).toEqual([
      ['sub-linked', 'customer_id', 'member-linked'],
      ['sub-email', 'email', 'member-email'],
      ['sub-unmatched', 'unmatched', null],
    ])
  })

  it('fails closed on ambiguity and never provisions an ambiguous identity', async () => {
    const customer = { id: 'cus_duplicate', object: 'customer', email: 'duplicate@example.test', name: 'Duplicate' } as Stripe.Customer
    const payload = makePayload({
      payload_members: [
        { id: 'member-a', email: 'duplicate@example.test', accountStatus: 'active' },
        { id: 'member-b', email: 'duplicate@example.test', accountStatus: 'active' },
      ],
      payload_billing_accounts: [],
    })
    const provisionMember = vi.fn()

    await expect(applyStripeMemberIdentityBackfill({
      payload,
      stripe: makeStripe([makeSubscription('sub-duplicate', customer)]),
      livemode: true,
      expectedUnmatched: 0,
      provisionMember,
    })).rejects.toThrow('stripe_member_identity_backfill_review_required')

    expect(provisionMember).not.toHaveBeenCalled()
  })

  it('creates only the exact unmatched identities after the live guard passes', async () => {
    const customer = { id: 'cus_new', object: 'customer', email: 'new@example.test', name: 'New Member' } as Stripe.Customer
    const payload = makePayload({ payload_members: [], payload_billing_accounts: [] })
    const provisionMember = vi.fn(async () => ({ memberId: 'member-new', created: true, password: 'ignored-test-value' }))

    const result = await applyStripeMemberIdentityBackfill({
      payload,
      stripe: makeStripe([makeSubscription('sub-new', customer)]),
      livemode: true,
      expectedUnmatched: 1,
      provisionMember,
    })

    expect(result.created).toBe(1)
    expect(result.alreadyPresent).toBe(0)
    expect(provisionMember).toHaveBeenCalledWith({
      email: 'new@example.test',
      displayName: 'New Member',
      stripeCustomerId: 'cus_new',
      source: 'stripe_checkout',
    })
  })
})
