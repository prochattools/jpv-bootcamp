import assert from 'node:assert/strict'

import type Stripe from 'stripe'

import { reconcileStripeToPayload } from './stripePayloadReconciliation'

function subscription(id: string, status: Stripe.Subscription.Status = 'active'): Stripe.Subscription {
  return {
    id,
    object: 'subscription',
    status,
    customer: { id: `cus_${id}`, object: 'customer', email: `${id}@example.test` } as Stripe.Customer,
    items: { object: 'list', data: [], has_more: false, url: '' },
    cancel_at_period_end: false,
    canceled_at: status === 'canceled' ? 100 : null,
    current_period_start: 100,
    current_period_end: 200,
  } as Stripe.Subscription
}

function invoice(id: string, status: Stripe.Invoice.Status): Stripe.Invoice {
  return {
    id,
    object: 'invoice',
    status,
    customer: `cus_${id}`,
    subscription: `sub_${id}`,
    amount_paid: status === 'paid' ? 1000 : 0,
    amount_remaining: status === 'paid' ? 0 : 1000,
    attempt_count: status === 'open' ? 1 : 0,
    status_transitions: { paid_at: status === 'paid' ? 100 : null } as Stripe.Invoice.StatusTransitions,
  } as Stripe.Invoice
}

const subscriptions = [subscription('sub_1'), subscription('sub_2', 'past_due')]
const invoices = [invoice('in_paid', 'paid'), invoice('in_failed', 'open'), invoice('in_draft', 'draft')]
const stripe = {
  subscriptions: {
    list: async () => ({ object: 'list', data: subscriptions, has_more: false, url: '' }),
  },
  invoices: {
    list: async () => ({ object: 'list', data: invoices, has_more: false, url: '' }),
  },
  customers: {},
} as unknown as Stripe

const dryRun = await reconcileStripeToPayload({
  payload: {} as never,
  stripe,
  livemode: true,
  runId: 'dry_run',
  mode: 'dry-run',
  now: () => new Date('2026-08-25T00:00:00.000Z'),
})
assert.equal(dryRun.totals.subscriptions, 2)
assert.equal(dryRun.totals.invoices, 3)
assert.equal(dryRun.totals.wouldSync, 5)
assert.equal(dryRun.totals.skipped, 0)

{
  const historical = [subscription('sub_current'), subscription('sub_historical', 'canceled')]
  historical[1]!.customer = historical[0]!.customer
  const report = await reconcileStripeToPayload({
    payload: {} as never,
    stripe: {
      subscriptions: { list: async () => ({ object: 'list', data: historical, has_more: false, url: '' }) },
      invoices: { list: async () => ({ object: 'list', data: [], has_more: false, url: '' }) },
      customers: {},
    } as unknown as Stripe,
    livemode: true,
    runId: 'historical_subscription_dry_run',
    mode: 'dry-run',
  })
  assert.equal(report.totals.reviewRequired, 0)
  assert.equal(report.totals.wouldSync, 2)
}

{
  const first = await reconcileStripeToPayload({
    payload: {} as never,
    stripe,
    livemode: true,
    runId: 'bounded_first',
    mode: 'dry-run',
    maxObjects: 1,
    pageSize: 2,
  })
  assert.deepEqual(first.checkpoint, { phase: 'subscriptions', startingAfter: 'sub_1' })
  const resumed = await reconcileStripeToPayload({
    payload: {} as never,
    stripe,
    livemode: true,
    runId: 'bounded_resume',
    mode: 'dry-run',
    maxObjects: 1,
    pageSize: 2,
    checkpoint: first.checkpoint,
  })
  assert.equal(resumed.rows[0]?.stripeId, 'sub_2')
}

{
  const duplicateEmailSubscriptions = [
    subscription('sub_email_1'),
    subscription('sub_email_2'),
  ]
  duplicateEmailSubscriptions[0]!.customer = {
    id: 'cus_email_1', object: 'customer', email: 'duplicate@example.test',
  } as Stripe.Customer
  duplicateEmailSubscriptions[1]!.customer = {
    id: 'cus_email_2', object: 'customer', email: 'DUPLICATE@example.test',
  } as Stripe.Customer
  const duplicateEmailStripe = {
    subscriptions: { list: async () => ({ object: 'list', data: duplicateEmailSubscriptions, has_more: false, url: '' }) },
    invoices: { list: async () => ({ object: 'list', data: [], has_more: false, url: '' }) },
    customers: {},
  } as unknown as Stripe
  const report = await reconcileStripeToPayload({
    payload: {} as never,
    stripe: duplicateEmailStripe,
    livemode: true,
    runId: 'duplicate_email_dry_run',
    mode: 'dry-run',
  })
  assert.equal(report.totals.reviewRequired, 2)
  assert.ok(report.rows.every((row) => row.reason === 'multiple_subscriptions_for_identity'))
}

