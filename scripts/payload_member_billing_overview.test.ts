import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import { isEligibleCurrentMember } from '../src/lib/members/currentMember'
import type {
  PayloadCourseAccessAPI,
  PayloadDocument,
  PayloadId,
} from '../src/lib/payloadCourse/accessService'
import { getMemberBillingOverview } from '../src/lib/payloadCourse/memberPortal'

type CollectionMap = Record<string, PayloadDocument[]>

type FindCall = {
  collection: string
  where?: Record<string, unknown>
  overrideAccess?: boolean
}

function relationValue(value: unknown): string {
  if (value && typeof value === 'object' && 'id' in value) {
    return String((value as { id: PayloadId }).id)
  }
  return String(value)
}

function matchesWhere(doc: PayloadDocument, where?: Record<string, unknown>): boolean {
  if (!where) return true

  return Object.entries(where).every(([field, condition]) => {
    if (!condition || typeof condition !== 'object') return doc[field] === condition
    const record = condition as Record<string, unknown>
    if ('equals' in record) return relationValue(doc[field]) === String(record.equals)
    return false
  })
}

class FakePayload implements PayloadCourseAccessAPI {
  readonly findCalls: FindCall[] = []

  constructor(private readonly collections: CollectionMap) {}

  async find(args: {
    collection: string
    where?: Record<string, unknown>
    limit?: number
    sort?: string
    depth?: number
    overrideAccess?: boolean
  }) {
    this.findCalls.push({
      collection: args.collection,
      where: args.where,
      overrideAccess: args.overrideAccess,
    })

    let docs = [...(this.collections[args.collection] ?? [])].filter((doc) =>
      matchesWhere(doc, args.where)
    )

    if (args.sort) {
      const direction = args.sort.startsWith('-') ? -1 : 1
      const field = args.sort.replace(/^-/, '')
      docs = docs.sort(
        (left, right) =>
          String(left[field] ?? '').localeCompare(String(right[field] ?? '')) * direction
      )
    }

    return { docs: docs.slice(0, args.limit ?? docs.length) }
  }

  async findByID(args: { collection: string; id: PayloadId }) {
    const document = (this.collections[args.collection] ?? []).find(
      (item) => String(item.id) === String(args.id)
    )
    if (!document) throw new Error(`missing ${args.collection}:${args.id}`)
    return document
  }
}

function assertTrustedMemberQueries(payload: FakePayload, memberId: string): void {
  const billingCalls = payload.findCalls.filter((call) =>
    ['payload_billing_accounts', 'payload_subscriptions'].includes(call.collection)
  )

  assert.equal(billingCalls.length, 2)
  for (const call of billingCalls) {
    assert.equal(call.overrideAccess, true)
    assert.deepEqual(call.where, { member: { equals: memberId } })
    const serializedWhere = JSON.stringify(call.where)
    assert.equal(serializedWhere.includes('email'), false)
    assert.equal(serializedWhere.includes('customer'), false)
    assert.equal(serializedWhere.includes('subscription'), false)
    assert.equal(serializedWhere.includes('plan'), false)
    assert.equal(serializedWhere.includes('status'), false)
  }
}

async function testActivePaidSubscriptionOverview(): Promise<void> {
  const payload = new FakePayload({
    payload_billing_accounts: [
      {
        id: 'billing_other',
        member: 'member_other',
        billingStatus: 'past_due',
        stripeMode: 'live',
        updatedAt: '2026-06-24T12:00:00.000Z',
      },
      {
        id: 'billing_trusted',
        member: 'member_trusted',
        billingStatus: 'active',
        stripeMode: 'live',
        updatedAt: '2026-06-23T12:00:00.000Z',
      },
    ],
    payload_subscriptions: [
      {
        id: 'subscription_expired',
        member: 'member_trusted',
        plan: 'private',
        status: 'incomplete_expired',
        cancelAtPeriodEnd: false,
        currentPeriodEnd: '2026-06-29T00:00:00.000Z',
        updatedAt: '2026-06-24T12:00:00.000Z',
      },
      {
        id: 'subscription_active',
        member: 'member_trusted',
        plan: 'pro',
        status: 'active',
        cancelAtPeriodEnd: false,
        currentPeriodEnd: '2026-07-23T00:00:00.000Z',
        updatedAt: '2026-06-23T12:00:00.000Z',
      },
      {
        id: 'subscription_other',
        member: 'member_other',
        plan: 'private',
        status: 'active',
        cancelAtPeriodEnd: false,
        currentPeriodEnd: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-06-25T12:00:00.000Z',
      },
    ],
  })

  const overview = await getMemberBillingOverview(payload, 'member_trusted')

  assert.equal(overview.hasPaidSubscription, true)
  assert.equal(overview.plan, 'pro')
  assert.equal(overview.billingStatus, 'active')
  assert.equal(overview.subscriptionStatus, 'active')
  assert.equal(overview.cancelAtPeriodEnd, false)
  assert.equal(overview.currentPeriodEnd, '2026-07-23T00:00:00.000Z')
  assert.equal(overview.subscription?.id, 'subscription_active')
  assertTrustedMemberQueries(payload, 'member_trusted')
}

