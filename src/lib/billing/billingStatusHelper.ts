import 'server-only'
import type Stripe from 'stripe'

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

function shouldRefreshProviderStatus(subscriptionStatus: string | null): boolean {
  // Checkout/shadow-sync ordering can leave an explicit `incomplete` local
  // projection behind a live Stripe subscription. Re-check only this
  // recoverable activation state; terminal local states remain authoritative.
  return subscriptionStatus === null || subscriptionStatus === 'incomplete'
}

function isMissingStripeCustomer(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const stripeError = error as { code?: string; message?: string }
  return stripeError.code === 'resource_missing' || Boolean(
    stripeError.message?.includes('No such customer') || stripeError.message?.includes('Invalid customer ID'),
  )
}

async function getStripeFallbackStatus(
  normalizedEmail: string,
  knownCustomerId?: string,
): Promise<BillingStatus> {
  try {
    const stripe = getStripe()
    let customerId = knownCustomerId
    let subscriptions: Stripe.Subscription[] | null = null
    if (!customerId) {
      subscriptions = null
    } else {
      try {
        subscriptions = (await stripe.subscriptions.list({
          customer: customerId,
          status: 'all',
          limit: 100,
        })).data
      } catch (error) {
        if (!isMissingStripeCustomer(error)) throw error
        subscriptions = null
      }
    }

    // A stale local customer link must not hide a real active subscription.
    // Re-resolve only when the linked customer is missing or has no records;
    // the normal linked-customer path stays a single provider request.
    if (!subscriptions || subscriptions.length === 0) {
      const customers = await stripe.customers.list({ email: normalizedEmail, limit: 10 })
      const matches = customers.data.filter((customer) => normalizeEmail(customer.email ?? '') === normalizedEmail)
      if (matches.length !== 1) {
        if (knownCustomerId && subscriptions) customerId = knownCustomerId
        else return emptyBillingStatus()
      } else {
        const resolvedCustomerId = matches[0].id
        if (!subscriptions || resolvedCustomerId !== customerId) {
          subscriptions = (await stripe.subscriptions.list({
            customer: resolvedCustomerId,
            status: 'all',
            limit: 100,
          })).data
        }
        customerId = resolvedCustomerId
      }
    }

    const subscription = [...(subscriptions ?? [])].sort((left, right) => right.created - left.created)[0]
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
  const providerFallback = shouldRefreshProviderStatus(record.subscriptionStatus)
    ? await getStripeFallbackStatus(normalizedEmail, record.stripeCustomerId)
    : null
  const subscriptionStatus = providerFallback?.subscriptionStatus ?? record.subscriptionStatus ?? null
  const cancelAtPeriodEnd = providerFallback?.cancelAtPeriodEnd ?? record.subscriptionCancelAtPeriodEnd ?? false
  const periodEndDate = providerFallback?.periodEndDate ?? record.subscriptionCurrentPeriodEnd ?? null
  const billingCadence = providerFallback?.billingCadence ?? record.billingCadence ?? null

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
