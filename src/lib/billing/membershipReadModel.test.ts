import assert from 'node:assert/strict'

import type Stripe from 'stripe'

import { reconcileStripeToPayload } from './stripePayloadReconciliation'
import { getMembershipReadModel } from './membershipReadModel'

type Doc = Record<string, any> & { id: string }

function subscription(id: string, customerId: string, email: string, status: Stripe.Subscription.Status = 'active'): Stripe.Subscription {
  return {
    id,
    object: 'subscription',
    status,
    customer: { id: customerId, object: 'customer', email } as Stripe.Customer,
    items: { object: 'list', data: [], has_more: false, url: '' },
    cancel_at_period_end: false,
    canceled_at: null,
    current_period_start: 100,
    current_period_end: 200,
  } as Stripe.Subscription
}

function fakePayload(collections: Record<string, Doc[]>) {
  let nextId = 1
  return {
    find: async ({ collection, where }: { collection: string; where?: Record<string, any> }) => ({
      docs: (collections[collection] ?? []).filter((doc) => {
        if (!where) return true
        return Object.entries(where).every(([field, condition]) => {
          const expected = condition?.equals
          return expected === undefined || String(doc[field]) === String(expected)
        })
      }),
      hasNextPage: false,
    }),
    findByID: async ({ collection, id }: { collection: string; id: string }) => {
      const doc = (collections[collection] ?? []).find((candidate) => String(candidate.id) === String(id))
      if (!doc) throw new Error('missing')
      return doc
    },
    create: async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
      const doc = { id: `created_${nextId++}`, ...data } as Doc
      ;(collections[collection] ??= []).push(doc)
      return doc
    },
    update: async ({ collection, id, data }: { collection: string; id: string; data: Record<string, unknown> }) => {
      const docs = collections[collection] ?? []
      const index = docs.findIndex((candidate) => String(candidate.id) === String(id))
      if (index < 0) throw new Error('missing')
      docs[index] = { ...docs[index], ...data }
      return docs[index]
    },
  }
}

function stripeFor(subscriptions: Stripe.Subscription[]) {
  return {
    subscriptions: { list: async () => ({ object: 'list', data: subscriptions, has_more: false, url: '' }) },
    invoices: { list: async () => ({ object: 'list', data: [], has_more: false, url: '' }) },
    customers: {},
  } as unknown as Stripe
}

const collections: Record<string, Doc[]> = {
  payload_members: [
    { id: 'member_customer', email: 'customer@example.test', accountStatus: 'active' },
    { id: 'member_email', email: '  unique@example.test ', accountStatus: 'active' },
  ],
  payload_billing_accounts: [
    { id: 'account_customer', member: 'member_customer', stripeCustomerId: 'cus_customer' },
  ],
  payload_member_profiles: [],
  payload_subscriptions: [],
  payload_users: [],
  payload_membership_review_queue_items: [],
  payload_audit_events: [],
}
const payload = fakePayload(collections)
const subscriptions = [
  subscription('sub_customer', 'cus_customer', 'wrong@example.test'),
  subscription('sub_email', 'cus_email', 'UNIQUE@example.test'),
  subscription('sub_unmatched', 'cus_unmatched', 'missing@example.test'),
]
const seen: string[] = []
const report = await reconcileStripeToPayload({
  payload: payload as never,
  stripe: stripeFor(subscriptions),
  livemode: true,
  runId: 'identity-contract',
  mode: 'apply',
  mirror: async (_payload, event) => {
    seen.push(event.id)
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

assert.equal(report.rows.find((row) => row.stripeId === 'sub_customer')?.disposition, 'synced')
assert.equal(report.rows.find((row) => row.stripeId === 'sub_email')?.disposition, 'synced')
assert.equal(report.rows.find((row) => row.stripeId === 'sub_unmatched')?.disposition, 'review_required')
assert.equal(seen.length, 2)
assert.equal(collections.payload_membership_review_queue_items.length, 1)
assert.equal(collections.payload_member_profiles.length, 2)

const model = await getMembershipReadModel(payload as never, subscriptions.map((item) => ({
  status: item.status,
  customerId: typeof item.customer === 'string' ? item.customer : item.customer.id,
})))
assert.equal(model.administrators.total, 0)
assert.equal(model.members.active, 2)
assert.equal(model.members.activeProfiles, 2)
assert.equal(model.subscriptions.subscribedMembers, 0)
assert.equal(model.stripe.activeRecords, 3)

console.log('Membership identity/read-model contract: PASS')
