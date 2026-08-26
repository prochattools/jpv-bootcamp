export type MigrationEligibility = 'eligible' | 'manual_review' | 'ineligible'
export type MigrationCadence = 'monthly' | 'annual'
export type MigrationReconciliationState = 'matched' | 'mismatch' | 'pending' | 'failed'

export type MigrationBlockingReason =
  | 'missing_customer'
  | 'missing_subscription'
  | 'missing_item_id'
  | 'missing_current_price'
  | 'missing_target_price'
  | 'unsupported_cadence'
  | 'past_due'
  | 'unpaid'
  | 'incomplete'
  | 'paused'
  | 'disputed'
  | 'cancellation_pending'
  | 'schedule_present'
  | 'multiple_items'
  | 'metered'
  | 'preview_missing'
  | 'price_mismatch'
  | 'cadence_mismatch'
  | 'billing_anchor_mismatch'
  | 'next_renewal_mismatch'
  | 'discount_mismatch'
  | 'tax_mismatch'
  | 'zero_amount'
  | 'net_credit'
  | 'unexpected_negative_amount'
  | 'reconciliation_mismatch'

export type MigrationWarningCode = 'same_price_candidate' | 'preview_reconciled'

export type StripeCustomerProjection = {
  customerId: string | null
  memberId: string | null
  normalizedEmail: string
}

export type StripeSubscriptionProjection = {
  subscriptionId: string | null
  itemId: string | null
  currentProductId: string | null
  currentPriceId: string | null
  targetProductId: string | null
  targetPriceId: string | null
  currentCadence: string | null
  targetCadence: string | null
  currentPeriodStart: Date | null
  currentPeriodEnd: Date | null
  billingCycleAnchor: string | null
  cancelAtPeriodEnd: boolean | null
  status: string | null
  paymentStatus: string | null
  disputeStatus: string | null
  scheduleState: string | null
  itemCount: number | null
  meteredState: boolean | null
  activeDiscountLabel: string | null
  activeDiscountAmount: number | null
  taxBehavior: string | null
  currentAmount: number | null
  targetAmount: number | null
  reconciliationState: MigrationReconciliationState | null
}

export type MigrationPreviewEvidence = {
  invoiceLineCount: number | null
  previewTimestamp: Date | null
  unusedTimeCredit: number | null
  remainingTimeCharge: number | null
  discountAmount: number | null
  taxAmount: number | null
  subtotal: number | null
  amountDue: number | null
  currency: string | null
  nextRenewalDate: Date | null
  expectedTargetPriceId: string | null
  expectedTargetCadence: MigrationCadence | null
  expectedBillingAnchor: string | null
  expectedReconciliationState: MigrationReconciliationState | null
  expectedDiscountAmount: number | null
  expectedTaxAmount: number | null
  expectedSubtotal: number | null
  expectedAmountDue: number | null
  expectedTaxBehavior: string | null
  warningCodes: MigrationWarningCode[]
}

export type MigrationCandidateInput = {
  stableCandidateId: string
  memberId: string | null
  normalizedEmail: string
  stripeCustomerProjection: StripeCustomerProjection
  stripeSubscriptionProjection: StripeSubscriptionProjection
  preview: MigrationPreviewEvidence | null
}

export type ClassifiedMigrationCandidate = MigrationCandidateInput & {
  targetCadence: MigrationCadence | null
  eligibility: MigrationEligibility
  reasons: MigrationBlockingReason[]
  warnings: MigrationWarningCode[]
}

export type MigrationCurrencyTotals = {
  candidateCount: number
  creditTotal: number
  chargeTotal: number
  taxTotal: number
  amountDueTotal: number
}

export type MigrationPreviewReport = {
  generatedAt: string
  totals: {
    candidateCount: number
    eligibleCount: number
    manualReviewCount: number
    ineligibleCount: number
    creditTotal: number
    chargeTotal: number
    taxTotal: number
    amountDueTotal: number
  }
  reasonCounts: Record<MigrationBlockingReason, number>
  warningCounts: Record<MigrationWarningCode, number>
  reconciliationExpectations: Record<MigrationReconciliationState | 'unknown', number>
  currencyTotals: Record<string, MigrationCurrencyTotals>
  candidates: ClassifiedMigrationCandidate[]
}

export type StripeInvoicePreviewRequest = {
  customer: string
  subscription: string
  subscription_details: {
    proration_behavior: 'create_prorations'
    items: Array<{ id: string; price: string }>
  }
}

type SerializedDate = string | null

