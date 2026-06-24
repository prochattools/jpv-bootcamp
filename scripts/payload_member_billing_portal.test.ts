import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import { isEligibleCurrentMember } from '../src/lib/members/currentMember'
import type {
  PayloadCourseAccessAPI,
  PayloadDocument,
  PayloadId,
} from '../src/lib/payloadCourse/accessService'
import {
  createMemberBillingPortalSession,
  MEMBER_BILLING_PORTAL_RETURN_URL,
  MemberBillingPortalUnavailableError,
} from '../src/lib/payloadCourse/memberBillingPortal'

type FindCall = {
  collection: string
  where?: Record<string, unknown>
  limit?: number
  depth?: number
  sort?: string
  overrideAccess?: boolean
}

class FakePayload implements PayloadCourseAccessAPI {
  readonly findCalls: FindCall[] = []

  constructor(private readonly billingAccounts: PayloadDocument[]) {}

  async find(args: FindCall) {
    this.findCalls.push(args)
    const trustedMemberId = String(
      ((args.where?.member as { equals?: unknown } | undefined)?.equals ?? '')
    )
    const docs = this.billingAccounts.filter(
      (account) => String(account.member) === trustedMemberId
    )
    return { docs: docs.slice(0, args.limit ?? docs.length) }
  }

  async findByID(args: {
    collection: string
    id: PayloadId
  }): Promise<PayloadDocument> {
    throw new Error(`unused findByID ${args.collection}:${String(args.id)}`)
  }
}

function buildStripeSessionClient(sessionUrl: string | null) {
  const calls: Array<{
    customer: string
    return_url: string
    configuration: string
  }> = []

  return {
    calls,
    client: {
      billingPortal: {
        sessions: {
          async create(args: {
            customer: string
            return_url: string
            configuration: string
          }) {
            calls.push(args)
            return { url: sessionUrl as string }
          },
        },
      },
    },
  }
}

async function expectUnavailable(
  operation: () => Promise<unknown>,
  expectedCode:
    | 'billing_account_missing'
    | 'stripe_customer_missing'
    | 'portal_session_unavailable'
): Promise<void> {
  await assert.rejects(operation, (error: unknown) => {
    assert(error instanceof MemberBillingPortalUnavailableError)
    assert.equal(error.code, expectedCode)
    return true
  })
}

async function testTrustedMemberLookupAndStoredCustomer(): Promise<void> {
  const payload = new FakePayload([
    {
      id: 'billing_trusted',
      member: 'member_trusted',
      stripeCustomerId: 'cus_trusted',
      updatedAt: '2026-06-24T00:00:00.000Z',
    },
    {
      id: 'billing_other',
      member: 'member_other',
      stripeCustomerId: 'cus_other',
      updatedAt: '2026-06-25T00:00:00.000Z',
    },
  ])
  const stripe = buildStripeSessionClient('https://billing.stripe.com/session/trusted')

  const sessionUrl = await createMemberBillingPortalSession(
    payload,
    'member_trusted',
    {
      stripe: stripe.client,
      portalConfigurationId: 'bpc_trusted',
    }
  )

  assert.equal(sessionUrl, 'https://billing.stripe.com/session/trusted')
  assert.equal(payload.findCalls.length, 1)
  assert.deepEqual(payload.findCalls[0], {
    collection: 'payload_billing_accounts',
    where: { member: { equals: 'member_trusted' } },
    limit: 1,
    depth: 0,
    sort: '-updatedAt',
    overrideAccess: true,
  })
  assert.deepEqual(stripe.calls, [
    {
      customer: 'cus_trusted',
      return_url: 'https://portal.jpvbootcamp.com/learn/billing',
      configuration: 'bpc_trusted',
    },
  ])
  assert.equal(
    MEMBER_BILLING_PORTAL_RETURN_URL,
    'https://portal.jpvbootcamp.com/learn/billing'
  )
}

async function testMissingBillingAccountFailsSafely(): Promise<void> {
  const payload = new FakePayload([])
  const stripe = buildStripeSessionClient('https://billing.stripe.com/session/unused')

  await expectUnavailable(
    () =>
      createMemberBillingPortalSession(payload, 'member_trusted', {
        stripe: stripe.client,
        portalConfigurationId: 'bpc_trusted',
      }),
    'billing_account_missing'
  )
  assert.equal(stripe.calls.length, 0)
}

async function testMissingCustomerIdFailsSafely(): Promise<void> {
  const payload = new FakePayload([
    {
      id: 'billing_trusted',
      member: 'member_trusted',
      stripeCustomerId: '   ',
    },
  ])
  const stripe = buildStripeSessionClient('https://billing.stripe.com/session/unused')

  await expectUnavailable(
    () =>
      createMemberBillingPortalSession(payload, 'member_trusted', {
        stripe: stripe.client,
        portalConfigurationId: 'bpc_trusted',
      }),
    'stripe_customer_missing'
  )
  assert.equal(stripe.calls.length, 0)
}

async function testMissingSessionUrlFailsSafely(): Promise<void> {
  const payload = new FakePayload([
    {
      id: 'billing_trusted',
      member: 'member_trusted',
      stripeCustomerId: 'cus_trusted',
    },
  ])
  const stripe = buildStripeSessionClient(null)

  await expectUnavailable(
    () =>
      createMemberBillingPortalSession(payload, 'member_trusted', {
        stripe: stripe.client,
        portalConfigurationId: 'bpc_trusted',
      }),
    'portal_session_unavailable'
  )
}

function testBlockedMemberEligibility(): void {
  assert.equal(isEligibleCurrentMember({ accountStatus: 'active' }), true)
  assert.equal(isEligibleCurrentMember({ accountStatus: 'blocked' }), false)
  assert.equal(isEligibleCurrentMember({ accountStatus: 'pending' }), false)
  assert.equal(isEligibleCurrentMember(null), false)
}

function testNoBrowserSelectableBillingIdentity(): void {
  const pageSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/app/(frontend)/learn/billing/page.tsx'),
    'utf8'
  )
  const actionSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/app/(frontend)/learn/billing/actions.ts'),
    'utf8'
  )

  assert.match(pageSource, /form action=\{openMemberBillingPortalAction\}/)
  assert.doesNotMatch(pageSource, /<input/i)
  assert.doesNotMatch(pageSource, /type=['"]hidden['"]/i)
  assert.doesNotMatch(pageSource, /formData/i)
  assert.match(pageSource, /firstParam\(params\.portal\) === 'unavailable'/)

  assert.match(actionSource, /openMemberBillingPortalAction\(\): Promise<void>/)
  assert.match(actionSource, /createMemberBillingPortalSession\(payload, member\.id\)/)
  assert.doesNotMatch(actionSource, /FormData/)
  assert.doesNotMatch(actionSource, /searchParams/)
  assert.doesNotMatch(actionSource, /customerId/)
  assert.doesNotMatch(actionSource, /returnUrl/)
  assert.doesNotMatch(actionSource, /formData\.get/)
}

async function main(): Promise<void> {
  await testTrustedMemberLookupAndStoredCustomer()
  await testMissingBillingAccountFailsSafely()
  await testMissingCustomerIdFailsSafely()
  await testMissingSessionUrlFailsSafely()
  testBlockedMemberEligibility()
  testNoBrowserSelectableBillingIdentity()
  console.log('payload member billing portal tests passed')
}

void main()
