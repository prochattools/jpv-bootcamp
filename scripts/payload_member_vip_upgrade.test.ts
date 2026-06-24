import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import type {
  PayloadCourseAccessAPI,
  PayloadDocument,
  PayloadId,
} from '../src/lib/payloadCourse/accessService'
import {
  createAuthenticatedVipUpgradeSession,
  MemberVipUpgradeUnavailableError,
} from '../src/lib/payloadCourse/memberVipUpgrade'

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

  constructor(
    private readonly subscriptions: PayloadDocument[],
    private readonly billingAccounts: PayloadDocument[]
  ) {}

  async find(args: FindCall) {
    this.findCalls.push(args)
    const memberId = String(
      ((args.where?.member as { equals?: unknown } | undefined)?.equals ?? '')
    )
    const source =
      args.collection === 'payload_subscriptions'
        ? this.subscriptions
        : args.collection === 'payload_billing_accounts'
          ? this.billingAccounts
          : []
    const docs = source.filter((document) => String(document.member) === memberId)
    return { docs: docs.slice(0, args.limit ?? docs.length) }
  }

  async findByID(args: {
    collection: string
    id: PayloadId
  }): Promise<PayloadDocument> {
    throw new Error(`unused findByID ${args.collection}:${String(args.id)}`)
  }
}

function buildStripeSessionClient() {
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
            return { url: 'https://billing.stripe.com/session/vip-upgrade' }
          },
        },
      },
    },
  }
}

function subscription(
  plan: string,
  status: string,
  cancelAtPeriodEnd = false,
  member = 'member_trusted'
): PayloadDocument {
  return {
    id: `${member}_${plan}_${status}_${String(cancelAtPeriodEnd)}`,
    member,
    plan,
    status,
    cancelAtPeriodEnd,
    updatedAt: '2026-06-24T00:00:00.000Z',
  }
}

function billingAccount(member = 'member_trusted'): PayloadDocument {
  return {
    id: `billing_${member}`,
    member,
    stripeCustomerId: `cus_${member}`,
    updatedAt: '2026-06-24T00:00:00.000Z',
  }
}

async function expectUpgradeUnavailable(
  subscriptions: PayloadDocument[],
  expectedCode: 'pro_subscription_missing' | 'pro_subscription_ineligible'
): Promise<void> {
  const payload = new FakePayload(subscriptions, [billingAccount()])
  const stripe = buildStripeSessionClient()

  await assert.rejects(
    () =>
      createAuthenticatedVipUpgradeSession(payload, 'member_trusted', {
        stripe: stripe.client,
        portalConfigurationId: 'bpc_vip_upgrade',
      }),
    (error: unknown) => {
      assert(error instanceof MemberVipUpgradeUnavailableError)
      assert.equal(error.code, expectedCode)
      return true
    }
  )
  assert.equal(stripe.calls.length, 0)
}

async function testEligibleProUsesTrustedMemberAndStripePortal(
  status: 'active' | 'trialing'
): Promise<void> {
  const payload = new FakePayload(
    [
      subscription('pro', status),
      subscription('pro', 'active', false, 'member_other'),
    ],
    [billingAccount(), billingAccount('member_other')]
  )
  const stripe = buildStripeSessionClient()

  const url = await createAuthenticatedVipUpgradeSession(
    payload,
    'member_trusted',
    {
      stripe: stripe.client,
      portalConfigurationId: 'bpc_vip_upgrade',
    }
  )

  assert.equal(url, 'https://billing.stripe.com/session/vip-upgrade')
  assert.equal(payload.findCalls.length, 2)
  assert.deepEqual(payload.findCalls[0], {
    collection: 'payload_subscriptions',
    where: { member: { equals: 'member_trusted' } },
    limit: 25,
    depth: 0,
    sort: '-updatedAt',
    overrideAccess: true,
  })
  assert.deepEqual(payload.findCalls[1], {
    collection: 'payload_billing_accounts',
    where: { member: { equals: 'member_trusted' } },
    limit: 1,
    depth: 0,
    sort: '-updatedAt',
    overrideAccess: true,
  })
  assert.deepEqual(stripe.calls, [
    {
      customer: 'cus_member_trusted',
      return_url: 'https://portal.jpvbootcamp.com/learn/billing',
      configuration: 'bpc_vip_upgrade',
    },
  ])
}

async function testRejectedStates(): Promise<void> {
  await expectUpgradeUnavailable([subscription('vip', 'active')], 'pro_subscription_missing')
  await expectUpgradeUnavailable([subscription('free', 'active')], 'pro_subscription_missing')
  await expectUpgradeUnavailable([subscription('pro', 'canceled')], 'pro_subscription_ineligible')
  await expectUpgradeUnavailable([subscription('pro', 'past_due')], 'pro_subscription_ineligible')
  await expectUpgradeUnavailable([subscription('pro', 'unpaid')], 'pro_subscription_ineligible')
  await expectUpgradeUnavailable([subscription('pro', 'active', true)], 'pro_subscription_ineligible')
}

function testNoBrowserSelectableUpgradeIdentity(): void {
  const actionSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/app/(frontend)/learn/billing/actions.ts'),
    'utf8'
  )
  const pageSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/app/(frontend)/learn/billing/page.tsx'),
    'utf8'
  )
  const helperSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/lib/payloadCourse/memberVipUpgrade.ts'),
    'utf8'
  )

  assert.match(actionSource, /openMemberVipUpgradeAction\(\): Promise<void>/)
  assert.match(
    actionSource,
    /createAuthenticatedVipUpgradeSession\(payload, member\.id\)/
  )
  assert.doesNotMatch(actionSource, /FormData/)
  assert.doesNotMatch(actionSource, /formData\.get/)
  assert.doesNotMatch(actionSource, /customerId/)
  assert.doesNotMatch(actionSource, /returnUrl/)

  assert.match(pageSource, /form action=\{openMemberVipUpgradeAction\}/)
  assert.doesNotMatch(pageSource, /<input/i)
  assert.doesNotMatch(pageSource, /type=['"]hidden['"]/i)
  assert.match(pageSource, /overview\.plan === 'pro'/)
  assert.match(pageSource, /overview\.subscriptionStatus === 'active'/)
  assert.match(pageSource, /overview\.subscriptionStatus === 'trialing'/)
  assert.match(pageSource, /!overview\.cancelAtPeriodEnd/)

  assert.match(helperSource, /createMemberBillingPortalSession/)
  assert.doesNotMatch(helperSource, /subscriptions\.update/)
  assert.doesNotMatch(helperSource, /stripe\.subscriptions\.update/)
  assert.doesNotMatch(helperSource, /priceVip/)
}

async function main(): Promise<void> {
  await testEligibleProUsesTrustedMemberAndStripePortal('active')
  await testEligibleProUsesTrustedMemberAndStripePortal('trialing')
  await testRejectedStates()
  testNoBrowserSelectableUpgradeIdentity()
  console.log('payload member VIP upgrade tests passed')
}

void main()
