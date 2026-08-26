import assert from 'node:assert/strict'

import type Stripe from 'stripe'

import {
  decideBillingAccessTransition,
  mirrorStripeEventToPayload,
} from '../src/lib/payloadCourse/stripeShadowSync'
import type {
  PayloadCourseWriteAPI,
  PayloadDocument,
  PayloadId,
} from '../src/lib/payloadCourse/accessService'

type CollectionMap = Record<string, PayloadDocument[]>

function relationValue(value: unknown) {
  if (value && typeof value === 'object' && 'id' in value) {
    return String((value as { id: PayloadId }).id)
  }
  return String(value)
}

function matchesCondition(value: unknown, condition: unknown): boolean {
  if (!condition || typeof condition !== 'object') return value === condition
  const record = condition as Record<string, unknown>

  if ('equals' in record) {
    const expected = String(record.equals)
    if (Array.isArray(value)) return value.some((item) => relationValue(item) === expected)
    return relationValue(value) === expected
  }

  return false
}

function matchesWhere(doc: PayloadDocument, where?: Record<string, unknown>): boolean {
  if (!where) return true
  if (Array.isArray(where.and)) {
    return where.and.every((condition) => matchesWhere(doc, condition as Record<string, unknown>))
  }

  return Object.entries(where).every(([field, condition]) => {
    if (field === 'and') return true
    return matchesCondition(doc[field], condition)
  })
}

class FakePayload implements PayloadCourseWriteAPI {
  private nextId = 100

  constructor(private readonly collections: CollectionMap) {}

  async find(args: { collection: string; where?: Record<string, unknown>; limit?: number }) {
    const docs = [...(this.collections[args.collection] ?? [])].filter((doc) => matchesWhere(doc, args.where))
    return { docs: docs.slice(0, args.limit ?? docs.length) }
  }

  async findByID(args: { collection: string; id: PayloadId }) {
    const doc = (this.collections[args.collection] ?? []).find((item) => String(item.id) === String(args.id))
    if (!doc) throw new Error(`missing ${args.collection}:${args.id}`)
    return doc
  }

  async create(args: { collection: string; data: Record<string, unknown> }) {
    const doc = {
      id: `${args.collection}_${this.nextId++}`,
      ...args.data,
    }
    this.collections[args.collection] = this.collections[args.collection] ?? []
    this.collections[args.collection].push(doc)
    return doc
  }

  async update(args: { collection: string; id: PayloadId; data: Record<string, unknown> }) {
    const docs = this.collections[args.collection] ?? []
    const index = docs.findIndex((doc) => String(doc.id) === String(args.id))
    if (index < 0) throw new Error(`missing ${args.collection}:${args.id}`)
    docs[index] = {
      ...docs[index],
      ...args.data,
    }
    return docs[index]
  }

  countDocs(collection: string) {
    return (this.collections[collection] ?? []).length
  }

  docs(collection: string) {
    return this.collections[collection] ?? []
  }
}

function buildPayload(overrides: Partial<CollectionMap> = {}) {
  return new FakePayload({
    payload_members: [],
    payload_member_security_events: [],
    payload_contacts: [],
    payload_billing_accounts: [],
    payload_subscriptions: [],
    payload_payments: [],
    payload_stripe_events: [],
    payload_billing_actions: [],
    payload_audit_events: [],
    payload_email_events: [],
    payload_membership_support_records: [],
    payload_membership_reconciliations: [],
    payload_membership_review_queue_items: [],
    payload_stripe_shadow_projections: [],
    ...overrides,
  })
}

function subscription(overrides: Partial<Stripe.Subscription> = {}): Stripe.Subscription {
  return {
    id: 'sub_123',
    object: 'subscription',
    status: 'active',
    customer: {
      id: 'cus_123',
      object: 'customer',
      email: 'student@example.com',
      deleted: false,
    } as unknown as Stripe.Customer,
    metadata: { plan: 'pro' },
    items: { object: 'list', data: [], has_more: false, url: '' },
    cancel_at: null,
    cancel_at_period_end: false,
    canceled_at: null,
    current_period_start: 1782000000,
    current_period_end: 1784600000,
    trial_end: null,
    default_payment_method: null,
    ...overrides,
  } as Stripe.Subscription
}

function invoice(overrides: Partial<Stripe.Invoice> = {}): Stripe.Invoice {
  return {
    id: 'in_123',
    object: 'invoice',
    customer: 'cus_123',
    customer_email: 'student@example.com',
    subscription: 'sub_123',
    amount_paid: 4900,
    amount_due: 4900,
    amount_remaining: 4900,
    currency: 'gbp',
    hosted_invoice_url: 'https://stripe.example/invoice',
    status_transitions: { paid_at: 1782000100 } as Stripe.Invoice.StatusTransitions,
    ...overrides,
  } as Stripe.Invoice
}

function charge(overrides: Partial<Stripe.Charge> = {}): Stripe.Charge {
  return {
    id: 'ch_123',
    object: 'charge',
    customer: 'cus_123',
    invoice: 'in_123',
    payment_intent: 'pi_123',
    amount: 4900,
    amount_refunded: 4900,
    currency: 'gbp',
    billing_details: {
      address: null,
      email: 'student@example.com',
      name: 'Student Example',
      phone: null,
      tax_id: null,
    },
    ...overrides,
  } as Stripe.Charge
}

function dispute(overrides: Partial<Stripe.Dispute> = {}): Stripe.Dispute {
  return {
    id: 'dp_123',
    object: 'dispute',
    amount: 4900,
    currency: 'gbp',
    charge: charge(),
    payment_intent: 'pi_123',
    status: 'needs_response',
    reason: 'fraudulent',
    ...overrides,
  } as Stripe.Dispute
}

function event(type: string, object: unknown, id = `evt_${type.replace(/\W+/g, '_')}`, created = 1782000000): Stripe.Event {
  return {
    id,
    object: 'event',
    api_version: '2024-06-20',
    created,
    data: { object },
    livemode: true,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type,
  } as Stripe.Event
}