export type SerializedMigrationCandidateInput = {
  stableCandidateId: string
  memberId: string | null
  normalizedEmail: string
  stripeCustomerProjection: {
    customerId: string | null
    memberId: string | null
    normalizedEmail: string
  }
  stripeSubscriptionProjection: {
    subscriptionId: string | null
    itemId: string | null
    currentProductId: string | null
    currentPriceId: string | null
    targetProductId: string | null
    targetPriceId: string | null
    currentCadence: string | null
    targetCadence: string | null
    currentPeriodStart: SerializedDate
    currentPeriodEnd: SerializedDate
    billingCycleAnchor: string | null
    cancelAtPeriodEnd: boolean | null
    status: string | null
    paymentStatus: string | null
    disputeStatus: string | null
    scheduleState: string | null
    itemCount: number | null
    meteredState: boolean | null
    activeDiscountLabel: string | null
    activeDiscountAmount: number | null
    taxBehavior: string | null
    currentAmount: number | null
    targetAmount: number | null
    reconciliationState: MigrationReconciliationState | null
  }
  preview: null | {
    invoiceLineCount: number | null
    previewTimestamp: SerializedDate
    unusedTimeCredit: number | null
    remainingTimeCharge: number | null
    discountAmount: number | null
    taxAmount: number | null
    subtotal: number | null
    amountDue: number | null
    currency: string | null
    nextRenewalDate: SerializedDate
    expectedTargetPriceId: string | null
    expectedTargetCadence: MigrationCadence | null
    expectedBillingAnchor: string | null
    expectedReconciliationState: MigrationReconciliationState | null
    expectedDiscountAmount: number | null
    expectedTaxAmount: number | null
    expectedSubtotal: number | null
    expectedAmountDue: number | null
    expectedTaxBehavior: string | null
    warningCodes: MigrationWarningCode[]
  }
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

function normalizeString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function normalizeDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function normalizeCadence(value: string | null | undefined): MigrationCadence | null {
  const normalized = normalizeString(value)?.toLowerCase()
  if (normalized === 'monthly' || normalized === 'month') return 'monthly'
  if (normalized === 'annual' || normalized === 'yearly' || normalized === 'year') return 'annual'
  return null
}

export function normalizeMigrationCadence(value: string | null | undefined): MigrationCadence | null {
  return normalizeCadence(value)
}

function toWarningSet(values: MigrationWarningCode[]): MigrationWarningCode[] {
  return [...new Set(values)]
}

function toReasonSet(values: MigrationBlockingReason[]): MigrationBlockingReason[] {
  return [...new Set(values)]
}

function sameDate(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false
  return a.getTime() === b.getTime()
}

function sameMaybeString(a: string | null, b: string | null): boolean {
  return normalizeString(a) === normalizeString(b)
}

function isSamePriceCandidate(input: MigrationCandidateInput): boolean {
  const subscription = input.stripeSubscriptionProjection
  const currentCadence = normalizeCadence(subscription.currentCadence)
  const targetCadence = normalizeCadence(subscription.targetCadence)

  return (
    Boolean(subscription.currentPriceId && subscription.targetPriceId) &&
    sameMaybeString(subscription.currentPriceId, subscription.targetPriceId) &&
    currentCadence !== null &&
    currentCadence === targetCadence &&
    subscription.currentAmount === subscription.targetAmount
  )
}

function isCoreIdentityMissing(candidate: ClassifiedMigrationCandidate): boolean {
  return [
    'missing_customer',
    'missing_subscription',
    'missing_item_id',
    'missing_current_price',
    'missing_target_price',
  ].some((reason) => candidate.reasons.includes(reason as MigrationBlockingReason))
}

function classifyWarnings(candidate: MigrationCandidateInput): MigrationWarningCode[] {
  const warnings: MigrationWarningCode[] = []
  const preview = candidate.preview

  if (isSamePriceCandidate(candidate)) warnings.push('same_price_candidate')
  if (preview && preview.warningCodes.length > 0) warnings.push(...preview.warningCodes)
  return toWarningSet(warnings)
}

export function classifyMigrationCandidate(input: MigrationCandidateInput): ClassifiedMigrationCandidate {
  const reasons: MigrationBlockingReason[] = []
  const subscription = input.stripeSubscriptionProjection
  const preview = input.preview
  const currentCadence = normalizeCadence(subscription.currentCadence)
  const targetCadence = normalizeCadence(subscription.targetCadence)

  if (!normalizeString(input.stripeCustomerProjection.customerId)) reasons.push('missing_customer')
  if (!normalizeString(subscription.subscriptionId)) reasons.push('missing_subscription')
  if (!normalizeString(subscription.itemId)) reasons.push('missing_item_id')
  if (!normalizeString(subscription.currentPriceId)) reasons.push('missing_current_price')
  if (!normalizeString(subscription.targetPriceId)) reasons.push('missing_target_price')
  if (!currentCadence || !targetCadence) reasons.push('unsupported_cadence')

  const status = normalizeString(subscription.status)?.toLowerCase() ?? null
  if (!status || (!AUTO_ELIGIBLE_SUBSCRIPTION_STATUSES.has(status) && !REVIEW_SUBSCRIPTION_STATUSES.has(status))) {
    reasons.push('unsupported_cadence')
  } else if (status === 'past_due') {
    reasons.push('past_due')
  } else if (status === 'unpaid') {
    reasons.push('unpaid')
  } else if (status === 'incomplete' || status === 'incomplete_expired') {
    reasons.push('incomplete')
  } else if (status === 'paused') {
    reasons.push('paused')
  }

  if (REVIEW_PAYMENT_STATES.has(normalizeString(subscription.paymentStatus)?.toLowerCase() ?? '')) {
    reasons.push('disputed')
  }
  if (normalizeString(subscription.disputeStatus)) {
    reasons.push('disputed')
  }
  if (subscription.cancelAtPeriodEnd) reasons.push('cancellation_pending')
  if (normalizeString(subscription.scheduleState)) reasons.push('schedule_present')
  if ((subscription.itemCount ?? 1) > 1) reasons.push('multiple_items')
  if (subscription.meteredState) reasons.push('metered')

  if (!preview) {
    reasons.push('preview_missing')
  } else {
    if (
      preview.expectedTargetPriceId &&
      subscription.targetPriceId &&
      !sameMaybeString(preview.expectedTargetPriceId, subscription.targetPriceId)
    ) {
      reasons.push('price_mismatch')
    }

    if (preview.expectedTargetCadence && targetCadence && preview.expectedTargetCadence !== targetCadence) {
      reasons.push('cadence_mismatch')
    }

    if (
      preview.expectedBillingAnchor &&
      subscription.billingCycleAnchor &&
      !sameMaybeString(preview.expectedBillingAnchor, subscription.billingCycleAnchor)
    ) {
      reasons.push('billing_anchor_mismatch')
    }

    if (!sameDate(preview.nextRenewalDate, subscription.currentPeriodEnd)) {
      reasons.push('next_renewal_mismatch')
    }

    if (
      preview.expectedDiscountAmount !== null &&
      subscription.activeDiscountAmount !== null &&
      preview.expectedDiscountAmount !== subscription.activeDiscountAmount
    ) {
      reasons.push('discount_mismatch')
    }

    if (
      preview.expectedTaxAmount !== null &&
      preview.taxAmount !== null &&
      preview.expectedTaxAmount !== preview.taxAmount
    ) {
      reasons.push('tax_mismatch')
    }

    if (preview.amountDue === 0 && !isSamePriceCandidate(input)) {
      reasons.push('zero_amount')
    }

    if (preview.amountDue !== null && preview.amountDue < 0) {
      if (preview.unusedTimeCredit !== null && preview.unusedTimeCredit > (preview.remainingTimeCharge ?? 0)) {
        reasons.push('net_credit')
      } else {
        reasons.push('unexpected_negative_amount')
      }
    }

    if (
      preview.expectedReconciliationState &&
      subscription.reconciliationState &&
      preview.expectedReconciliationState !== subscription.reconciliationState
    ) {
      reasons.push('reconciliation_mismatch')
    }
  }

  const classified: ClassifiedMigrationCandidate = {
    ...input,
    targetCadence,
    eligibility: 'eligible',
    reasons: [],
    warnings: [],
  }

  classified.reasons = toReasonSet(reasons)
  classified.warnings = classifyWarnings(input)

  const hasMissingIdentity = isCoreIdentityMissing(classified)
  classified.eligibility = hasMissingIdentity
    ? 'ineligible'
    : classified.reasons.length === 0
      ? 'eligible'
      : 'manual_review'

  return classified
}

export function summarizeMigrationCandidates(candidates: ClassifiedMigrationCandidate[]) {
  return candidates.reduce(
    (summary, candidate) => {
      summary.candidateCount += 1
      if (candidate.eligibility === 'eligible') summary.eligibleCount += 1
      if (candidate.eligibility === 'manual_review') summary.manualReviewCount += 1
      if (candidate.eligibility === 'ineligible') summary.ineligibleCount += 1
      return summary
    },
    { candidateCount: 0, eligibleCount: 0, manualReviewCount: 0, ineligibleCount: 0 },
  )
}

function sortCandidates(candidates: ClassifiedMigrationCandidate[]): ClassifiedMigrationCandidate[] {
  return [...candidates].sort((left, right) => {
    const idCompare = left.stableCandidateId.localeCompare(right.stableCandidateId)
    if (idCompare !== 0) return idCompare
    return left.normalizedEmail.localeCompare(right.normalizedEmail)
  })
}

function currencyKey(value: string | null | undefined): string {
  return normalizeString(value)?.toUpperCase() ?? 'UNKNOWN'
}

function emptyCurrencyTotals(): MigrationCurrencyTotals {
  return {
    candidateCount: 0,
    creditTotal: 0,
    chargeTotal: 0,
    taxTotal: 0,
    amountDueTotal: 0,
  }
}

function tallyReasonCounts(candidates: ClassifiedMigrationCandidate[]): Record<MigrationBlockingReason, number> {
  const counts = Object.fromEntries(
    [
      'missing_customer',
      'missing_subscription',
      'missing_item_id',
      'missing_current_price',
      'missing_target_price',
      'unsupported_cadence',
      'past_due',
      'unpaid',
      'incomplete',
      'paused',
      'disputed',
      'cancellation_pending',
      'schedule_present',
      'multiple_items',
      'metered',
      'preview_missing',
      'price_mismatch',
      'cadence_mismatch',
      'billing_anchor_mismatch',
      'next_renewal_mismatch',
      'discount_mismatch',
      'tax_mismatch',
      'zero_amount',
      'net_credit',
      'unexpected_negative_amount',
      'reconciliation_mismatch',
    ].map((reason) => [reason, 0]),
  ) as Record<MigrationBlockingReason, number>

  for (const candidate of candidates) {
    for (const reason of candidate.reasons) {
      counts[reason] += 1
    }
  }

  return counts
}

function tallyWarningCounts(candidates: ClassifiedMigrationCandidate[]): Record<MigrationWarningCode, number> {
  const counts = Object.fromEntries(
    ['same_price_candidate', 'preview_reconciled'].map((warning) => [warning, 0]),
  ) as Record<MigrationWarningCode, number>

  for (const candidate of candidates) {
    for (const warning of candidate.warnings) {
      counts[warning] += 1
    }
  }

  return counts
}

function tallyReconciliationExpectations(
  candidates: ClassifiedMigrationCandidate[],
): Record<MigrationReconciliationState | 'unknown', number> {
  const counts: Record<MigrationReconciliationState | 'unknown', number> = {
    matched: 0,
    mismatch: 0,
    pending: 0,
    failed: 0,
    unknown: 0,
  }

  for (const candidate of candidates) {
    const expected = candidate.preview?.expectedReconciliationState ?? 'unknown'
    counts[expected] += 1
  }

  return counts
}

function tallyCurrencyTotals(candidates: ClassifiedMigrationCandidate[]): Record<string, MigrationCurrencyTotals> {
  const totals: Record<string, MigrationCurrencyTotals> = {}

  for (const candidate of candidates) {
    const key = currencyKey(candidate.preview?.currency)
    totals[key] ??= emptyCurrencyTotals()
    const bucket = totals[key]
    const preview = candidate.preview
    bucket.candidateCount += 1
    bucket.creditTotal += preview?.unusedTimeCredit ?? 0
    bucket.chargeTotal += preview?.remainingTimeCharge ?? 0
    bucket.taxTotal += preview?.taxAmount ?? 0
    bucket.amountDueTotal += preview?.amountDue ?? 0
  }

  return totals
}

function tallyAmounts(candidates: ClassifiedMigrationCandidate[]) {
  return candidates.reduce(
    (totals, candidate) => {
      const preview = candidate.preview
      totals.creditTotal += preview?.unusedTimeCredit ?? 0
      totals.chargeTotal += preview?.remainingTimeCharge ?? 0
      totals.taxTotal += preview?.taxAmount ?? 0
      totals.amountDueTotal += preview?.amountDue ?? 0
      return totals
    },
    { creditTotal: 0, chargeTotal: 0, taxTotal: 0, amountDueTotal: 0 },
  )
}

export function buildMembershipMigrationPreviewReport(
  inputs: MigrationCandidateInput[],
): MigrationPreviewReport {
  const candidates = sortCandidates(inputs.map(classifyMigrationCandidate))
  const summary = summarizeMigrationCandidates(candidates)
  const totals = tallyAmounts(candidates)

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      candidateCount: summary.candidateCount,
      eligibleCount: summary.eligibleCount,
      manualReviewCount: summary.manualReviewCount,
      ineligibleCount: summary.ineligibleCount,
      creditTotal: totals.creditTotal,
      chargeTotal: totals.chargeTotal,
      taxTotal: totals.taxTotal,
      amountDueTotal: totals.amountDueTotal,
    },
    reasonCounts: tallyReasonCounts(candidates),
    warningCounts: tallyWarningCounts(candidates),
    reconciliationExpectations: tallyReconciliationExpectations(candidates),
    currencyTotals: tallyCurrencyTotals(candidates),
    candidates,
  }
}

