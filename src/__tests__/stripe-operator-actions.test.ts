import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'

vi.mock('server-only', () => ({}))

import {
  executeStripeOperatorAction,
  StripeOperatorActionError,
  type StripeOperatorActionDependencies,
} from '@/lib/billing/stripeOperatorActions'
import type { PayloadCourseWriteAPI, PayloadDocument, PayloadId } from '@/lib/payloadCourse/accessService'

type FakeCollections = Record<string, PayloadDocument[]>

class FakePayload implements PayloadCourseWriteAPI {
  constructor(private readonly collections: FakeCollections) {}

  async find() {
    return { docs: [] }
  }

  async findByID(args: { collection: string; id: PayloadId }) {
    const document = (this.collections[args.collection] ?? []).find(
      (item) => String(item.id) === String(args.id),
    )
    if (!document) throw new Error('missing')
    return document
  }

  async create() {
    throw new Error('not implemented')
  }

  async update() {
    throw new Error('not implemented')
  }
}

function subscription(overrides: Partial<Stripe.Subscription> = {}): Stripe.Subscription {
  return {
    id: 'sub_test_123',
    object: 'subscription',
    application: null,
    application_fee_percent: null,
    automatic_tax: { enabled: false, liability: null },
    billing_cycle_anchor: 1,
    billing_cycle_anchor_config: null,
    billing_thresholds: null,
    cancel_at: null,
    cancel_at_period_end: false,
    canceled_at: null,
    cancellation_details: { comment: null, feedback: null, reason: null },
    collection_method: 'charge_automatically',
    created: 1,
    currency: 'gbp',
    current_period_end: 2,
    current_period_start: 1,
    customer: 'cus_test_123',
    days_until_due: null,
    default_payment_method: null,
    default_source: null,
    default_tax_rates: [],
    description: null,
    discount: null,
    discounts: [],
    ended_at: null,
    invoice_settings: { account_tax_ids: null, issuer: { type: 'self' } },
    items: { object: 'list', data: [], has_more: false, url: '/v1/subscription_items' },
    latest_invoice: null,
    livemode: false,
    metadata: {},
    next_pending_invoice_item_invoice: null,
    on_behalf_of: null,
    pause_collection: null,
    payment_settings: {
      payment_method_options: null,
      payment_method_types: null,
      save_default_payment_method: 'off',
    },
    pending_invoice_item_interval: null,
    pending_setup_intent: null,
    pending_update: null,
    schedule: null,
    start_date: 1,
    status: 'active',
    test_clock: null,
    transfer_data: null,
    trial_end: null,
    trial_settings: { end_behavior: { missing_payment_method: 'create_invoice' } },
    trial_start: null,
    ...overrides,
  } as Stripe.Subscription
}

function buildDependencies(options: {
  stripeEnvironment?: 'test' | 'live'
  billingMode?: 'test' | 'live'
  stripeSubscription?: Stripe.Subscription
}) {
  const payload = new FakePayload({
    payload_subscriptions: [
      {
        id: 'payload-sub-1',
        member: 'member-1',
        billingAccount: 'billing-1',
        stripeSubscriptionId: 'sub_test_123',
      },
    ],
    payload_billing_accounts: [
      {
        id: 'billing-1',
        stripeMode: options.billingMode ?? 'test',
      },
    ],
  })
  let current = options.stripeSubscription ?? subscription()
  const retrieve = vi.fn(async () => current)
  const update = vi.fn(async (
    id: string,
    data: Stripe.SubscriptionUpdateParams,
    requestOptions?: Stripe.RequestOptions,
  ) => {
    current = subscription({
      ...current,
      id,
      cancel_at_period_end: data.cancel_at_period_end ?? current.cancel_at_period_end,
    })
    return current
  })
  const mirrorEvent = vi.fn(async () => ({ actions: ['subscription_synced'] }))

  const dependencies: StripeOperatorActionDependencies = {
    payload,
    stripe: {
      subscriptions: { retrieve, update } as unknown as Stripe.SubscriptionsResource,
      customers: {} as Stripe.CustomersResource,
    },
    stripeEnvironment: options.stripeEnvironment ?? 'test',
    mirrorEvent,
    now: () => new Date('2026-07-24T09:00:00.000Z'),
  }

  return { dependencies, retrieve, update, mirrorEvent }
}

async function runAction(
  dependencies: StripeOperatorActionDependencies,
  action: 'sync_subscription' | 'cancel_at_period_end' | 'resume_subscription',
) {
  return executeStripeOperatorAction({
    dependencies,
    actionRecordId: 'action-1',
    payloadSubscriptionId: 'payload-sub-1',
    action,
  })
}

