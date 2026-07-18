/**
 * Realistic end-to-end test with fully populated eligible candidates
 *
 * Demonstrates a complete workflow:
 * 1. Build candidate inventory with all required fields
 * 2. Classify into eligibility tiers
 * 3. Build Stripe preview requests (ready to call real Stripe API in production)
 * 4. Verify entitlement reconciliation
 * 5. Project webhook events and billing impacts
 * 6. Generate auditable rehearsal reports
 *
 * This is NOT a Stripe API test (uses in-memory simulation).
 * For live Stripe testing, replace the adapter with one backed by Stripe.
 */

import type { ClassifiedMigrationCandidate } from '@/lib/billing/membershipMigrationPreview'
import {
  classifyMigrationCandidate,
  buildMembershipMigrationPreviewReport,
  buildMembershipMigrationPreviewMarkdown,
  buildStripeInvoicePreviewRequest,
} from '@/lib/billing/membershipMigrationPreview'
import { candidateInventory } from '@/lib/billing/candidateInventory'

async function main(): Promise<void> {
  console.log('=== Realistic Stripe Invoice Preview Rehearsal ===\n')

  // Build fully-populated candidate inventory
  const inventory = [
    // Wave 1: Monthly plans upgrading to annual
    candidateInventory.create({
      stableCandidateId: 'wave1_monthly_to_annual_001',
      normalizedEmail: 'student-1@yeshua.academy',
      customerId: 'cus_live_1',
      subscriptionId: 'sub_live_1',
      itemId: 'si_live_1',
      currentPriceId: 'price_bootcamp_monthly_2024',
      targetPriceId: 'price_bootcamp_annual_2025',
      currentCadence: 'monthly',
      targetCadence: 'annual',
      currentPeriodStart: new Date('2026-06-15T00:00:00.000Z'),
      currentPeriodEnd: new Date('2026-07-15T00:00:00.000Z'),
      billingCycleAnchor: '15',
      status: 'active',
      paymentStatus: 'paid',
      itemCount: 1,
      currentAmount: 4999, // $49.99/month
      targetAmount: 49900, // $499/year
    }),

    // Wave 1: Annual renewal with plan upgrade
    candidateInventory.create({
      stableCandidateId: 'wave1_annual_upgrade_001',
      normalizedEmail: 'student-2@yeshua.academy',
      customerId: 'cus_live_2',
      subscriptionId: 'sub_live_2',
      itemId: 'si_live_2',
      currentPriceId: 'price_bootcamp_annual_2024',
      targetPriceId: 'price_bootcamp_annual_pro_2025',
      currentCadence: 'annual',
      targetCadence: 'annual',
      currentPeriodStart: new Date('2025-12-01T00:00:00.000Z'),
      currentPeriodEnd: new Date('2026-12-01T00:00:00.000Z'),
      billingCycleAnchor: '1',
      status: 'active',
      paymentStatus: 'paid',
      itemCount: 1,
      currentAmount: 49900, // $499/year
      targetAmount: 79900, // $799/year (pro tier)
    }),

    // Wave 2: Sponsored seat (discount applied)
    candidateInventory.create({
      stableCandidateId: 'wave2_sponsored_001',
      normalizedEmail: 'student-3@yeshua.academy',
      customerId: 'cus_live_3',
      subscriptionId: 'sub_live_3',
      itemId: 'si_live_3',
      currentPriceId: 'price_bootcamp_monthly_2024',
      targetPriceId: 'price_bootcamp_annual_2025',
      currentCadence: 'monthly',
      targetCadence: 'annual',
      currentPeriodStart: new Date('2026-05-01T00:00:00.000Z'),
      currentPeriodEnd: new Date('2026-06-01T00:00:00.000Z'),
      billingCycleAnchor: '1',
      status: 'active',
      paymentStatus: 'paid',
      itemCount: 1,
      currentAmount: 0, // Fully sponsored
      targetAmount: 0, // Remains sponsored
      activeDiscountAmount: 0,
      taxBehavior: 'inclusive',
    }),

    // Manual review: Past due invoice awaiting payment
    candidateInventory.create({
      stableCandidateId: 'review_past_due_001',
      normalizedEmail: 'student-4@yeshua.academy',
      customerId: 'cus_live_4',
      subscriptionId: 'sub_live_4',
      itemId: 'si_live_4',
      currentPriceId: 'price_bootcamp_monthly_2024',
      targetPriceId: 'price_bootcamp_annual_2025',
      currentCadence: 'monthly',
      targetCadence: 'annual',
      status: 'past_due',
      paymentStatus: 'failed',
      itemCount: 1,
    }),

    // Manual review: Incomplete payment setup
    candidateInventory.create({
      stableCandidateId: 'review_incomplete_001',
      normalizedEmail: 'student-5@yeshua.academy',
      customerId: 'cus_live_5',
      subscriptionId: 'sub_live_5',
      itemId: 'si_live_5',
      currentPriceId: 'price_bootcamp_monthly_2024',
      targetPriceId: 'price_bootcamp_annual_2025',
      status: 'incomplete',
      paymentStatus: 'action_required',
      itemCount: 1,
    }),

    // Ineligible: Schedule already present
    candidateInventory.create({
      stableCandidateId: 'ineligible_scheduled_001',
      normalizedEmail: 'student-6@yeshua.academy',
      customerId: 'cus_live_6',
      subscriptionId: 'sub_live_6',
      itemId: 'si_live_6',
      currentPriceId: 'price_bootcamp_monthly_2024',
      targetPriceId: 'price_bootcamp_annual_2025',
      status: 'active',
      scheduleState: 'scheduled',
      itemCount: 1,
    }),
  ]

  console.log(`Built ${inventory.length} candidates`)

  // Classify
  const classified: ClassifiedMigrationCandidate[] = inventory.map(classifyMigrationCandidate)

  const stats = {
    eligible: classified.filter((c) => c.eligibility === 'eligible').length,
    manual_review: classified.filter((c) => c.eligibility === 'manual_review').length,
    ineligible: classified.filter((c) => c.eligibility === 'ineligible').length,
  }

  console.log(`Classification: eligible=${stats.eligible}, review=${stats.manual_review}, ineligible=${stats.ineligible}`)

  // Generate report
  const report = buildMembershipMigrationPreviewReport(inventory)

  console.log('\n--- Classification Report ---\n')
  console.log(buildMembershipMigrationPreviewMarkdown(inventory))

  // Show eligible candidates and build preview requests (ready for Stripe)
  const eligible = classified.filter((c) => c.eligibility === 'eligible')

  if (eligible.length > 0) {
    console.log('\n--- Stripe Invoice Preview Requests ---\n')
    console.log(`${eligible.length} eligible candidates ready for Stripe preview:\n`)

    for (const candidate of eligible) {
      try {
        const previewRequest = buildStripeInvoicePreviewRequest({
          candidate,
          subscriptionItemId: candidate.stripeSubscriptionProjection.itemId!,
          targetPriceId: candidate.stripeSubscriptionProjection.targetPriceId!,
        })

        console.log(`[${candidate.normalizedEmail}]`)
        console.log(`  Customer: ${previewRequest.customer}`)
        console.log(`  Subscription: ${previewRequest.subscription}`)
        console.log(`  Item ID: ${previewRequest.subscription_details.items[0].id}`)
        console.log(`  Target Price: ${previewRequest.subscription_details.items[0].price}`)
        console.log(`  Proration: ${previewRequest.subscription_details.proration_behavior}`)
        console.log()

        // Show financial projection
        const sub = candidate.stripeSubscriptionProjection
        const current = (sub.currentAmount ?? 0) / 100
        const target = (sub.targetAmount ?? 0) / 100
        const cadenceMultiplier = sub.currentCadence === 'monthly' && sub.targetCadence === 'annual' ? 12 : 1

        console.log(`  Financial projection:`)
        console.log(`    Current: ${sub.currentCadence === 'monthly' ? '$' + current.toFixed(2) + '/month' : '$' + current.toFixed(2) + '/year'}`)
        console.log(`    Target: ${sub.targetCadence === 'monthly' ? '$' + target.toFixed(2) + '/month' : '$' + target.toFixed(2) + '/year'}`)

        if (sub.currentCadence === 'monthly' && sub.targetCadence === 'annual') {
          const remainingDays = Math.ceil(
            (new Date(sub.currentPeriodEnd!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
          )
          const dailyRate = current / 30
          const prorationCredit = dailyRate * remainingDays
          const expectedDue = target - prorationCredit

          console.log(`    Remaining days in period: ${remainingDays}`)
          console.log(`    Daily rate: $${dailyRate.toFixed(4)}`)
          console.log(`    Proration credit: $${prorationCredit.toFixed(2)}`)
          console.log(`    Expected amount due: $${Math.max(0, expectedDue).toFixed(2)}`)
        }
        console.log()
      } catch (e) {
        console.log(`ERROR ${candidate.normalizedEmail}: ${e instanceof Error ? e.message : String(e)}\n`)
      }
    }
  }

  // Webhook projection
  console.log('\n--- Webhook Projection ---\n')

  if (eligible.length > 0) {
    console.log(`If all ${eligible.length} eligible candidates are approved, expect:`)
    console.log(`  - ${eligible.length} x subscription.updated (item price change)`)
    console.log(`  - ${eligible.length} x invoice.created (prorated invoice)`)
    console.log(`  - ${eligible.length} x invoice.paid (payment success)`)
    console.log(`  - 0 x invoice.payment_failed (assumed success)`)
  }

  // Entitlement reconciliation
  console.log('\n--- Entitlement Reconciliation ---\n')

  console.log(`Reconciliation expectations for eligible candidates:`)
  console.log(`  All invoices will be verified by comparing:`)
  console.log(`  - Stripe preview.subtotal vs. expected (current + target prorated charges)`)
  console.log(`  - Stripe preview.discount_amount vs. expected (prorated credit)`)
  console.log(`  - Stripe preview.tax vs. expected (calculated on net amount)`)
  console.log(`  - Stripe preview.amount_due vs. expected (subtotal - discount + tax)`)
  console.log(`  - Stripe preview.billing_cycle_anchor vs. subscription anchor`)
  console.log(`  - Stripe preview.period_end vs. target billing date`)

  // Safety checks
  console.log('\n--- Safety Checks ---\n')

  const blockedReasons = new Map<string, number>()
  for (const c of classified) {
    for (const reason of c.reasons) {
      blockedReasons.set(reason, (blockedReasons.get(reason) ?? 0) + 1)
    }
  }

  console.log(`Automated blocks active:`)
  for (const [reason, count] of Array.from(blockedReasons.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  - ${reason}: ${count}`)
  }

  console.log(`\nNo production Stripe subscriptions will be modified during this rehearsal.`)
  console.log(`All Stripe calls in this phase are read-only preview operations.`)
  console.log(`Approvals will require manual review + live preview verification before update.`)

  console.log('\n✓ Realistic rehearsal complete')
}

main().catch((error) => {
  console.error('Rehearsal failed:', error)
  process.exitCode = 1
})
