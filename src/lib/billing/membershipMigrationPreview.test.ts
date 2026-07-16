import assert from 'node:assert/strict'

import {
  buildStripeInvoicePreviewRequest,
  classifyMigrationCandidate,
  normalizeMigrationCadence,
  summarizeMigrationCandidates,
  type MigrationCandidateInput,
} from './membershipMigrationPreview'

const base: MigrationCandidateInput = {
  normalizedEmail: 'member@example.com',
  stripeCustomerId: 'cus_test',
  stripeSubscriptionId: 'sub_test',
  stripePriceId: 'price_old',
  subscriptionStatus: 'active',
  subscriptionCurrentPeriodEnd: new Date('2026-08-01T00:00:00.000Z'),
  subscriptionCancelAtPeriodEnd: false,
  billingCadence: 'monthly',
  paymentStatus: 'paid',
  paymentDisputeStatus: null,
  stripeScheduleId: null,
  subscriptionItemCount: 1,
  isMetered: false,
}

function main() {
  assert.equal(normalizeMigrationCadence('monthly'), 'monthly')
  assert.equal(normalizeMigrationCadence('ANNUAL'), 'annual')
  assert.equal(normalizeMigrationCadence('yearly'), 'annual')
  assert.equal(normalizeMigrationCadence('weekly'), null)

  const eligible = classifyMigrationCandidate(base)
  assert.equal(eligible.eligibility, 'eligible')
  assert.deepEqual(eligible.reasons, [])
  assert.equal(eligible.targetCadence, 'monthly')

  const review = classifyMigrationCandidate({
    ...base,
    subscriptionStatus: 'past_due',
    paymentStatus: 'failed',
  })
  assert.equal(review.eligibility, 'manual_review')
  assert.ok(review.reasons.includes('subscription_past_due'))
  assert.ok(review.reasons.includes('payment_failed'))

  const complex = classifyMigrationCandidate({
    ...base,
    stripeScheduleId: 'sub_sched_test',
    subscriptionItemCount: 2,
    isMetered: true,
  })
  assert.equal(complex.eligibility, 'manual_review')
  assert.ok(complex.reasons.includes('subscription_schedule_present'))
  assert.ok(complex.reasons.includes('multi_item_subscription'))
  assert.ok(complex.reasons.includes('metered_subscription'))

  const ineligible = classifyMigrationCandidate({
    ...base,
    stripeCustomerId: null,
  })
  assert.equal(ineligible.eligibility, 'ineligible')
  assert.ok(ineligible.reasons.includes('missing_stripe_customer'))

  const preview = buildStripeInvoicePreviewRequest({
    candidate: eligible,
    subscriptionItemId: 'si_test',
    targetPriceId: 'price_new',
  })
  assert.deepEqual(preview, {
    customer: 'cus_test',
    subscription: 'sub_test',
    subscription_details: {
      proration_behavior: 'create_prorations',
      items: [{ id: 'si_test', price: 'price_new' }],
    },
  })

  assert.throws(
    () =>
      buildStripeInvoicePreviewRequest({
        candidate: review,
        subscriptionItemId: 'si_test',
        targetPriceId: 'price_new',
      }),
    /migration_candidate_not_eligible/,
  )

  assert.deepEqual(summarizeMigrationCandidates([eligible, review, ineligible]), {
    total: 3,
    eligible: 1,
    manual_review: 1,
    ineligible: 1,
  })

  console.log('membership migration preview tests passed')
}

main()
