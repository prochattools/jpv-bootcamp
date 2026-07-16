export type MigrationEligibility = 'eligible' | 'manual_review' | 'ineligible'
export type MigrationCadence = 'monthly' | 'annual'

export type MigrationCandidateInput = {
  normalizedEmail: string
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  stripePriceId: string | null
  subscriptionStatus: string | null
  subscriptionCurrentPeriodEnd: Date | null
  subscriptionCancelAtPeriodEnd: boolean | null
  billingCadence: string | null
  paymentStatus: string | null
  paymentDisputeStatus: string | null
  stripeScheduleId?: string | null
  subscriptionItemCount?: number | null
  isMetered?: boolean | null
}

export type MigrationCandidate = MigrationCandidateInput & {
  targetCadence: MigrationCadence | null
  eligibility: MigrationEligibility
  reasons: string[]
}

const AUTO_ELIGIBLE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing'])
const REVIEW_SUBSCRIPTION_STATUSES = new Set([
  'past_due',
  'unpaid',
  'incomplete',
  'incomplete_expired',
  'paused',
])
const REVIEW_PAYMENT_STATES = new Set(['failed', 'action_required', 'disputed', 'dispute_lost'])

export function normalizeMigrationCadence(value: string | null | undefined): MigrationCadence | null {
  const normalized = value?.trim().toLowerCase()
  if (normalized === 'monthly' || normalized === 'month') return 'monthly'
  if (normalized === 'annual' || normalized === 'yearly' || normalized === 'year') return 'annual'
  return null
}

export function classifyMigrationCandidate(input: MigrationCandidateInput): MigrationCandidate {
  const reasons: string[] = []
  const targetCadence = normalizeMigrationCadence(input.billingCadence)

  if (!input.stripeCustomerId) reasons.push('missing_stripe_customer')
  if (!input.stripeSubscriptionId) reasons.push('missing_stripe_subscription')
  if (!input.stripePriceId) reasons.push('missing_source_price')
  if (!targetCadence) reasons.push('unknown_billing_cadence')
  if (!input.subscriptionCurrentPeriodEnd) reasons.push('missing_period_end')
  if (input.subscriptionCancelAtPeriodEnd) reasons.push('cancel_at_period_end')
  if (input.stripeScheduleId) reasons.push('subscription_schedule_present')
  if ((input.subscriptionItemCount ?? 1) !== 1) reasons.push('multi_item_subscription')
  if (input.isMetered) reasons.push('metered_subscription')

  if (input.paymentStatus && REVIEW_PAYMENT_STATES.has(input.paymentStatus)) {
    reasons.push(`payment_${input.paymentStatus}`)
  }
  if (input.paymentDisputeStatus) reasons.push('payment_dispute_present')

  const status = input.subscriptionStatus?.trim().toLowerCase() ?? null
  if (!status) reasons.push('missing_subscription_status')
  else if (REVIEW_SUBSCRIPTION_STATUSES.has(status)) reasons.push(`subscription_${status}`)
  else if (!AUTO_ELIGIBLE_SUBSCRIPTION_STATUSES.has(status)) reasons.push(`subscription_${status}`)

  const missingCoreIdentity = reasons.some((reason) =>
    ['missing_stripe_customer', 'missing_stripe_subscription', 'missing_source_price'].includes(reason),
  )

  const eligibility: MigrationEligibility = missingCoreIdentity
    ? 'ineligible'
    : reasons.length === 0
      ? 'eligible'
      : 'manual_review'

  return { ...input, targetCadence, eligibility, reasons: [...new Set(reasons)] }
}

export type StripeInvoicePreviewRequest = {
  customer: string
  subscription: string
  subscription_details: {
    proration_behavior: 'create_prorations'
    items: Array<{ id: string; price: string }>
  }
}

export function buildStripeInvoicePreviewRequest(params: {
  candidate: MigrationCandidate
  subscriptionItemId: string
  targetPriceId: string
}): StripeInvoicePreviewRequest {
  if (params.candidate.eligibility !== 'eligible') throw new Error('migration_candidate_not_eligible')
  if (!params.candidate.stripeCustomerId) throw new Error('migration_customer_missing')
  if (!params.candidate.stripeSubscriptionId) throw new Error('migration_subscription_missing')
  if (!params.subscriptionItemId.trim()) throw new Error('migration_subscription_item_missing')
  if (!params.targetPriceId.trim()) throw new Error('migration_target_price_missing')

  return {
    customer: params.candidate.stripeCustomerId,
    subscription: params.candidate.stripeSubscriptionId,
    subscription_details: {
      proration_behavior: 'create_prorations',
      items: [{ id: params.subscriptionItemId, price: params.targetPriceId }],
    },
  }
}

export function summarizeMigrationCandidates(candidates: MigrationCandidate[]) {
  return candidates.reduce(
    (summary, candidate) => {
      summary.total += 1
      summary[candidate.eligibility] += 1
      return summary
    },
    { total: 0, eligible: 0, manual_review: 0, ineligible: 0 },
  )
}