function membershipSubscription(overrides: Partial<Stripe.Subscription> = {}): Stripe.Subscription {
  return {
    id: 'sub_membership_1',
    object: 'subscription',
    status: 'active',
    customer: {
      id: 'cus_membership_1',
      object: 'customer',
      email: 'support@example.com',
      deleted: false,
    } as unknown as Stripe.Customer,
    metadata: {
      fundingSource: 'voucher',
      voucherDuration: 'one_month',
      billingCadence: 'monthly',
    },
    discount: {
      coupon: { id: 'coupon_membership_1' },
      promotion_code: {
        id: 'promo_membership_1',
        active: true,
      },
    } as unknown as Stripe.Discount,
    items: {
      object: 'list',
      data: [
        {
          id: 'si_membership_1',
          object: 'subscription_item',
          price: {
            id: 'price_membership_monthly',
            object: 'price',
            active: true,
            currency: 'gbp',
            recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' } as Stripe.Price.Recurring,
            product: {
              id: 'prod_membership',
              object: 'product',
              active: true,
              name: 'JPV Bootcamp Membership',
            } as Stripe.Product,
          } as Stripe.Price,
        } as Stripe.SubscriptionItem,
      ],
      has_more: false,
      url: '',
    },
    cancel_at: null,
    cancel_at_period_end: false,
    canceled_at: null,
    current_period_start: 1782000000,
    current_period_end: 1784600000,
    trial_end: null,
    default_payment_method: null,
    ...overrides,
  } as Stripe.Subscription
}

function membershipCheckoutSession(overrides: Partial<Stripe.Checkout.Session> = {}): Stripe.Checkout.Session {
  return {
    id: 'cs_membership_1',
    object: 'checkout.session',
    mode: 'subscription',
    customer: 'cus_membership_1',
    customer_email: 'support@example.com',
    subscription: 'sub_membership_1',
    discount: {
      coupon: { id: 'coupon_membership_1' },
      promotion_code: {
        id: 'promo_membership_1',
        active: true,
      },
    } as unknown as Stripe.Discount,
    metadata: {
      fundingSource: 'voucher',
      voucherDuration: 'one_month',
      billingCadence: 'monthly',
    },
    ...overrides,
  } as Stripe.Checkout.Session
}

function membershipInvoice(overrides: Partial<Stripe.Invoice> = {}): Stripe.Invoice {
  return {
    id: 'in_membership_1',
    object: 'invoice',
    customer: 'cus_membership_1',
    customer_email: 'support@example.com',
    subscription: 'sub_membership_1',
    amount_paid: 8000,
    amount_due: 8000,
    amount_remaining: 0,
    currency: 'gbp',
    hosted_invoice_url: 'https://stripe.example/invoice',
    discount: {
      coupon: { id: 'coupon_membership_1' },
      promotion_code: {
        id: 'promo_membership_1',
        active: true,
      },
    },
    status_transitions: { paid_at: 1782000100 } as Stripe.Invoice.StatusTransitions,
    ...overrides,
  } as Stripe.Invoice
}

function membershipCustomer(overrides: Partial<Stripe.Customer> = {}): Stripe.Customer {
  return {
    id: 'cus_membership_1',
    object: 'customer',
    email: 'support@example.com',
    discount: {
      coupon: { id: 'coupon_membership_1' },
      promotion_code: {
        id: 'promo_membership_1',
        active: true,
      },
    } as unknown as Stripe.Discount,
    ...overrides,
  } as Stripe.Customer
}

function fakeStripe(subscriptionRecord = subscription()): Pick<Stripe, 'subscriptions' | 'customers'> {
  return {
    subscriptions: {
      retrieve: async () => subscriptionRecord,
    } as unknown as Stripe.SubscriptionsResource,
    customers: {
      retrieve: async () => ({
        id: 'cus_123',
        object: 'customer',
        email: 'student@example.com',
      } as Stripe.Customer),
    } as unknown as Stripe.CustomersResource,
  }
}

