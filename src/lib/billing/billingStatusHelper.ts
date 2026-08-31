import 'server-only'

import prisma from '@/libs/prisma'
import { normalizeEmail } from '@/lib/normalize-email'
import { getStripe } from '@/lib/stripe'
import {
  resolveMembershipLifecycle,
  type MembershipLifecycleState,
} from '@/lib/billing/membershipLifecycle'

export type BillingAccessState = 'available' | 'billing_hold' | 'inactive' | 'unknown'
export type BillingPaymentState =
  | 'failed'
  | 'action_required'
  | 'paid'
  | 'refunded'
  | 'disputed'
  | 'dispute_won'
  | 'dispute_lost'
  | 'dispute_resolved'

export type BillingStatus = {
  hasBillingAccount: boolean
  hasActiveSubscription: boolean
  planLabel: string | null
  subscriptionStatus: string | null
  membershipStatus: MembershipLifecycleState
  billingAccessState: BillingAccessState
  periodEndDate: Date | null
  cancelAtPeriodEnd: boolean
  billingCadence: string | null
  commitmentStatus: string | null
  commitmentStartAt: Date | null
  commitmentEndAt: Date | null
  cancellationRequestedAt: Date | null
  cancellationEffectiveAt: Date | null
  paymentGraceEndsAt: Date | null
  withinPaymentGrace: boolean
  restrictedPortalRequired: boolean
  paymentStatus: BillingPaymentState | null
  paymentFailedAt: Date | null
  paymentRefundedAt: Date | null
  paymentDisputeStatus: string | null
  paymentDisputedAt: Date | null
  paymentDisputeResolvedAt: Date | null
  showPaymentWarning: boolean
  showRefundNotice: boolean
  showDisputeNotice: boolean
  manageBillingAvailable: boolean
}

const BILLING_PAYMENT_STATES = new Set<BillingPaymentState>([
  'failed',
  'action_required',
  'paid',
  'refunded',
  'disputed',
  'dispute_won',
  'dispute_lost',
  'dispute_resolved',
])

function emptyBillingStatus(): BillingStatus {
  return {
    hasBillingAccount: false,
    hasActiveSubscription: false,
    planLabel: null,
    subscriptionStatus: null,
    membershipStatus: 'unreconciled',
    billingAccessState: 'unknown',
    periodEndDate: null,
    cancelAtPeriodEnd: false,
    billingCadence: null,
    commitmentStatus: null,
    commitmentStartAt: null,
    commitmentEndAt: null,
    cancellationRequestedAt: null,
    cancellationEffectiveAt: null,
    paymentGraceEndsAt: null,
    withinPaymentGrace: false,
    restrictedPortalRequired: false,
    paymentStatus: null,
    paymentFailedAt: null,
    paymentRefundedAt: null,
    paymentDisputeStatus: null,
    paymentDisputedAt: null,
    paymentDisputeResolvedAt: null,
    showPaymentWarning: false,
    showRefundNotice: false,
    showDisputeNotice: false,
    manageBillingAvailable: false,
  }
}

function billingAccessStateForLifecycle(params: {
  state: MembershipLifecycleState
  accessAllowed: boolean
}): BillingAccessState {
  if (params.accessAllowed) return 'available'
  if (params.state === 'past_due') return 'billing_hold'
  if (params.state === 'unreconciled') return 'unknown'
  return 'inactive'
}

async function getStripeFallbackStatus(
  normalizedEmail: string,
  knownCustomerId?: string,
): Promise<BillingStatus> {
  try {
    const stripe = getStripe()
    let customerId = knownCustomerId
    if (!customerId) {
      const customers = await stripe.customers.list({ email: normalizedEmail, limit: 10 })
      const matches = customers.data.filter((customer) => normalizeEmail(customer.email ?? '') === normalizedEmail)
      if (matches.length !== 1) return emptyBillingStatus()
      customerId = matches[0].id
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 100,
    })
    const subscription = [...subscriptions.data].sort((left, right) => right.created - left.created)[0]
    const subscriptionStatus = subscription?.status ?? null
    const cancelAtPeriodEnd = subscription?.cancel_at_period_end ?? false
    const lifecycle = resolveMembershipLifecycle({
      hasBillingAccount: true,
      subscriptionStatus,
      paymentStatus: null,
      withinPaymentGrace: false,
      cancelAtPeriodEnd,
    })
    const interval = subscription?.items.data[0]?.price?.recurring?.interval

    return {
      hasBillingAccount: true,
      hasActiveSubscription: lifecycle.accessAllowed,
      planLabel: subscription ? 'JPV Bootcamp Membership' : null,
      subscriptionStatus,
      membershipStatus: lifecycle.state,
      billingAccessState: billingAccessStateForLifecycle(lifecycle),
      periodEndDate: typeof subscription?.current_period_end === 'number'
        ? new Date(subscription.current_period_end * 1000)
        : null,
      cancelAtPeriodEnd,
      billingCadence: interval === 'year' ? 'annual' : interval === 'month' ? 'monthly_commitment' : null,
      commitmentStatus: null,
      commitmentStartAt: null,
      commitmentEndAt: null,
      cancellationRequestedAt: null,
      cancellationEffectiveAt: null,
      paymentGraceEndsAt: null,
      withinPaymentGrace: false,
      restrictedPortalRequired: false,
      paymentStatus: null,
      paymentFailedAt: null,
      paymentRefundedAt: null,
      paymentDisputeStatus: null,
      paymentDisputedAt: null,
      paymentDisputeResolvedAt: null,
      showPaymentWarning: subscriptionStatus === 'past_due' || subscriptionStatus === 'unpaid',
      showRefundNotice: false,
      showDisputeNotice: false,
      manageBillingAvailable: true,
    }
  } catch {
    // Stripe is an enrichment fallback. The existing local projection remains
    // the normal fast path and a provider outage must not break the portal.
    return emptyBillingStatus()
  }
}