export function buildMembershipMigrationPreviewMarkdown(inputs: MigrationCandidateInput[]): string {
  const report = buildMembershipMigrationPreviewReport(inputs)
  const lines = [
    '# JPV Bootcamp Membership Migration Preview',
    '',
    '## Safety boundary',
    '',
    '- Repository-only classification; no Stripe or database mutation was performed.',
    '- Eligible records still require a live Stripe invoice preview immediately before an approved update.',
    '- Manual-review and ineligible records must not enter an automatic migration batch.',
    '',
    '## Summary',
    '',
    `- Total: \`${report.totals.candidateCount}\``,
    `- Eligible: \`${report.totals.eligibleCount}\``,
    `- Manual review: \`${report.totals.manualReviewCount}\``,
    `- Ineligible: \`${report.totals.ineligibleCount}\``,
    `- Credit total: \`${report.totals.creditTotal.toFixed(2)}\``,
    `- Charge total: \`${report.totals.chargeTotal.toFixed(2)}\``,
    `- Tax total: \`${report.totals.taxTotal.toFixed(2)}\``,
    `- Amount due total: \`${report.totals.amountDueTotal.toFixed(2)}\``,
    '',
    '## Candidates',
    '',
    '| Candidate | Email | Eligibility | Reasons | Amount due | Currency | Warnings |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...report.candidates.map((candidate) =>
      [
        candidate.stableCandidateId,
        candidate.normalizedEmail,
        candidate.eligibility,
        candidate.reasons.join(', ') || 'none',
        candidate.preview?.amountDue?.toFixed(2) ?? 'n/a',
        currencyKey(candidate.preview?.currency),
        candidate.warnings.join(', ') || 'none',
      ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'),
    ),
    '',
    '## Currency totals',
    '',
    '| Currency | Count | Credit | Charge | Tax | Amount due |',
    '| --- | --- | --- | --- | --- | --- |',
    ...Object.entries(report.currencyTotals).map(([currency, bucket]) =>
      [
        currency,
        bucket.candidateCount,
        bucket.creditTotal.toFixed(2),
        bucket.chargeTotal.toFixed(2),
        bucket.taxTotal.toFixed(2),
        bucket.amountDueTotal.toFixed(2),
      ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'),
    ),
    '',
  ]
  return lines.join('\n')
}

export function buildMembershipMigrationPreviewJson(inputs: MigrationCandidateInput[]): string {
  return `${JSON.stringify(buildMembershipMigrationPreviewReport(inputs), null, 2)}\n`
}

export function buildStripeInvoicePreviewRequest(params: {
  candidate: ClassifiedMigrationCandidate
  subscriptionItemId: string
  targetPriceId: string
}): StripeInvoicePreviewRequest {
  if (params.candidate.eligibility !== 'eligible') throw new Error('migration_candidate_not_eligible')
  const customerId = normalizeString(params.candidate.stripeCustomerProjection.customerId)
  const subscriptionId = normalizeString(params.candidate.stripeSubscriptionProjection.subscriptionId)
  const itemId = normalizeString(params.subscriptionItemId)
  const targetPriceId = normalizeString(params.targetPriceId)

  if (!customerId) throw new Error('migration_customer_missing')
  if (!subscriptionId) throw new Error('migration_subscription_missing')
  if (!itemId) throw new Error('migration_subscription_item_missing')
  if (!targetPriceId) throw new Error('migration_target_price_missing')

  return {
    customer: customerId,
    subscription: subscriptionId,
    subscription_details: {
      proration_behavior: 'create_prorations',
      items: [{ id: itemId, price: targetPriceId }],
    },
  }
}
