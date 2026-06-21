import assert from 'node:assert/strict'

import type Stripe from 'stripe'

import {
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

  count(collection: string) {
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

function event(type: string, object: unknown, id = `evt_${type.replace(/\W+/g, '_')}`): Stripe.Event {
  return {
    id,
    object: 'event',
    api_version: '2024-06-20',
    created: 1782000000,
    data: { object },
    livemode: true,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type,
  } as Stripe.Event
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
  {
    const payload = buildPayload()
    const stripeEvent = event('customer.subscription.updated', subscription(), 'evt_sub_active')

    const result = await mirrorStripeEventToPayload(payload, stripeEvent, {
      stripe: fakeStripe(),
      adminEmail: 'admin@example.com',
    })

    assert.equal(result.processed, true)
    assert.equal(payload.count('payload_members'), 1)
    assert.equal(payload.docs('payload_members')[0]?.accountStatus, 'active')
    assert.equal(payload.count('payload_billing_accounts'), 1)
    assert.equal(payload.docs('payload_billing_accounts')[0]?.billingStatus, 'active')
    assert.equal(payload.count('payload_subscriptions'), 1)
    assert.equal(payload.docs('payload_subscriptions')[0]?.plan, 'pro')
    assert.equal(payload.count('payload_email_events'), 2)
    assert.equal(payload.docs('payload_stripe_events')[0]?.processingStatus, 'processed')

    const duplicate = await mirrorStripeEventToPayload(payload, stripeEvent, {
      stripe: fakeStripe(),
      adminEmail: 'admin@example.com',
    })

    assert.equal(duplicate.deduped, true)
    assert.equal(payload.count('payload_members'), 1)
    assert.equal(payload.count('payload_subscriptions'), 1)
    assert.equal(payload.count('payload_email_events'), 2)
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
    assert.equal(payload.docs('payload_subscriptions')[0]?.plan, 'free')
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

    assert.equal(payload.docs('payload_members')[0]?.accountStatus, 'blocked')
    assert.equal(payload.docs('payload_members')[0]?.billingHoldReason, 'canceled')
    assert.equal(payload.docs('payload_subscriptions')[0]?.cancelAtPeriodEnd, true)
    assert.equal(payload.docs('payload_billing_accounts')[0]?.billingStatus, 'canceled')
    assert.equal(payload.count('payload_member_security_events'), 1)
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

    await mirrorStripeEventToPayload(payload, event('invoice.payment_failed', invoice(), 'evt_payment_failed'), {
      stripe: fakeStripe(failedSub),
      adminEmail: 'admin@example.com',
    })

    assert.equal(payload.docs('payload_members')[0]?.accountStatus, 'blocked')
    assert.equal(payload.docs('payload_members')[0]?.billingHoldReason, 'past_due')
    assert.equal(payload.docs('payload_payments')[0]?.status, 'failed')
    assert.equal(payload.docs('payload_billing_accounts')[0]?.billingStatus, 'past_due')
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
          accountStatus: 'blocked',
          billingHoldReason: 'past_due',
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
    assert.equal(
      payload.docs('payload_billing_actions').some((action) => action.actionType === 'access_restored'),
      true
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