async function run() {
  assert.deepEqual(
    decideBillingAccessTransition({ accountStatus: 'active', billingHoldReason: null }, 'past_due'),
    { action: 'hold', reason: 'past_due' },
  )
  assert.deepEqual(
    decideBillingAccessTransition({ accountStatus: 'active', billingHoldReason: null }, 'unpaid'),
    { action: 'hold', reason: 'unpaid' },
  )
  assert.deepEqual(
    decideBillingAccessTransition({ accountStatus: 'active', billingHoldReason: null }, 'canceled'),
    { action: 'hold', reason: 'canceled' },
  )
  assert.deepEqual(
    decideBillingAccessTransition({ accountStatus: 'blocked', billingHoldReason: 'past_due' }, 'active'),
    { action: 'restore', reason: 'billing_recovered' },
  )
  assert.deepEqual(
    decideBillingAccessTransition({ accountStatus: 'blocked', billingHoldReason: 'manual_review' }, 'active'),
    { action: 'none', reason: 'manual_status' },
  )
  assert.deepEqual(
    decideBillingAccessTransition({ accountStatus: 'suspended', billingHoldReason: null }, 'active'),
    { action: 'none', reason: 'manual_status' },
  )
  assert.deepEqual(
    decideBillingAccessTransition({ accountStatus: 'deleted', billingHoldReason: null }, 'active'),
    { action: 'none', reason: 'manual_status' },
  )
  assert.deepEqual(
    decideBillingAccessTransition({ accountStatus: 'pending', billingHoldReason: null }, 'active'),
    { action: 'none', reason: 'pending_member' },
  )

  {
    const payload = buildPayload()
    const stripeEvent = event('customer.subscription.updated', subscription(), 'evt_sub_active')

    const result = await mirrorStripeEventToPayload(payload, stripeEvent, {
      stripe: fakeStripe(),
      adminEmail: 'admin@example.com',
    })

    assert.equal(result.processed, true)
    assert.equal(payload.countDocs('payload_members'), 1)
    assert.equal(payload.docs('payload_members')[0]?.accountStatus, 'active')
    assert.equal(payload.countDocs('payload_billing_accounts'), 1)
    assert.equal(payload.docs('payload_billing_accounts')[0]?.billingStatus, 'active')
    assert.equal(payload.countDocs('payload_subscriptions'), 1)
    assert.equal(payload.docs('payload_subscriptions')[0]?.plan, 'jpv_bootcamp_membership')
    assert.equal(payload.countDocs('payload_email_events'), 2)
    assert.equal(payload.docs('payload_stripe_events')[0]?.processingStatus, 'processed')

    const duplicate = await mirrorStripeEventToPayload(payload, stripeEvent, {
      stripe: fakeStripe(),
      adminEmail: 'admin@example.com',
    })

    assert.equal(duplicate.deduped, true)
    assert.equal(payload.countDocs('payload_members'), 1)
    assert.equal(payload.countDocs('payload_subscriptions'), 1)
    assert.equal(payload.countDocs('payload_email_events'), 2)
  }

  {
    const payload = buildPayload()
    const stripeEvent = event('customer.subscription.updated', subscription(), 'evt_reconcile_repairs_missing_projection')

    await mirrorStripeEventToPayload(payload, stripeEvent, {
      stripe: fakeStripe(),
      suppressCommunications: true,
    })
    payload.docs('payload_subscriptions').splice(0, 1)

    const normalRetry = await mirrorStripeEventToPayload(payload, stripeEvent, {
      stripe: fakeStripe(),
      suppressCommunications: true,
    })
    assert.equal(normalRetry.deduped, true)
    assert.equal(payload.countDocs('payload_subscriptions'), 0)

    const repair = await mirrorStripeEventToPayload(payload, stripeEvent, {
      stripe: fakeStripe(),
      suppressCommunications: true,
      reconciliationRepair: true,
    })
    assert.equal(repair.processed, true)
    assert.equal(repair.deduped, false)
    assert.equal(payload.countDocs('payload_subscriptions'), 1)
    assert.equal(payload.docs('payload_subscriptions')[0]?.stripeSubscriptionId, 'sub_123')
  }

  {
    const payload = buildPayload()
    const stripeEvent = event('customer.subscription.updated', subscription(), 'evt_reconcile_unknown_member')

    const result = await mirrorStripeEventToPayload(payload, stripeEvent, {
      stripe: fakeStripe(),
      preserveMemberStatus: true,
      suppressCommunications: true,
    })

    assert.equal(result.processed, true)
    assert.ok(result.actions.includes('subscription_review_required_no_matching_local_member'))
    assert.equal(payload.countDocs('payload_members'), 0)
    assert.equal(payload.countDocs('payload_billing_accounts'), 0)
    assert.equal(payload.countDocs('payload_subscriptions'), 0)
    assert.equal(payload.docs('payload_billing_actions')[0]?.notes, 'no_matching_local_member')
    assert.equal(payload.countDocs('payload_stripe_shadow_projections'), 1)
    assert.equal(payload.docs('payload_stripe_shadow_projections')[0]?.shadowState, 'mismatch')
    assert.equal(payload.docs('payload_stripe_shadow_projections')[0]?.stripeSubscriptionId, 'sub_123')
    assert.equal(
      (payload.docs('payload_stripe_shadow_projections')[0]?.metadata as Record<string, unknown>)?.identityState,
      'unresolved',
    )

    await mirrorStripeEventToPayload(payload, event('customer.subscription.updated', subscription(), 'evt_reconcile_unknown_member_retry'), {
      stripe: fakeStripe(),
      preserveMemberStatus: true,
      suppressCommunications: true,
    })
    assert.equal(payload.countDocs('payload_stripe_shadow_projections'), 1)
  }

  {
    const payload = buildPayload()
    const unresolvedInvoice = invoice({
      id: 'in_unresolved_1',
      customer: 'cus_unresolved_1',
      customer_email: null,
      subscription: 'sub_unresolved_1',
      status: 'paid',
      amount_paid: 8000,
      amount_due: 8000,
      amount_remaining: 0,
    })
    const unresolvedSubscription = subscription({
      id: 'sub_unresolved_1',
      customer: 'cus_unresolved_1',
      status: 'canceled',
    })
    const result = await mirrorStripeEventToPayload(
      payload,
      event('invoice.paid', unresolvedInvoice, 'evt_reconcile_unknown_invoice'),
      {
        stripe: fakeStripe(unresolvedSubscription),
        preserveMemberStatus: true,
        suppressCommunications: true,
      },
    )

    assert.equal(result.processed, true)
    assert.ok(result.actions.includes('invoice_review_required_unresolved_identity'))
    assert.equal(payload.countDocs('payload_members'), 0)
    assert.equal(payload.countDocs('payload_payments'), 1)
    assert.equal(payload.docs('payload_payments')[0]?.stripeInvoiceId, 'in_unresolved_1')
    assert.equal(payload.docs('payload_payments')[0]?.status, 'paid')
    assert.equal(payload.countDocs('payload_stripe_shadow_projections'), 1)
    assert.equal(payload.docs('payload_stripe_shadow_projections')[0]?.stripeInvoiceId, 'in_unresolved_1')
  }

  {
    const payload = buildPayload({
      payload_members: [{
        id: 'member_stale_guard',
        email: 'student@example.com',
        accountStatus: 'active',
      }],
      payload_subscriptions: [{
        id: 'subscription_stale_guard',
        stripeSubscriptionId: 'sub_123',
        status: 'active',
        metadata: { lastStripeEventCreatedAt: 200 },
      }],
    })
    const staleSubscription = subscription({ status: 'canceled' })

    const result = await mirrorStripeEventToPayload(
      payload,
      event('customer.subscription.updated', staleSubscription, 'evt_stale_subscription', 100),
      { stripe: fakeStripe(staleSubscription), adminEmail: 'admin@example.com' },
    )

    assert.equal(result.processed, false)
    assert.deepEqual(result.actions, ['stale_event_skipped'])
    assert.equal(payload.docs('payload_members')[0]?.accountStatus, 'active')
    assert.equal(payload.docs('payload_subscriptions')[0]?.status, 'active')
    assert.equal(payload.docs('payload_stripe_events')[0]?.processingStatus, 'skipped')
    assert.equal(
      payload.docs('payload_stripe_events')[0]?.failureReason,
      'stale_event_created_at:100<200',
    )
  }

  {
    const payload = buildPayload()
    const unknownPlanSubscription = subscription({
      metadata: {},
      items: {
        object: 'list',
        has_more: false,
        url: '',
        data: [
          {
            id: 'si_unknown',
            object: 'subscription_item',
            price: {
              id: 'price_unknown',
              object: 'price',
              product: 'prod_unknown',
            } as unknown as Stripe.Price,
          } as Stripe.SubscriptionItem,
        ],
      },
    })

    await mirrorStripeEventToPayload(
      payload,
      event('customer.subscription.updated', unknownPlanSubscription, 'evt_unknown_plan'),
      {
        stripe: fakeStripe(unknownPlanSubscription),
        adminEmail: 'admin@example.com',
      }
    )

    assert.equal(payload.docs('payload_members')[0]?.accountStatus, 'blocked')
    assert.equal(payload.docs('payload_members')[0]?.billingHoldReason, 'billing_hold')
    assert.equal(payload.docs('payload_billing_accounts')[0]?.billingStatus, 'billing_hold')
    assert.equal(payload.docs('payload_subscriptions')[0]?.plan, 'jpv_bootcamp_membership')
    assert.equal(
      payload.docs('payload_email_events').some((emailEvent) => emailEvent.templateKey === 'subscription-started'),
      false
    )
  }

  {
    const payload = buildPayload({
      payload_members: [
        {
          id: 'member_1',
          email: 'student@example.com',
          accountStatus: 'active',
          billingHoldReason: null,
        },
      ],
    })
    const canceling = subscription({
      cancel_at_period_end: true,
      canceled_at: 1782000200,
    })

    await mirrorStripeEventToPayload(payload, event('customer.subscription.updated', canceling, 'evt_cancel'), {
      stripe: fakeStripe(canceling),
      adminEmail: 'admin@example.com',
    })

    assert.equal(payload.docs('payload_members')[0]?.accountStatus, 'active')
    assert.equal(payload.docs('payload_members')[0]?.billingHoldReason, null)
    assert.equal(payload.docs('payload_subscriptions')[0]?.cancelAtPeriodEnd, true)
    assert.equal(payload.docs('payload_billing_accounts')[0]?.billingStatus, 'active')
    assert.equal(payload.countDocs('payload_member_security_events'), 0)
  }

  {
    const failedSub = subscription()
    const payload = buildPayload({
      payload_members: [
        {
          id: 'member_1',
          email: 'student@example.com',
          accountStatus: 'active',
          billingHoldReason: null,
        },
      ],
    })

    await mirrorStripeEventToPayload(payload, event('invoice.payment_failed', invoice(), 'evt_payment_failed_1'), {
      stripe: fakeStripe(failedSub),
      adminEmail: 'admin@example.com',
    })
    await mirrorStripeEventToPayload(payload, event('invoice.payment_failed', invoice(), 'evt_payment_failed_2'), {
      stripe: fakeStripe(failedSub),
      adminEmail: 'admin@example.com',
    })

    assert.equal(payload.docs('payload_members')[0]?.accountStatus, 'active')
    assert.equal(payload.docs('payload_members')[0]?.billingHoldReason, null)
    assert.equal(payload.docs('payload_payments')[0]?.status, 'failed')
    assert.equal(payload.docs('payload_billing_accounts')[0]?.billingStatus, 'past_due')
    assert.equal(payload.countDocs('payload_subscriptions'), 1)
    assert.ok(payload.docs('payload_subscriptions')[0]?.paymentGraceEndsAt)
    assert.equal(
      payload.docs('payload_email_events').filter((emailEvent) => emailEvent.templateKey === 'billing-payment-failed').length,
      1
    )
    assert.equal(
      payload.docs('payload_member_security_events').filter((securityEvent) => securityEvent.eventType === 'billing_payment_failed').length,
      1
    )
    assert.equal(
      payload.docs('payload_billing_actions').filter((action) => action.actionType === 'access_blocked').length,
      0
    )
  }

  {
    const payload = buildPayload({
      payload_members: [
        {
          id: 'member_1',
          email: 'student@example.com',
          accountStatus: 'blocked',
          billingHoldReason: 'past_due',
        },
      ],
      payload_billing_accounts: [
        {
          id: 'billing_1',
          member: 'member_1',
          stripeCustomerId: 'cus_123',
          billingStatus: 'past_due',
        },
      ],
    })

    await mirrorStripeEventToPayload(payload, event('invoice.paid', invoice(), 'evt_payment_recovered'), {
      stripe: fakeStripe(subscription()),
      adminEmail: 'admin@example.com',
    })

    assert.equal(payload.docs('payload_members')[0]?.accountStatus, 'active')
    assert.equal(payload.docs('payload_members')[0]?.billingHoldReason, null)
    assert.equal(payload.docs('payload_payments')[0]?.status, 'paid')
    assert.equal(payload.docs('payload_billing_accounts')[0]?.billingStatus, 'active')
    assert.equal(
      payload.docs('payload_email_events').filter((emailEvent) => emailEvent.templateKey === 'billing-payment-recovered').length,
      1
    )
    assert.equal(
      payload.docs('payload_member_security_events').filter((securityEvent) => securityEvent.eventType === 'billing_payment_recovered').length,
      1
    )
    assert.equal(
      payload.docs('payload_billing_actions').filter((action) => action.actionType === 'access_restored').length,
      1
    )
  }

  {
    const payload = buildPayload({
      payload_members: [
        {
          id: 'member_1',
          email: 'student@example.com',
          accountStatus: 'active',
          billingHoldReason: null,
        },
      ],
      payload_contacts: [
        { id: 'contact_1', member: 'member_1', email: 'student@example.com' },
      ],
      payload_billing_accounts: [
        {
          id: 'billing_1',
          member: 'member_1',
          stripeCustomerId: 'cus_123',
          billingStatus: 'active',
        },
      ],
      payload_payments: [
        {
          id: 'payment_1',
          member: 'member_1',
          stripeInvoiceId: 'in_123',
          stripePaymentIntentId: 'pi_123',
          amount: 4900,
          currency: 'gbp',
          status: 'paid',
          metadata: {},
        },
      ],
    })

    await mirrorStripeEventToPayload(payload, event('charge.refunded', charge(), 'evt_refund_1'), {
      stripe: fakeStripe(),
    })
    await mirrorStripeEventToPayload(payload, event('charge.refunded', charge(), 'evt_refund_2'), {
      stripe: fakeStripe(),
    })

    assert.equal(payload.docs('payload_payments')[0]?.status, 'refunded')
    assert.equal(payload.docs('payload_members')[0]?.accountStatus, 'active')
    assert.equal(
      payload.docs('payload_email_events').filter((emailEvent) => emailEvent.templateKey === 'billing-payment-refunded').length,
      1,
    )
    assert.equal(
      payload.docs('payload_member_security_events').filter((item) => item.eventType === 'billing_payment_refunded').length,
      1,
    )
    assert.equal(
      payload.docs('payload_billing_actions').some((action) => action.actionType === 'access_blocked'),
      false,
    )
  }

  {
    const payload = buildPayload({
      payload_members: [
        {
          id: 'member_1',
          email: 'student@example.com',
          accountStatus: 'active',
          billingHoldReason: null,
        },
      ],
      payload_contacts: [
        { id: 'contact_1', member: 'member_1', email: 'student@example.com' },
      ],
      payload_billing_accounts: [
        {
          id: 'billing_1',
          member: 'member_1',
          stripeCustomerId: 'cus_123',
          billingStatus: 'active',
        },
      ],
      payload_payments: [
        {
          id: 'payment_1',
          member: 'member_1',
          stripeInvoiceId: 'in_123',
          stripePaymentIntentId: 'pi_123',
          amount: 4900,
          currency: 'gbp',
          status: 'paid',
          metadata: {},
        },
      ],
    })

    await mirrorStripeEventToPayload(payload, event('charge.dispute.created', dispute(), 'evt_dispute_open'), {
      stripe: fakeStripe(),
    })
    await mirrorStripeEventToPayload(
      payload,
      event('charge.dispute.closed', dispute({ status: 'won' }), 'evt_dispute_closed'),
      { stripe: fakeStripe() },
    )

    assert.equal(payload.docs('payload_payments')[0]?.status, 'dispute_resolved')
    assert.equal(payload.docs('payload_members')[0]?.accountStatus, 'active')
    assert.equal(
      payload.docs('payload_email_events').filter((emailEvent) => emailEvent.templateKey === 'billing-payment-disputed').length,
      1,
    )
    assert.equal(
      payload.docs('payload_member_security_events').filter((item) => item.eventType === 'billing_payment_disputed').length,
      1,
    )
    assert.equal(
      payload.docs('payload_member_security_events').filter((item) => item.eventType === 'billing_dispute_resolved').length,
      1,
    )
    assert.equal(
      payload.docs('payload_billing_actions').some((action) => action.actionType === 'access_blocked' || action.actionType === 'access_restored'),
      false,
    )
  }

  {
    const payload = buildPayload({
      payload_members: [
        {
          id: 'member_1',
          email: 'student@example.com',
          accountStatus: 'suspended',
          billingHoldReason: 'manual_review',
        },
      ],
    })

    await mirrorStripeEventToPayload(payload, event('invoice.paid', invoice(), 'evt_suspended_paid'), {
      stripe: fakeStripe(subscription()),
      adminEmail: 'admin@example.com',
    })

    assert.equal(payload.docs('payload_members')[0]?.accountStatus, 'suspended')
    assert.equal(payload.docs('payload_members')[0]?.billingHoldReason, 'manual_review')
    assert.equal(
      payload.docs('payload_billing_actions').some((action) => action.actionType === 'access_restored'),
      false,
    )
  }

  {
    const payload = buildPayload({
      payload_members: [
        {
          id: 'member_1',
          email: 'student@example.com',
          accountStatus: 'deleted',
          billingHoldReason: null,
        },
      ],
    })

    await mirrorStripeEventToPayload(payload, event('invoice.paid', invoice(), 'evt_deleted_paid'), {
      stripe: fakeStripe(subscription()),
      adminEmail: 'admin@example.com',
    })

    assert.equal(payload.docs('payload_members')[0]?.accountStatus, 'deleted')
    assert.equal(
      payload.docs('payload_billing_actions').some((action) => action.actionType === 'access_restored'),
      false,
    )
  }

  {
    const supportMember: {
      id: string
      email: string
      accountStatus: string
      billingHoldReason: string | null
    } = {
      id: 'member_support_1',
      email: 'support@example.com',
      accountStatus: 'active',
      billingHoldReason: null,
    }
    const supportBillingAccount = {
      id: 'billing_support_1',
      member: 'member_support_1',
      stripeCustomerId: 'cus_membership_1',
      billingStatus: 'active',
    }
    const supportRecord = {
      id: 'support_1',
      displayName: 'Membership support seed',
      member: 'member_support_1',
      memberEmail: 'support@example.com',
      fundingSource: 'voucher',
      voucherDuration: 'one_month',
      issuanceState: 'issued',
      billingCadence: 'monthly',
      stripeCustomerId: 'cus_membership_1',
      stripeSubscriptionId: 'sub_membership_1',
      stripePriceId: 'price_membership_monthly',
      stripeCouponId: 'coupon_membership_1',
      stripePromotionCodeId: 'promo_membership_1',
      approvalReference: 'webhook:seed',
      reconciliationState: 'matched',
      lastWebhookAt: '2026-06-20T00:00:00.000Z',
      notes: 'seed',
      metadata: {
        lastWebhookEventId: 'evt_seed',
        lastWebhookCreatedAt: '2026-06-20T00:00:00.000Z',
        lastReconciledAt: '2026-06-20T00:00:00.000Z',
      },
    }

    const payload = buildPayload({
      payload_members: [supportMember],
      payload_billing_accounts: [supportBillingAccount],
      payload_membership_support_records: [supportRecord],
    })
    const stripe = fakeStripe(membershipSubscription())

    const checkoutCompleted = event(
      'checkout.session.completed',
      membershipCheckoutSession(),
      'evt_membership_checkout_completed',
      1782001000,
    )
    const checkoutResult = await mirrorStripeEventToPayload(payload, checkoutCompleted, {
      stripe,
      adminEmail: 'admin@example.com',
    })
    assert.equal(checkoutResult.processed, true)
    assert.equal(payload.docs('payload_membership_support_records')[0]?.reconciliationState, 'matched')
    assert.equal(payload.docs('payload_membership_review_queue_items').length, 0)
    assert.equal(payload.docs('payload_stripe_shadow_projections')[0]?.shadowState, 'matched')

    const duplicateCheckout = await mirrorStripeEventToPayload(payload, checkoutCompleted, {
      stripe,
      adminEmail: 'admin@example.com',
    })
    assert.equal(duplicateCheckout.deduped, true)

    const staleCheckout = event(
      'checkout.session.completed',
      membershipCheckoutSession(),
      'evt_membership_checkout_stale',
      1782000000,
    )
    await mirrorStripeEventToPayload(payload, staleCheckout, {
      stripe,
      adminEmail: 'admin@example.com',
    })
    assert.equal(payload.docs('payload_membership_reconciliations')[0]?.reconciliationState, 'matched')

    const annualSubscription = membershipSubscription({
      id: 'sub_membership_2',
      customer: {
        id: 'cus_membership_2',
        object: 'customer',
        email: 'annual@example.com',
        deleted: false,
      } as unknown as Stripe.Customer,
      metadata: {
        fundingSource: 'pay_it_forward',
        voucherDuration: 'one_year',
        billingCadence: 'annual',
      },
      items: {
        object: 'list',
        data: [
          {
            id: 'si_membership_2',
            object: 'subscription_item',
            price: {
              id: 'price_membership_annual',
              object: 'price',
              active: true,
              currency: 'gbp',
              recurring: { interval: 'year', interval_count: 1, usage_type: 'licensed' } as Stripe.Price.Recurring,
              product: {
                id: 'prod_membership',
                object: 'product',
                active: true,
                name: 'JPV Bootcamp Membership',
              } as Stripe.Product,
            } as Stripe.Price,
          } as Stripe.SubscriptionItem,
        ],
        has_more: false,
        url: '',
      },
    })
    const payItForwardPayload = buildPayload({
      payload_members: [
        {
          id: 'member_support_2',
          email: 'annual@example.com',
          accountStatus: 'active',
          billingHoldReason: null,
        },
      ],
      payload_billing_accounts: [
        {
          id: 'billing_support_2',
          member: 'member_support_2',
          stripeCustomerId: 'cus_membership_2',
          billingStatus: 'active',
        },
      ],
      payload_membership_support_records: [
        {
          id: 'support_2',
          displayName: 'Membership support seed 2',
          member: 'member_support_2',
          memberEmail: 'annual@example.com',
          fundingSource: 'pay_it_forward',
          voucherDuration: 'one_year',
          issuanceState: 'issued',
          billingCadence: 'annual',
          stripeCustomerId: 'cus_membership_2',
          stripeSubscriptionId: 'sub_membership_2',
          stripePriceId: 'price_membership_annual',
          stripeCouponId: 'coupon_membership_2',
          stripePromotionCodeId: 'promo_membership_2',
          approvalReference: 'webhook:seed-2',
          reconciliationState: 'matched',
          lastWebhookAt: '2026-06-20T00:00:00.000Z',
          notes: 'seed',
          metadata: {
            lastWebhookEventId: 'evt_seed_2',
            lastWebhookCreatedAt: '2026-06-20T00:00:00.000Z',
            lastReconciledAt: '2026-06-20T00:00:00.000Z',
          },
        },
      ],
    })
    const payItForwardResult = await mirrorStripeEventToPayload(
      payItForwardPayload,
      event('customer.subscription.created', annualSubscription, 'evt_membership_subscription_created', 1782002000),
      { stripe: fakeStripe(annualSubscription), adminEmail: 'admin@example.com' },
    )
    assert.equal(payItForwardResult.processed, true)
    assert.equal(payItForwardPayload.docs('payload_membership_support_records')[0]?.fundingSource, 'pay_it_forward')
    assert.equal(payItForwardPayload.docs('payload_membership_support_records')[0]?.voucherDuration, 'one_year')
    assert.equal(payItForwardPayload.docs('payload_membership_reconciliations')[0]?.reconciliationState, 'matched')

    const paymentFailedResult = await mirrorStripeEventToPayload(
      payload,
      event('invoice.payment_failed', membershipInvoice(), 'evt_membership_payment_failed', 1782003000),
      { stripe, adminEmail: 'admin@example.com' },
    )
    assert.equal(paymentFailedResult.processed, true)
    assert.equal(payload.docs('payload_membership_reconciliations')[0]?.reconciliationState, 'failed')
    assert.equal(payload.docs('payload_membership_reconciliations')[0]?.failureCode, 'payment_failure')

    const paymentRecoveredResult = await mirrorStripeEventToPayload(
      payload,
      event('invoice.paid', membershipInvoice(), 'evt_membership_payment_recovered', 1782004000),
      { stripe, adminEmail: 'admin@example.com' },
    )
    assert.equal(paymentRecoveredResult.processed, true)
    assert.equal(payload.docs('payload_membership_review_queue_items')[0]?.queueState, 'closed')

    const customerMismatchPayload = buildPayload({
      payload_members: [
        {
          id: 'member_support_3',
          email: 'mismatch@example.com',
          accountStatus: 'active',
          billingHoldReason: null,
        },
      ],
      payload_billing_accounts: [
        {
          id: 'billing_support_3',
          member: 'member_support_3',
          stripeCustomerId: 'cus_membership_3',
          billingStatus: 'active',
        },
      ],
      payload_membership_support_records: [
        {
          id: 'support_3',
          displayName: 'Membership support seed 3',
          member: 'member_support_3',
          memberEmail: 'mismatch@example.com',
          fundingSource: 'voucher',
          voucherDuration: 'one_month',
          issuanceState: 'issued',
          billingCadence: 'monthly',
          stripeCustomerId: 'cus_membership_3',
          stripeSubscriptionId: 'sub_membership_3',
          stripePriceId: 'price_membership_monthly',
          stripeCouponId: 'coupon_membership_3',
          stripePromotionCodeId: 'promo_membership_3',
          approvalReference: 'webhook:seed-3',
          reconciliationState: 'matched',
          lastWebhookAt: '2026-06-20T00:00:00.000Z',
          notes: 'seed',
          metadata: {
            lastWebhookEventId: 'evt_seed_3',
            lastWebhookCreatedAt: '2026-06-20T00:00:00.000Z',
            lastReconciledAt: '2026-06-20T00:00:00.000Z',
          },
        },
      ],
    })
    const mismatchSubscription = membershipSubscription({
      id: 'sub_membership_3',
      customer: {
        id: 'cus_membership_mismatch',
        object: 'customer',
        email: 'mismatch@example.com',
        deleted: false,
      } as unknown as Stripe.Customer,
    })
    const mismatchResult = await mirrorStripeEventToPayload(
      customerMismatchPayload,
      event('customer.subscription.updated', mismatchSubscription, 'evt_membership_customer_mismatch', 1782005000),
      { stripe: fakeStripe(mismatchSubscription), adminEmail: 'admin@example.com' },
    )
    assert.equal(mismatchResult.processed, true)
    assert.equal(customerMismatchPayload.docs('payload_membership_reconciliations')[0]?.reconciliationState, 'mismatch')
    assert.equal(customerMismatchPayload.docs('payload_membership_review_queue_items')[0]?.queueReason, 'webhook_mismatch')

    const priceMismatchSubscription = membershipSubscription({
      id: 'sub_membership_3',
      customer: {
        id: 'cus_membership_3',
        object: 'customer',
        email: 'mismatch@example.com',
        deleted: false,
      } as unknown as Stripe.Customer,
      items: {
        object: 'list',
        data: [
          {
            id: 'si_membership_price_mismatch',
            object: 'subscription_item',
            price: {
              id: 'price_membership_other',
              object: 'price',
              active: true,
              currency: 'gbp',
              recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' } as Stripe.Price.Recurring,
              product: {
                id: 'prod_membership',
                object: 'product',
                active: true,
                name: 'JPV Bootcamp Membership',
              } as Stripe.Product,
            } as Stripe.Price,
          } as Stripe.SubscriptionItem,
        ],
        has_more: false,
        url: '',
      },
    })
    const priceMismatchPayload = buildPayload({
      payload_members: [
        {
          id: 'member_support_3',
          email: 'mismatch@example.com',
          accountStatus: 'active',
          billingHoldReason: null,
        },
      ],
      payload_billing_accounts: [
        {
          id: 'billing_support_3',
          member: 'member_support_3',
          stripeCustomerId: 'cus_membership_3',
          billingStatus: 'active',
        },
      ],
      payload_membership_support_records: [
        {
          id: 'support_3',
          displayName: 'Membership support seed 3',
          member: 'member_support_3',
          memberEmail: 'mismatch@example.com',
          fundingSource: 'voucher',
          voucherDuration: 'one_month',
          issuanceState: 'issued',
          billingCadence: 'monthly',
          stripeCustomerId: 'cus_membership_3',
          stripeSubscriptionId: 'sub_membership_3',
          stripePriceId: 'price_membership_monthly',
          stripeCouponId: 'coupon_membership_3',
          stripePromotionCodeId: 'promo_membership_3',
          approvalReference: 'webhook:seed-3',
          reconciliationState: 'matched',
          lastWebhookAt: '2026-06-20T00:00:00.000Z',
          notes: 'seed',
          metadata: {
            lastWebhookEventId: 'evt_seed_3',
            lastWebhookCreatedAt: '2026-06-20T00:00:00.000Z',
            lastReconciledAt: '2026-06-20T00:00:00.000Z',
          },
        },
      ],
    })
    const priceMismatchResult = await mirrorStripeEventToPayload(
      priceMismatchPayload,
      event('customer.subscription.updated', priceMismatchSubscription, 'evt_membership_price_mismatch', 1782006000),
      { stripe: fakeStripe(priceMismatchSubscription), adminEmail: 'admin@example.com' },
    )
    assert.equal(priceMismatchResult.processed, true)
    assert.equal(
      priceMismatchPayload.docs('payload_membership_reconciliations').find((item) => item.stripeEventId === 'evt_membership_price_mismatch')
        ?.reconciliationState,
      'mismatch',
    )

    const missingPromoPayload = buildPayload({
      payload_members: [
        {
          id: 'member_support_4',
          email: 'promo@example.com',
          accountStatus: 'active',
          billingHoldReason: null,
        },
      ],
      payload_billing_accounts: [
        {
          id: 'billing_support_4',
          member: 'member_support_4',
          stripeCustomerId: 'cus_membership_4',
          billingStatus: 'active',
        },
      ],
      payload_membership_support_records: [
        {
          id: 'support_4',
          displayName: 'Membership support seed 4',
          member: 'member_support_4',
          memberEmail: 'promo@example.com',
          fundingSource: 'voucher',
          voucherDuration: 'one_month',
          issuanceState: 'issued',
          billingCadence: 'monthly',
          stripeCustomerId: 'cus_membership_4',
          stripeSubscriptionId: 'sub_membership_4',
          stripePriceId: 'price_membership_monthly',
          stripeCouponId: 'coupon_membership_4',
          stripePromotionCodeId: 'promo_membership_4',
          approvalReference: 'webhook:seed-4',
          reconciliationState: 'matched',
          lastWebhookAt: '2026-06-20T00:00:00.000Z',
          notes: 'seed',
          metadata: {
            lastWebhookEventId: 'evt_seed_4',
            lastWebhookCreatedAt: '2026-06-20T00:00:00.000Z',
            lastReconciledAt: '2026-06-20T00:00:00.000Z',
          },
        },
      ],
    })
    const missingPromoEvent = event(
      'customer.updated',
      membershipCustomer({
        id: 'cus_membership_4',
        email: 'promo@example.com',
        discount: {
          coupon: { id: 'coupon_membership_4' },
        } as unknown as Stripe.Discount,
      }),
      'evt_membership_missing_promo',
      1782007000,
    )
    await mirrorStripeEventToPayload(missingPromoPayload, missingPromoEvent, {
      stripe: fakeStripe(membershipSubscription({ id: 'sub_membership_4', customer: { id: 'cus_membership_4', object: 'customer', email: 'promo@example.com', deleted: false } as unknown as Stripe.Customer })),
      adminEmail: 'admin@example.com',
    })
    assert.equal(missingPromoPayload.countDocs('payload_membership_reconciliations'), 1)
    assert.equal(missingPromoPayload.countDocs('payload_membership_review_queue_items'), 1)

    const inactivePromoPayload = buildPayload({
      payload_members: [
        {
          id: 'member_support_5',
          email: 'inactive@example.com',
          accountStatus: 'active',
          billingHoldReason: null,
        },
      ],
      payload_billing_accounts: [
        {
          id: 'billing_support_5',
          member: 'member_support_5',
          stripeCustomerId: 'cus_membership_5',
          billingStatus: 'active',
        },
      ],
      payload_membership_support_records: [
        {
          id: 'support_5',
          displayName: 'Membership support seed 5',
          member: 'member_support_5',
          memberEmail: 'inactive@example.com',
          fundingSource: 'voucher',
          voucherDuration: 'one_month',
          issuanceState: 'issued',
          billingCadence: 'monthly',
          stripeCustomerId: 'cus_membership_5',
          stripeSubscriptionId: 'sub_membership_5',
          stripePriceId: 'price_membership_monthly',
          stripeCouponId: 'coupon_membership_5',
          stripePromotionCodeId: 'promo_membership_5',
          approvalReference: 'webhook:seed-5',
          reconciliationState: 'matched',
          lastWebhookAt: '2026-06-20T00:00:00.000Z',
          notes: 'seed',
          metadata: {
            lastWebhookEventId: 'evt_seed_5',
            lastWebhookCreatedAt: '2026-06-20T00:00:00.000Z',
            lastReconciledAt: '2026-06-20T00:00:00.000Z',
          },
        },
      ],
    })
    const inactivePromoEvent = event(
      'customer.updated',
      membershipCustomer({
        id: 'cus_membership_5',
        email: 'inactive@example.com',
        discount: {
          coupon: { id: 'coupon_membership_5' },
          promotion_code: {
            id: 'promo_membership_5',
            active: false,
          },
        } as unknown as Stripe.Discount,
      }),
      'evt_membership_inactive_promo',
      1782008000,
    )
    await mirrorStripeEventToPayload(inactivePromoPayload, inactivePromoEvent, {
      stripe: fakeStripe(membershipSubscription({ id: 'sub_membership_5', customer: { id: 'cus_membership_5', object: 'customer', email: 'inactive@example.com', deleted: false } as unknown as Stripe.Customer })),
      adminEmail: 'admin@example.com',
    })
    assert.equal(inactivePromoPayload.docs('payload_membership_reconciliations')[0]?.failureCode, 'inactive_promotion_code')

    const outOfOrderPayload = buildPayload({
      payload_members: [
        {
          id: 'member_support_6',
          email: 'late@example.com',
          accountStatus: 'pending',
          billingHoldReason: null,
        },
      ],
      payload_billing_accounts: [
        {
          id: 'billing_support_6',
          member: 'member_support_6',
          stripeCustomerId: 'cus_membership_6',
          billingStatus: 'active',
        },
      ],
    })
    await mirrorStripeEventToPayload(
      outOfOrderPayload,
      event('invoice.paid', membershipInvoice({
        customer: 'cus_membership_6',
        customer_email: 'late@example.com',
        subscription: 'sub_membership_6',
      }), 'evt_membership_out_of_order', 1782009000),
      {
        stripe: fakeStripe(membershipSubscription({
          id: 'sub_membership_6',
          customer: {
            id: 'cus_membership_6',
            object: 'customer',
            email: 'late@example.com',
            deleted: false,
          } as unknown as Stripe.Customer,
        })),
        adminEmail: 'admin@example.com',
      },
    )
    assert.equal(outOfOrderPayload.docs('payload_membership_reconciliations')[0]?.reconciliationState, 'pending')
    assert.equal(outOfOrderPayload.docs('payload_membership_reconciliations')[0]?.failureCode, 'out_of_order_event')

    const recoveryPayload = buildPayload({
      payload_members: [
        {
          id: 'member_support_7',
          email: 'recovery@example.com',
          accountStatus: 'active',
          billingHoldReason: null,
        },
      ],
      payload_billing_accounts: [
        {
          id: 'billing_support_7',
          member: 'member_support_7',
          stripeCustomerId: 'cus_membership_7',
          billingStatus: 'active',
        },
      ],
      payload_membership_support_records: [
        {
          id: 'support_7',
          displayName: 'Membership support seed 7',
          member: 'member_support_7',
          memberEmail: 'recovery@example.com',
          fundingSource: 'voucher',
          voucherDuration: 'one_month',
          issuanceState: 'issued',
          billingCadence: 'monthly',
          stripeCustomerId: 'cus_membership_7',
          stripeSubscriptionId: 'sub_membership_7',
          stripePriceId: 'price_membership_monthly',
          stripeCouponId: 'coupon_membership_7',
          stripePromotionCodeId: 'promo_membership_7',
          approvalReference: 'webhook:seed-7',
          reconciliationState: 'matched',
          lastWebhookAt: '2026-06-20T00:00:00.000Z',
          notes: 'seed',
          metadata: {
            lastWebhookEventId: 'evt_seed_7',
            lastWebhookCreatedAt: '2026-06-20T00:00:00.000Z',
            lastReconciledAt: '2026-06-20T00:00:00.000Z',
          },
        },
      ],
      payload_membership_review_queue_items: [
        {
          id: 'review_7',
          displayName: 'Review queue membership-support:sub_membership_7:recovery@example.com',
          membershipSupport: 'support_7',
          reconciliation: 'support_7',
          member: 'member_support_7',
          queueState: 'needs_review',
          queueReason: 'webhook_mismatch',
          priority: 50,
          notes: 'seed',
          metadata: {
            lastWebhookEventId: 'evt_seed_7',
          },
        },
      ],
    })
    const recoveryMatchSubscription = membershipSubscription({
      id: 'sub_membership_7',
      customer: {
        id: 'cus_membership_7',
        object: 'customer',
        email: 'recovery@example.com',
        deleted: false,
      } as unknown as Stripe.Customer,
    })
    await mirrorStripeEventToPayload(
      recoveryPayload,
      event('customer.subscription.updated', recoveryMatchSubscription, 'evt_membership_recovery_good', 1782011000),
      { stripe: fakeStripe(recoveryMatchSubscription), adminEmail: 'admin@example.com' },
    )
    assert.equal(recoveryPayload.docs('payload_membership_reconciliations')[0]?.reconciliationState, 'matched')
    assert.equal(recoveryPayload.docs('payload_membership_review_queue_items')[0]?.queueState, 'closed')
  }
}

run()
  .then(() => {
    console.log('payload_course_stripe_shadow_sync.test.ts passed')
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