async function testCancelAtPeriodEndOverview(): Promise<void> {
  const payload = new FakePayload({
    payload_billing_accounts: [
      {
        id: 'billing_trusted',
        member: 'member_trusted',
        billingStatus: 'active',
        stripeMode: 'live',
        updatedAt: '2026-06-24T12:00:00.000Z',
      },
    ],
    payload_subscriptions: [
      {
        id: 'subscription_canceling',
        member: 'member_trusted',
        plan: 'private',
        status: 'active',
        cancelAtPeriodEnd: true,
        currentPeriodEnd: '2026-07-31T00:00:00.000Z',
        updatedAt: '2026-06-24T12:00:00.000Z',
      },
    ],
  })

  const overview = await getMemberBillingOverview(payload, 'member_trusted')

  assert.equal(overview.plan, 'private')
  assert.equal(overview.subscriptionStatus, 'active')
  assert.equal(overview.cancelAtPeriodEnd, true)
  assert.equal(overview.currentPeriodEnd, '2026-07-31T00:00:00.000Z')
}

async function testNoSubscriptionState(): Promise<void> {
  const payload = new FakePayload({
    payload_billing_accounts: [
      {
        id: 'billing_trusted',
        member: 'member_trusted',
        billingStatus: 'none',
        stripeMode: 'test',
        updatedAt: '2026-06-24T12:00:00.000Z',
      },
    ],
    payload_subscriptions: [],
  })

  const overview = await getMemberBillingOverview(payload, 'member_trusted')

  assert.equal(overview.hasPaidSubscription, false)
  assert.equal(overview.subscription, null)
  assert.equal(overview.plan, 'free')
  assert.equal(overview.billingStatus, 'none')
  assert.equal(overview.subscriptionStatus, null)
  assert.equal(overview.cancelAtPeriodEnd, false)
  assert.equal(overview.currentPeriodEnd, null)
}

function testBlockedMemberEligibility(): void {
  // active + emailVerifiedAt → eligible (mirrors identityDestination gate)
  assert.equal(
    isEligibleCurrentMember({ accountStatus: 'active', emailVerifiedAt: '2026-01-01T00:00:00.000Z' }),
    true,
  )
  // active without emailVerifiedAt → not eligible
  assert.equal(isEligibleCurrentMember({ accountStatus: 'active' }), false)
  assert.equal(isEligibleCurrentMember({ accountStatus: 'blocked' }), false)
  assert.equal(isEligibleCurrentMember({ accountStatus: 'pending' }), false)
  assert.equal(isEligibleCurrentMember(null), false)
}

function testPageUsesOnlyAuthenticatedMemberIdentity(): void {
  const pageSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/app/(frontend)/portal/[section]/page.tsx'),
    'utf8'
  )

  assert.match(pageSource, /requirePortalMember\(`\/portal\/\$\{section\}`\)/)
  assert.match(pageSource, /getMemberBillingOverview\(payload, memberId\)/)
  assert.match(pageSource, /resolvePortalBillingPresentation\(/)
  assert.doesNotMatch(pageSource, /getCurrentPayloadMember\(\)/)
  assert.doesNotMatch(pageSource, /\bcustomerId\b/)
  assert.doesNotMatch(pageSource, /stripeCustomerId/)
}

async function main(): Promise<void> {
  await testActivePaidSubscriptionOverview()
  await testCancelAtPeriodEndOverview()
  await testNoSubscriptionState()
  testBlockedMemberEligibility()
  testPageUsesOnlyAuthenticatedMemberIdentity()
  console.log('payload member billing overview tests passed')
}

void main()
