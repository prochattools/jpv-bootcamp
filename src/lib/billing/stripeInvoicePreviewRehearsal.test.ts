import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type {
  MigrationCandidateInput,
  ClassifiedMigrationCandidate,
} from '@/lib/billing/membershipMigrationPreview'
import {
  classifyMigrationCandidate,
  buildMembershipMigrationPreviewReport,
} from '@/lib/billing/membershipMigrationPreview'
import { candidateInventory } from '@/lib/billing/candidateInventory'
import {
  rehearseStripeInvoicePreviewsForCohort,
  buildRehearseReportMarkdown,
} from '@/lib/billing/stripeInvoicePreviewRehearsal'
import {
  InMemoryMembershipSupportStripeAdapter,
  type MembershipSupportStripeAdapter,
} from '@/lib/membership-support/stripeAdapter'

async function main(): Promise<void> {
  const fixtureFile = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../../docs/client/fixtures/MEMBERSHIP_MIGRATION_PREVIEW_FIXTURE.json',
  )

  console.log('Reading fixture...')
  const fixtureText = fs.readFileSync(fixtureFile, 'utf-8')
  const fixtureData = JSON.parse(fixtureText) as unknown[]

  console.log(`Loaded ${fixtureData.length} fixtures`)

  // Build candidate inventory
  console.log('Building candidate inventory...')
  const candidates = candidateInventory.fromFixture(fixtureData)

  console.log(`Built ${candidates.length} candidates:`)
  for (const candidate of candidates) {
    console.log(
      `  - ${candidate.normalizedEmail} (customer: ${candidate.stripeCustomerProjection.customerId ?? 'MISSING'})`,
    )
  }

  // Classify candidates
  console.log('Classifying candidates...')
  const classified: ClassifiedMigrationCandidate[] = candidates.map(classifyMigrationCandidate)

  const summary = classified.reduce(
    (acc, c) => ({
      ...acc,
      [c.eligibility]: acc[c.eligibility] + 1,
    }),
    { eligible: 0, manual_review: 0, ineligible: 0 },
  )

  console.log(`Classification summary:`)
  console.log(`  - Eligible: ${summary.eligible}`)
  console.log(`  - Manual review: ${summary.manual_review}`)
  console.log(`  - Ineligible: ${summary.ineligible}`)

  // Generate classification report
  const report = buildMembershipMigrationPreviewReport(candidates)
  console.log('Classification report generated')
  console.log(`  - Total candidates: ${report.totals.candidateCount}`)
  console.log(`  - Blocking reasons: ${Object.entries(report.reasonCounts).filter(([, count]) => count > 0).length}`)

  // Display candidates with blocking reasons
  console.log('\nEligible candidates:')
  const eligibleCandidates = classified.filter((c) => c.eligibility === 'eligible')
  if (eligibleCandidates.length === 0) {
    console.log('  (none)')
  } else {
    for (const candidate of eligibleCandidates) {
      console.log(`  - ${candidate.normalizedEmail}`)
    }
  }

  console.log('\nManual review candidates:')
  const reviewCandidates = classified.filter((c) => c.eligibility === 'manual_review')
  if (reviewCandidates.length === 0) {
    console.log('  (none)')
  } else {
    for (const candidate of reviewCandidates) {
      console.log(`  - ${candidate.normalizedEmail}: ${candidate.reasons.join(', ')}`)
    }
  }

  console.log('\nIneligible candidates:')
  const ineligibleCandidates = classified.filter((c) => c.eligibility === 'ineligible')
  if (ineligibleCandidates.length === 0) {
    console.log('  (none)')
  } else {
    for (const candidate of ineligibleCandidates) {
      console.log(`  - ${candidate.normalizedEmail}: ${candidate.reasons.join(', ')}`)
    }
  }

  // Test in-memory Stripe adapter preview
  console.log('\n\nTesting in-memory Stripe adapter preview for eligible candidates...')
  const adapter = new InMemoryMembershipSupportStripeAdapter()

  // Seed subscriptions
  for (const candidate of eligibleCandidates) {
    const subId = candidate.stripeSubscriptionProjection.subscriptionId
    const custId = candidate.stripeCustomerProjection.customerId
    if (subId && custId) {
      adapter.seedSubscription({
        id: subId,
        customerId: custId,
        priceId: candidate.stripeSubscriptionProjection.currentPriceId ?? 'price_test',
        status: 'active',
      })
    }
  }

  // Simulate in-memory preview (mock)
  for (const candidate of eligibleCandidates) {
    const subId = candidate.stripeSubscriptionProjection.subscriptionId
    const custId = candidate.stripeCustomerProjection.customerId
    const itemId = candidate.stripeSubscriptionProjection.itemId
    const targetPriceId = 'price_test_target'

    if (!subId || !custId || !itemId) {
      console.log(`  SKIP ${candidate.normalizedEmail}: missing required IDs`)
      continue
    }

    try {
      const preview = await adapter.previewInvoice({
        customer: custId,
        subscription: subId,
        subscription_details: {
          proration_behavior: 'create_prorations',
          items: [{ id: itemId, price: targetPriceId }],
        },
      })

      console.log(
        `  OK ${candidate.normalizedEmail}: ${preview.amountDue / 100} ${preview.currency.toUpperCase()} (${preview.lines} lines)`,
      )
    } catch (e) {
      console.log(`  ERROR ${candidate.normalizedEmail}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  console.log('\n✓ Candidate inventory rehearsal complete')
}

main().catch((error) => {
  console.error('Test failed:', error)
  process.exitCode = 1
})
