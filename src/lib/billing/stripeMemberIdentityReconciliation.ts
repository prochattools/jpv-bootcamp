import type Stripe from 'stripe'

import { normalizeEmail } from '@/lib/normalize-email'
import type {
  PayloadCourseWriteAPI,
  PayloadDocument,
  PayloadId,
} from '@/lib/payloadCourse/accessService'
import { provisionMemberFromCheckout } from '@/lib/members/provisionMemberFromCheckout'
import { relationshipId } from '@/lib/domain/relationships'

const ACTIVE_STRIPE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing'])

type IdentityMatch =
  | 'customer_id'
  | 'email'
  | 'unmatched'
  | 'ambiguous'
  | 'inactive_local_member'
  | 'invalid'

export type StripeMemberIdentityRow = {
  subscriptionId: string
  customerId: string | null
  email: string | null
  displayName: string | null
  status: string
  match: IdentityMatch
  memberId: PayloadId | null
  reason: string
}

export type StripeMemberIdentityReport = {
  livemode: boolean
  generatedAt: string
  totals: {
    stripeActiveSubscriptions: number
    payloadActiveMembers: number
    matchedByCustomerId: number
    matchedByEmail: number
    unmatched: number
    ambiguous: number
    inactiveLocalMember: number
    invalid: number
  }
  rows: StripeMemberIdentityRow[]
}

type StripeIdentityClient = Pick<Stripe, 'subscriptions' | 'customers'>

type MemberProvisioner = (params: {
  email: string
  displayName?: string | null
  stripeCustomerId?: string | null
  source?: 'stripe_checkout' | 'admin_created' | 'migration'
}) => Promise<{ memberId: string; created: boolean; password: string | null }>

function customerEmail(customer: Stripe.Customer | Stripe.DeletedCustomer | string | null): string | null {
  if (!customer || typeof customer === 'string' || 'deleted' in customer) return null
  return normalizeEmail(customer.email)
}

function customerName(customer: Stripe.Customer | Stripe.DeletedCustomer | string | null): string | null {
  if (!customer || typeof customer === 'string' || 'deleted' in customer) return null
  return customer.name?.trim() || null
}

async function inventoryActiveSubscriptions(
  stripe: StripeIdentityClient,
): Promise<Array<{ subscription: Stripe.Subscription; customer: Stripe.Customer | Stripe.DeletedCustomer | string | null }>> {
  const result: Array<{ subscription: Stripe.Subscription; customer: Stripe.Customer | Stripe.DeletedCustomer | string | null }> = []
  let startingAfter: string | undefined

  do {
    const page = await stripe.subscriptions.list({
      status: 'all',
      limit: 100,
      starting_after: startingAfter,
      expand: ['data.customer'],
    })

    for (const subscription of page.data) {
      if (!ACTIVE_STRIPE_SUBSCRIPTION_STATUSES.has(subscription.status)) continue
      let customer = subscription.customer ?? null
      const customerId = relationshipId(customer)
      if (customerId && typeof customer === 'string') {
        customer = await stripe.customers.retrieve(customerId)
      }
      result.push({ subscription, customer })
    }

    startingAfter = page.has_more ? page.data.at(-1)?.id : undefined
    if (page.has_more && !startingAfter) throw new Error('subscription_inventory_checkpoint_missing')
  } while (startingAfter)

  return result
}

async function findAll(
  payload: PayloadCourseWriteAPI,
  collection: string,
): Promise<PayloadDocument[]> {
  const result = await payload.find({
    collection,
    limit: 10_000,
    depth: 0,
    overrideAccess: true,
  })
  return result.docs as PayloadDocument[]
}

function countByMatch(rows: StripeMemberIdentityRow[], match: IdentityMatch): number {
  return rows.filter((row) => row.match === match).length
}

