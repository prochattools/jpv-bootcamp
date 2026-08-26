import assert from 'node:assert/strict'

import {
  buildMembershipMigrationPreviewJson,
  buildMembershipMigrationPreviewMarkdown,
  buildMembershipMigrationPreviewReport,
  classifyMigrationCandidate,
  normalizeMigrationCadence,
  summarizeMigrationCandidates,
  type MigrationCandidateInput,
  type MigrationBlockingReason,
  type MigrationPreviewEvidence,
  type StripeCustomerProjection,
  type StripeSubscriptionProjection,
} from './membershipMigrationPreview'

type MigrationCandidateOverrides = {
  stableCandidateId?: string
  memberId?: string | null
  normalizedEmail?: string
  stripeCustomerProjection?: Partial<StripeCustomerProjection>
  stripeSubscriptionProjection?: Partial<StripeSubscriptionProjection>
  preview?: Partial<MigrationPreviewEvidence> | null
}

function candidate(
  overrides: MigrationCandidateOverrides = {},
): MigrationCandidateInput {
  const previewBase: MigrationPreviewEvidence = {
    invoiceLineCount: 1,
    previewTimestamp: new Date('2026-07-15T12:00:00.000Z'),
    unusedTimeCredit: 0,
    remainingTimeCharge: 80,
    discountAmount: 0,
    taxAmount: 0,
    subtotal: 80,
    amountDue: 80,
    currency: 'gbp',
    nextRenewalDate: new Date('2026-08-01T00:00:00.000Z'),
    expectedTargetPriceId: 'price_target',
    expectedTargetCadence: 'monthly',
    expectedBillingAnchor: '2026-07-01T00:00:00.000Z',
    expectedReconciliationState: 'matched',
    expectedDiscountAmount: 0,
    expectedTaxAmount: 0,
    expectedSubtotal: 80,
    expectedAmountDue: 80,
    expectedTaxBehavior: 'exclusive',
    warningCodes: [],
  }

  return {
    stableCandidateId: overrides.stableCandidateId ?? 'candidate-a',
    memberId: overrides.memberId ?? 'member-a',
    normalizedEmail: overrides.normalizedEmail ?? 'member@example.com',
    stripeCustomerProjection: {
      customerId: 'cus_test',
      memberId: 'member-a',
      normalizedEmail: 'member@example.com',
      ...overrides.stripeCustomerProjection,
    },
    stripeSubscriptionProjection: {
      subscriptionId: 'sub_test',
      itemId: 'si_test',
      currentProductId: 'prod_current',
      currentPriceId: 'price_current',
      targetProductId: 'prod_target',
      targetPriceId: 'price_target',
      currentCadence: 'monthly',
      targetCadence: 'monthly',
      currentPeriodStart: new Date('2026-07-01T00:00:00.000Z'),
      currentPeriodEnd: new Date('2026-08-01T00:00:00.000Z'),
      billingCycleAnchor: '2026-07-01T00:00:00.000Z',
      cancelAtPeriodEnd: false,
      status: 'active',
      paymentStatus: 'paid',
      disputeStatus: null,
      scheduleState: null,
      itemCount: 1,
      meteredState: false,
      activeDiscountLabel: null,
      activeDiscountAmount: 0,
      taxBehavior: 'exclusive',
      currentAmount: 80,
      targetAmount: 80,
      reconciliationState: 'matched',
      ...overrides.stripeSubscriptionProjection,
    },
    preview: overrides.preview === null ? null : { ...previewBase, ...overrides.preview },
  }
}

function assertReason(candidate: MigrationCandidateInput, reason: MigrationBlockingReason, eligibility: 'eligible' | 'manual_review' | 'ineligible' = 'manual_review') {
  const classified = classifyMigrationCandidate(candidate)
  assert.equal(classified.eligibility, eligibility)
  assert.ok(classified.reasons.includes(reason), `expected ${reason}`)
}