const seenEventIds: string[] = []
const apply = await reconcileStripeToPayload({
  payload: {} as never,
  stripe,
  livemode: true,
  runId: 'apply_run',
  mode: 'apply',
  now: () => new Date('2026-08-25T00:00:00.000Z'),
  mirror: async (_payload, event) => {
    seenEventIds.push(event.id)
    return {
      enabled: true,
      processed: true,
      deduped: false,
      eventId: event.id,
      eventType: event.type,
      actions: ['subscription_synced'],
    }
  },
})
assert.equal(apply.totals.synced, 5)
assert.equal(new Set(seenEventIds).size, 5)
assert.ok(seenEventIds.every((id) => id.startsWith('reconcile_')))

{
  const sharedCustomer = { id: 'cus_shared', object: 'customer', email: 'shared@example.test' } as Stripe.Customer
  const ambiguousSubscriptions = [
    { ...subscription('sub_shared_active'), customer: sharedCustomer },
    { ...subscription('sub_shared_past_due', 'past_due'), customer: sharedCustomer },
  ] as Stripe.Subscription[]
  const ambiguousStripe = {
    subscriptions: {
      list: async () => ({ object: 'list', data: ambiguousSubscriptions, has_more: false, url: '' }),
    },
    invoices: {
      list: async () => ({ object: 'list', data: [], has_more: false, url: '' }),
    },
    customers: {},
  } as unknown as Stripe
  const collections: Record<string, Array<Record<string, unknown>>> = {
    payload_billing_accounts: [{ id: 'billing_shared', member: 'member_shared', stripeCustomerId: 'cus_shared' }],
    payload_members: [{ id: 'member_shared', email: 'shared@example.test', accountStatus: 'active' }],
    payload_membership_review_queue_items: [],
    payload_audit_events: [],
  }
  let nextId = 1
  const payload = {
    find: async ({ collection, where }: { collection: string; where?: Record<string, any> }) => ({
      docs: (collections[collection] ?? []).filter((doc) => {
        if (!where) return true
        return Object.entries(where).every(([field, condition]) =>
          String(doc[field]) === String((condition as { equals?: unknown }).equals))
      }),
    }),
    findByID: async ({ collection, id }: { collection: string; id: string }) => {
      const doc = (collections[collection] ?? []).find((item) => String(item.id) === String(id))
      if (!doc) throw new Error('missing')
      return doc
    },
    create: async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
      const doc = { id: `created_${nextId++}`, ...data }
      ;(collections[collection] ??= []).push(doc)
      return doc
    },
    update: async ({ collection, id, data }: { collection: string; id: string; data: Record<string, unknown> }) => {
      const docs = collections[collection] ?? []
      const index = docs.findIndex((doc) => String(doc.id) === String(id))
      if (index < 0) throw new Error('missing')
      docs[index] = { ...docs[index], ...data }
      return docs[index]
    },
  }

  const report = await reconcileStripeToPayload({
    payload: payload as never,
    stripe: ambiguousStripe,
    livemode: true,
    runId: 'ambiguity_run',
    mode: 'apply',
    now: () => new Date('2026-08-25T00:00:00.000Z'),
    mirror: async (_payload, event) => ({
      enabled: true,
      processed: true,
      deduped: false,
      eventId: event.id,
      eventType: event.type,
      actions: ['subscription_synced'],
    }),
  })

  assert.equal(report.totals.reviewRequired, 2)
  assert.equal(collections.payload_members[0]?.accountStatus, 'blocked')
  assert.equal(collections.payload_members[0]?.billingHoldReason, 'manual_review')
  assert.equal(collections.payload_membership_review_queue_items.length, 1)
  assert.equal(collections.payload_audit_events.length, 1)

  collections.payload_members[0] = {
    ...collections.payload_members[0],
    accountStatus: 'blocked',
    billingHoldReason: 'operator_investigation',
  }
  await reconcileStripeToPayload({
    payload: payload as never,
    stripe: ambiguousStripe,
    livemode: true,
    runId: 'ambiguity_preserve_manual_block',
    mode: 'apply',
    now: () => new Date('2026-08-25T00:00:00.000Z'),
    mirror: async (_payload, event) => ({
      enabled: true,
      processed: true,
      deduped: false,
      eventId: event.id,
      eventType: event.type,
      actions: ['subscription_synced'],
    }),
  })
  assert.equal(collections.payload_members[0]?.billingHoldReason, 'operator_investigation')
  assert.equal((collections.payload_audit_events[1]?.metadata as { manualStatusPreserved?: boolean }).manualStatusPreserved, true)
}

console.log('Stripe Payload reconciliation contract: PASS (ambiguity fail-closed included)')