describe('Stripe operator subscription actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('syncs from the Stripe ID derived from the Payload subscription record', async () => {
    const { dependencies, retrieve, update, mirrorEvent } = buildDependencies({})

    const result = await runAction(dependencies, 'sync_subscription')

    expect(retrieve).toHaveBeenCalledWith('sub_test_123', {
      expand: ['items.data.price', 'latest_invoice.payment_intent'],
    })
    expect(update).not.toHaveBeenCalled()
    expect(mirrorEvent).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({
      status: 'completed',
      stripeSubscriptionId: 'sub_test_123',
      memberId: 'member-1',
      cancelAtPeriodEnd: false,
      eventId: 'operator_subscription_action-1',
    })
  })

  it('schedules cancellation with a stable idempotency key', async () => {
    const { dependencies, update } = buildDependencies({})

    const result = await runAction(dependencies, 'cancel_at_period_end')

    expect(update).toHaveBeenCalledWith(
      'sub_test_123',
      { cancel_at_period_end: true },
      { idempotencyKey: 'jpv-operator-action-1-cancel_at_period_end' },
    )
    expect(result.status).toBe('completed')
    expect(result.cancelAtPeriodEnd).toBe(true)
  })

  it('skips an already scheduled cancellation without another Stripe mutation', async () => {
    const { dependencies, update, mirrorEvent } = buildDependencies({
      stripeSubscription: subscription({ cancel_at_period_end: true }),
    })

    const result = await runAction(dependencies, 'cancel_at_period_end')

    expect(update).not.toHaveBeenCalled()
    expect(mirrorEvent).toHaveBeenCalledTimes(1)
    expect(result.status).toBe('skipped')
  })

  it('reverses a scheduled cancellation where Stripe supports it', async () => {
    const { dependencies, update } = buildDependencies({
      stripeSubscription: subscription({ cancel_at_period_end: true }),
    })

    const result = await runAction(dependencies, 'resume_subscription')

    expect(update).toHaveBeenCalledWith(
      'sub_test_123',
      { cancel_at_period_end: false },
      { idempotencyKey: 'jpv-operator-action-1-resume_subscription' },
    )
    expect(result.cancelAtPeriodEnd).toBe(false)
  })

  it('rejects live configuration before making any Stripe request', async () => {
    const { dependencies, retrieve, update } = buildDependencies({ stripeEnvironment: 'live' })

    await expect(runAction(dependencies, 'sync_subscription')).rejects.toMatchObject({
      code: 'live_mode_forbidden',
    } satisfies Partial<StripeOperatorActionError>)
    expect(retrieve).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('rejects a Payload billing account marked live before Stripe retrieval', async () => {
    const { dependencies, retrieve } = buildDependencies({ billingMode: 'live' })

    await expect(runAction(dependencies, 'sync_subscription')).rejects.toMatchObject({
      code: 'billing_account_not_test',
    } satisfies Partial<StripeOperatorActionError>)
    expect(retrieve).not.toHaveBeenCalled()
  })

  it('rejects a retrieved live subscription and terminal cancellation reversal', async () => {
    const live = buildDependencies({ stripeSubscription: subscription({ livemode: true }) })
    await expect(runAction(live.dependencies, 'sync_subscription')).rejects.toMatchObject({
      code: 'stripe_subscription_live',
    } satisfies Partial<StripeOperatorActionError>)

    const terminal = buildDependencies({
      stripeSubscription: subscription({ status: 'canceled', cancel_at_period_end: true }),
    })
    await expect(runAction(terminal.dependencies, 'resume_subscription')).rejects.toMatchObject({
      code: 'subscription_terminal',
    } satisfies Partial<StripeOperatorActionError>)
    expect(terminal.update).not.toHaveBeenCalled()
  })

  it('exposes immutable Payload projections and guarded operator actions', () => {
    const source = readFileSync(resolve('src/collections/billing/Billing.ts'), 'utf8')

    expect(source.match(/access: webhookProjectionCollectionAccess/g)).toHaveLength(4)
    expect(source).toContain("value: 'sync_subscription'")
    expect(source).toContain("value: 'cancel_at_period_end'")
    expect(source).toContain("value: 'resume_subscription'")
    expect(source).toContain('update: () => false')
    expect(source).toContain('delete: () => false')
    expect(source).toContain('processPayloadBillingAction')
    expect(source).toContain('Stripe IDs are derived server-side')
  })
})