export async function buildStripeMemberIdentityReport(params: {
  payload: PayloadCourseWriteAPI
  stripe: StripeIdentityClient
  livemode: boolean
  now?: () => Date
}): Promise<StripeMemberIdentityReport> {
  const [members, billingAccounts, subscriptions] = await Promise.all([
    findAll(params.payload, 'payload_members'),
    findAll(params.payload, 'payload_billing_accounts'),
    inventoryActiveSubscriptions(params.stripe),
  ])

  const activeMembers = members.filter((member) => member.accountStatus === 'active')
  const memberById = new Map(activeMembers.map((member) => [String(member.id), member]))
  const membersByEmail = new Map<string, PayloadDocument[]>()
  for (const member of members) {
    const email = normalizeEmail(typeof member.email === 'string' ? member.email : null)
    if (!email) continue
    const records = membersByEmail.get(email) ?? []
    records.push(member)
    membersByEmail.set(email, records)
  }

  const membersByCustomerId = new Map<string, Set<PayloadId>>()
  for (const account of billingAccounts) {
    const customerId = typeof account.stripeCustomerId === 'string' ? account.stripeCustomerId.trim() : ''
    const linkedMemberId = relationshipId(account.member)
    if (!customerId || linkedMemberId === null) continue
    const ids = membersByCustomerId.get(customerId) ?? new Set<PayloadId>()
    ids.add(linkedMemberId)
    membersByCustomerId.set(customerId, ids)
  }

  const activeSubscriptionIdsByCustomer = new Map<string, Set<string>>()
  const activeSubscriptionIdsByEmail = new Map<string, Set<string>>()
  const rows: StripeMemberIdentityRow[] = []
  for (const { subscription, customer } of subscriptions) {
    const customerId = relationshipId(subscription.customer)
    const email = customerEmail(customer)
    const customerSubscriptionIds = customerId
      ? (activeSubscriptionIdsByCustomer.get(customerId) ?? new Set<string>())
      : null
    customerSubscriptionIds?.add(subscription.id)
    if (customerId && customerSubscriptionIds) activeSubscriptionIdsByCustomer.set(customerId, customerSubscriptionIds)
    const emailSubscriptionIds = email
      ? (activeSubscriptionIdsByEmail.get(email) ?? new Set<string>())
      : null
    emailSubscriptionIds?.add(subscription.id)
    if (email && emailSubscriptionIds) activeSubscriptionIdsByEmail.set(email, emailSubscriptionIds)

    rows.push({
      subscriptionId: subscription.id,
      customerId,
      email,
      displayName: customerName(customer),
      status: subscription.status,
      match: 'invalid',
      memberId: null,
      reason: !customerId ? 'missing_stripe_customer_id' : !email ? 'missing_stripe_customer_email' : 'unclassified',
    })
  }

  for (const row of rows) {
    if (!row.customerId || !row.email) continue
    if ((activeSubscriptionIdsByCustomer.get(row.customerId)?.size ?? 0) > 1) {
      row.match = 'ambiguous'
      row.reason = 'multiple_active_subscriptions_for_customer'
      continue
    }
    if ((activeSubscriptionIdsByEmail.get(row.email)?.size ?? 0) > 1) {
      row.match = 'ambiguous'
      row.reason = 'multiple_active_subscriptions_for_email'
      continue
    }

    const customerMembers = [...(membersByCustomerId.get(row.customerId) ?? [])]
    if (customerMembers.length > 1) {
      row.match = 'ambiguous'
      row.reason = 'multiple_payload_members_linked_to_customer'
      continue
    }
    if (customerMembers.length === 1) {
      row.memberId = customerMembers[0] ?? null
      if (row.memberId !== null && memberById.has(String(row.memberId))) {
        row.match = 'customer_id'
        row.reason = 'billing_account_customer_id'
      } else {
        row.match = 'inactive_local_member'
        row.reason = 'stripe_customer_linked_to_inactive_payload_member'
      }
      continue
    }

    const emailMembers = membersByEmail.get(row.email) ?? []
    if (emailMembers.length > 1) {
      row.match = 'ambiguous'
      row.reason = 'multiple_payload_members_for_email'
      continue
    }
    if (emailMembers.length === 1) {
      row.memberId = emailMembers[0]?.id ?? null
      if (emailMembers[0]?.accountStatus === 'active') {
        row.match = 'email'
        row.reason = 'unambiguous_normalized_email'
      } else {
        row.match = 'inactive_local_member'
        row.reason = 'normalized_email_matches_inactive_payload_member'
      }
      continue
    }

    row.match = 'unmatched'
    row.reason = 'no_payload_member_or_billing_account_match'
  }

  return {
    livemode: params.livemode,
    generatedAt: (params.now?.() ?? new Date()).toISOString(),
    totals: {
      stripeActiveSubscriptions: rows.length,
      payloadActiveMembers: activeMembers.length,
      matchedByCustomerId: countByMatch(rows, 'customer_id'),
      matchedByEmail: countByMatch(rows, 'email'),
      unmatched: countByMatch(rows, 'unmatched'),
      ambiguous: countByMatch(rows, 'ambiguous'),
      inactiveLocalMember: countByMatch(rows, 'inactive_local_member'),
      invalid: countByMatch(rows, 'invalid'),
    },
    rows,
  }
}

export async function applyStripeMemberIdentityBackfill(params: {
  payload: PayloadCourseWriteAPI
  stripe: StripeIdentityClient
  livemode: boolean
  expectedUnmatched: number
  provisionMember?: MemberProvisioner
  now?: () => Date
}): Promise<{
  report: StripeMemberIdentityReport
  created: number
  alreadyPresent: number
}> {
  if (!params.livemode) throw new Error('stripe_member_identity_backfill_requires_live_mode')

  const report = await buildStripeMemberIdentityReport(params)
  if (report.totals.ambiguous > 0 || report.totals.inactiveLocalMember > 0 || report.totals.invalid > 0) {
    throw new Error('stripe_member_identity_backfill_review_required')
  }
  if (report.totals.unmatched !== params.expectedUnmatched) {
    throw new Error(`stripe_member_identity_backfill_unmatched_count_changed:${report.totals.unmatched}`)
  }

  const provision = params.provisionMember ?? provisionMemberFromCheckout
  let created = 0
  let alreadyPresent = 0
  for (const row of report.rows.filter((candidate) => candidate.match === 'unmatched')) {
    if (!row.email || !row.customerId) throw new Error('stripe_member_identity_backfill_row_missing_identity')
    const result = await provision({
      email: row.email,
      displayName: row.displayName,
      stripeCustomerId: row.customerId,
      source: 'stripe_checkout',
    })
    if (!result.memberId) throw new Error('stripe_member_identity_backfill_member_creation_failed')
    if (result.created) created += 1
    else alreadyPresent += 1
  }

  return { report, created, alreadyPresent }
}