export async function getBillingStatus(memberEmail: string): Promise<BillingStatus> {
  const normalizedEmail = normalizeEmail(memberEmail)
  if (!normalizedEmail) return emptyBillingStatus()

  const record = await prisma.customerProvisioning.findUnique({
    where: { normalizedEmail },
    select: {
      stripeCustomerId: true,
      subscriptionStatus: true,
      subscriptionCurrentPeriodEnd: true,
      subscriptionCancelAtPeriodEnd: true,
      billingCadence: true,
      commitmentStatus: true,
      commitmentStartAt: true,
      commitmentEndAt: true,
      cancellationRequestedAt: true,
      cancellationEffectiveAt: true,
      paymentGraceEndsAt: true,
      paymentStatus: true,
      paymentFailedAt: true,
      paymentRefundedAt: true,
      paymentDisputeStatus: true,
      paymentDisputedAt: true,
      paymentDisputeResolvedAt: true,
    },
  })

  if (!record || !record.stripeCustomerId) return getStripeFallbackStatus(normalizedEmail)

  // Older operational records can have a linked Stripe customer but no
  // locally mirrored subscription status. Resolve the current provider state
  // before exposing a pending/unknown member experience.
  const providerFallback = record.subscriptionStatus
    ? null
    : await getStripeFallbackStatus(normalizedEmail, record.stripeCustomerId)
  const subscriptionStatus = record.subscriptionStatus ?? providerFallback?.subscriptionStatus ?? null
  const cancelAtPeriodEnd = record.subscriptionCancelAtPeriodEnd ?? providerFallback?.cancelAtPeriodEnd ?? false
  const periodEndDate = record.subscriptionCurrentPeriodEnd ?? providerFallback?.periodEndDate ?? null
  const billingCadence = record.billingCadence ?? providerFallback?.billingCadence ?? null

  const paymentStatus =
    record.paymentStatus && BILLING_PAYMENT_STATES.has(record.paymentStatus as BillingPaymentState)
      ? (record.paymentStatus as BillingPaymentState)
      : null
  const withinPaymentGrace = Boolean(
    record.paymentGraceEndsAt && record.paymentGraceEndsAt.getTime() >= Date.now(),
  )
  const lifecycle = resolveMembershipLifecycle({
    hasBillingAccount: true,
    subscriptionStatus,
    paymentStatus,
    withinPaymentGrace,
    cancelAtPeriodEnd,
  })

  return {
    hasBillingAccount: true,
    hasActiveSubscription: lifecycle.accessAllowed,
    planLabel: 'JPV Bootcamp Membership',
    subscriptionStatus,
    membershipStatus: lifecycle.state,
    billingAccessState: billingAccessStateForLifecycle(lifecycle),
    periodEndDate,
    cancelAtPeriodEnd,
    billingCadence,
    commitmentStatus: record.commitmentStatus,
    commitmentStartAt: record.commitmentStartAt,
    commitmentEndAt: record.commitmentEndAt,
    cancellationRequestedAt: record.cancellationRequestedAt,
    cancellationEffectiveAt: record.cancellationEffectiveAt,
    paymentGraceEndsAt: record.paymentGraceEndsAt,
    withinPaymentGrace,
    restrictedPortalRequired: false,
    paymentStatus,
    paymentFailedAt: record.paymentFailedAt,
    paymentRefundedAt: record.paymentRefundedAt,
    paymentDisputeStatus: record.paymentDisputeStatus,
    paymentDisputedAt: record.paymentDisputedAt,
    paymentDisputeResolvedAt: record.paymentDisputeResolvedAt,
    showPaymentWarning:
      paymentStatus === 'failed' ||
      paymentStatus === 'action_required' ||
      subscriptionStatus === 'past_due',
    showRefundNotice: paymentStatus === 'refunded',
    showDisputeNotice: paymentStatus === 'disputed',
    manageBillingAvailable: true,
  }
}