function main() {
  assert.equal(normalizeMigrationCadence('monthly'), 'monthly')
  assert.equal(normalizeMigrationCadence('ANNUAL'), 'annual')
  assert.equal(normalizeMigrationCadence('weekly'), null)

  const monthly = classifyMigrationCandidate(candidate())
  assert.equal(monthly.eligibility, 'eligible')
  assert.deepEqual(monthly.reasons, [])
  assert.deepEqual(monthly.warnings, [])

  const annual = classifyMigrationCandidate(
    candidate({
      stableCandidateId: 'candidate-b',
      normalizedEmail: 'annual@example.com',
      stripeSubscriptionProjection: {
        currentCadence: 'annual',
        targetCadence: 'annual',
        currentPeriodEnd: new Date('2027-07-01T00:00:00.000Z'),
        billingCycleAnchor: '2026-07-01T00:00:00.000Z',
        targetPriceId: 'price_target_annual',
        currentPriceId: 'price_current_annual',
        currentProductId: 'prod_current_annual',
        targetProductId: 'prod_target_annual',
        currentAmount: 800,
        targetAmount: 800,
      },
      preview: {
        currency: 'GBP',
        amountDue: 800,
        nextRenewalDate: new Date('2027-07-01T00:00:00.000Z'),
        expectedTargetPriceId: 'price_target_annual',
        expectedTargetCadence: 'annual',
        expectedBillingAnchor: '2026-07-01T00:00:00.000Z',
        expectedReconciliationState: 'matched',
        expectedAmountDue: 800,
        warningCodes: [],
      },
    }),
  )
  assert.equal(annual.eligibility, 'eligible')

  const samePrice = classifyMigrationCandidate(
    candidate({
      stripeSubscriptionProjection: {
        currentPriceId: 'price_same',
        targetPriceId: 'price_same',
        currentAmount: 0,
        targetAmount: 0,
      },
      preview: {
        amountDue: 0,
        subtotal: 0,
        remainingTimeCharge: 0,
        unusedTimeCredit: 0,
        expectedTargetPriceId: 'price_same',
        expectedAmountDue: 0,
        expectedSubtotal: 0,
        warningCodes: [],
      },
    }),
  )
  assert.equal(samePrice.eligibility, 'eligible')
  assert.ok(samePrice.warnings.includes('same_price_candidate'))

  assertReason(
    candidate({
      stripeCustomerProjection: {
        customerId: null,
      },
    }),
    'missing_customer',
    'ineligible',
  )

  assertReason(
    candidate({
      stripeSubscriptionProjection: {
        currentCadence: 'weekly',
      },
    }),
    'unsupported_cadence',
  )

  assertReason(
    candidate({
      stripeSubscriptionProjection: {
        status: 'past_due',
      },
    }),
    'past_due',
  )
  assertReason(
    candidate({
      stripeSubscriptionProjection: {
        status: 'unpaid',
      },
    }),
    'unpaid',
  )
  assertReason(
    candidate({
      stripeSubscriptionProjection: {
        status: 'incomplete',
      },
    }),
    'incomplete',
  )
  assertReason(
    candidate({
      stripeSubscriptionProjection: {
        status: 'paused',
      },
    }),
    'paused',
  )
  assertReason(
    candidate({
      stripeSubscriptionProjection: {
        paymentStatus: 'disputed',
      },
    }),
    'disputed',
  )
  assertReason(
    candidate({
      stripeSubscriptionProjection: {
        cancelAtPeriodEnd: true,
      },
    }),
    'cancellation_pending',
  )
  assertReason(
    candidate({
      stripeSubscriptionProjection: {
        scheduleState: 'scheduled',
      },
    }),
    'schedule_present',
  )
  assertReason(
    candidate({
      stripeSubscriptionProjection: {
        itemCount: 2,
      },
    }),
    'multiple_items',
  )
  assertReason(
    candidate({
      stripeSubscriptionProjection: {
        meteredState: true,
      },
    }),
    'metered',
  )
  assertReason(
    candidate({
      preview: null,
    }),
    'preview_missing',
  )
  assertReason(
    candidate({
      stripeSubscriptionProjection: {
        targetPriceId: 'price_other',
      },
      preview: {
        expectedTargetPriceId: 'price_target',
      },
    }),
    'price_mismatch',
  )
  assertReason(
    candidate({
      preview: {
        expectedTargetCadence: 'annual',
      },
    }),
    'cadence_mismatch',
  )
  assertReason(
    candidate({
      stripeSubscriptionProjection: {
        billingCycleAnchor: '2026-07-02T00:00:00.000Z',
      },
      preview: {
        expectedBillingAnchor: '2026-07-01T00:00:00.000Z',
      },
    }),
    'billing_anchor_mismatch',
  )
  assertReason(
    candidate({
      stripeSubscriptionProjection: {
        currentPeriodEnd: new Date('2026-08-02T00:00:00.000Z'),
      },
      preview: {
        nextRenewalDate: new Date('2026-08-01T00:00:00.000Z'),
      },
    }),
    'next_renewal_mismatch',
  )
  assertReason(
    candidate({
      stripeSubscriptionProjection: {
        activeDiscountAmount: 10,
      },
      preview: {
        expectedDiscountAmount: 0,
      },
    }),
    'discount_mismatch',
  )
  assertReason(
    candidate({
      preview: {
        taxAmount: 1,
        expectedTaxAmount: 2,
      },
    }),
    'tax_mismatch',
  )
  assertReason(
    candidate({
      preview: {
        amountDue: 0,
        subtotal: 0,
        expectedAmountDue: 0,
        expectedSubtotal: 0,
      },
    }),
    'zero_amount',
  )
  assertReason(
    candidate({
      preview: {
        amountDue: -20,
        unusedTimeCredit: 30,
        remainingTimeCharge: 10,
      },
    }),
    'net_credit',
  )
  assertReason(
    candidate({
      preview: {
        amountDue: -5,
        unusedTimeCredit: 2,
        remainingTimeCharge: 10,
      },
    }),
    'unexpected_negative_amount',
  )
  assertReason(
    candidate({
      stripeSubscriptionProjection: {
        reconciliationState: 'mismatch',
      },
      preview: {
        expectedReconciliationState: 'matched',
      },
    }),
    'reconciliation_mismatch',
  )

  const report = buildMembershipMigrationPreviewReport([
    candidate({ stableCandidateId: 'zeta', normalizedEmail: 'zeta@example.com' }),
    candidate({
      stableCandidateId: 'alpha',
      normalizedEmail: 'alpha@example.com',
      preview: {
        currency: 'usd',
        amountDue: 10,
        remainingTimeCharge: 10,
        unusedTimeCredit: 0,
        expectedAmountDue: 10,
      },
    }),
    candidate({
      stableCandidateId: 'beta',
      normalizedEmail: 'beta@example.com',
      stripeCustomerProjection: { customerId: null },
      preview: null,
    }),
  ])

  assert.equal(report.totals.candidateCount, 3)
  assert.equal(report.totals.eligibleCount, 2)
  assert.equal(report.totals.manualReviewCount, 0)
  assert.equal(report.totals.ineligibleCount, 1)
  assert.equal(report.reasonCounts.missing_customer, 1)
  assert.equal(report.reconciliationExpectations.matched, 2)
  assert.equal(report.currencyTotals.GBP.candidateCount, 1)
  assert.equal(report.currencyTotals.USD.candidateCount, 1)
  assert.equal(report.currencyTotals.UNKNOWN.candidateCount, 1)
  assert.deepEqual(report.candidates.map((entry) => entry.stableCandidateId), ['alpha', 'beta', 'zeta'])

  const markdown = buildMembershipMigrationPreviewMarkdown([candidate()])
  assert.match(markdown, /# JPV Bootcamp Membership Migration Preview/)
  assert.match(markdown, /Credit total/)

  const json = buildMembershipMigrationPreviewJson([candidate()])
  const parsed = JSON.parse(json) as ReturnType<typeof buildMembershipMigrationPreviewReport>
  assert.equal(parsed.totals.candidateCount, 1)
  assert.equal(parsed.candidates[0].stableCandidateId, 'candidate-a')

  assert.deepEqual(summarizeMigrationCandidates([monthly, annual, samePrice]), {
    candidateCount: 3,
    eligibleCount: 3,
    manualReviewCount: 0,
    ineligibleCount: 0,
  })

  console.log('membership migration preview tests passed')
}

main()
