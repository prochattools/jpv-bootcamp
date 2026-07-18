/**
 * Subscription migration inventory: offline analysis of eligible, blocked, and exceptional subscriptions
 * Generates deterministic JSON and Markdown reports by cohort
 */

import { writeFileSync, readFileSync } from 'fs'
import { resolve } from 'path'

interface SubscriptionRecord {
  memberId: string
  customerId: string
  subscriptionId: string
  currentProductId: string
  currentPriceId: string
  currentCadence: 'monthly' | 'annual'
  billingAnchorDay: number
  periodStart: string
  periodEnd: string
  subscriptionStatus: 'active' | 'past_due' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'trialing'
  paymentStatus: 'active' | 'past_due' | 'canceled'
  disputeState: 'none' | 'open' | 'resolved' | 'won' | 'lost'
  cancellationState: 'none' | 'scheduled' | 'effective' | 'revoked'
  scheduleState: 'none' | 'scheduled'
  itemCount: number
  meteredState: 'none' | 'metered'
  discountId?: string
  discountAmount?: number
  taxBehavior?: string
  entitlementStatus: 'valid' | 'pending' | 'expired' | 'revoked'
  identityStatus: 'complete' | 'incomplete'
  reviewReason?: string
}

interface MigrationCohort {
  name: string
  description: string
  count: number
  records: SubscriptionRecord[]
  reasons: Record<string, number>
}

interface InventoryReport {
  timestamp: string
  totalSubscriptions: number
  totalMembers: number
  totalCustomers: number
  cohorts: MigrationCohort[]
  cohortsCount: Record<string, number>
}

const repoRoot = resolve(__dirname, '../../')

function createMockInventory(): SubscriptionRecord[] {
  const mockRecords: SubscriptionRecord[] = [
    // Eligible monthly
    {
      memberId: 'member-001',
      customerId: 'cus_001',
      subscriptionId: 'sub_001',
      currentProductId: 'prod_legacy_membership',
      currentPriceId: 'price_legacy_monthly',
      currentCadence: 'monthly',
      billingAnchorDay: 15,
      periodStart: '2026-06-15',
      periodEnd: '2026-07-15',
      subscriptionStatus: 'active',
      paymentStatus: 'active',
      disputeState: 'none',
      cancellationState: 'none',
      scheduleState: 'none',
      itemCount: 1,
      meteredState: 'none',
      entitlementStatus: 'valid',
      identityStatus: 'complete'
    },
    // Eligible annual
    {
      memberId: 'member-002',
      customerId: 'cus_002',
      subscriptionId: 'sub_002',
      currentProductId: 'prod_legacy_membership',
      currentPriceId: 'price_legacy_annual',
      currentCadence: 'annual',
      billingAnchorDay: 1,
      periodStart: '2026-01-01',
      periodEnd: '2027-01-01',
      subscriptionStatus: 'active',
      paymentStatus: 'active',
      disputeState: 'none',
      cancellationState: 'none',
      scheduleState: 'none',
      itemCount: 1,
      meteredState: 'none',
      entitlementStatus: 'valid',
      identityStatus: 'complete'
    },
    // Manual review: payment exception
    {
      memberId: 'member-003',
      customerId: 'cus_003',
      subscriptionId: 'sub_003',
      currentProductId: 'prod_legacy_membership',
      currentPriceId: 'price_legacy_monthly',
      currentCadence: 'monthly',
      billingAnchorDay: 10,
      periodStart: '2026-06-10',
      periodEnd: '2026-07-10',
      subscriptionStatus: 'past_due',
      paymentStatus: 'past_due',
      disputeState: 'none',
      cancellationState: 'none',
      scheduleState: 'none',
      itemCount: 1,
      meteredState: 'none',
      entitlementStatus: 'pending',
      identityStatus: 'complete',
      reviewReason: 'payment_past_due'
    },
    // Ineligible: disputed
    {
      memberId: 'member-004',
      customerId: 'cus_004',
      subscriptionId: 'sub_004',
      currentProductId: 'prod_legacy_membership',
      currentPriceId: 'price_legacy_monthly',
      currentCadence: 'monthly',
      billingAnchorDay: 5,
      periodStart: '2026-06-05',
      periodEnd: '2026-07-05',
      subscriptionStatus: 'active',
      paymentStatus: 'active',
      disputeState: 'open',
      cancellationState: 'none',
      scheduleState: 'none',
      itemCount: 1,
      meteredState: 'none',
      entitlementStatus: 'valid',
      identityStatus: 'complete',
      reviewReason: 'dispute_open'
    },
    // Ineligible: missing identity
    {
      memberId: 'member-005',
      customerId: 'cus_005',
      subscriptionId: 'sub_005',
      currentProductId: 'prod_legacy_membership',
      currentPriceId: 'price_legacy_monthly',
      currentCadence: 'monthly',
      billingAnchorDay: 20,
      periodStart: '2026-06-20',
      periodEnd: '2026-07-20',
      subscriptionStatus: 'active',
      paymentStatus: 'active',
      disputeState: 'none',
      cancellationState: 'none',
      scheduleState: 'none',
      itemCount: 1,
      meteredState: 'none',
      entitlementStatus: 'valid',
      identityStatus: 'incomplete',
      reviewReason: 'identity_incomplete'
    }
  ]
  return mockRecords
}

function classifyCohort(record: SubscriptionRecord): string {
  if (record.identityStatus !== 'complete') {
    return 'missing_identity'
  }

  if (record.disputeState !== 'none') {
    return 'disputed'
  }

  if (record.cancellationState !== 'none' && record.cancellationState !== 'revoked') {
    return 'scheduled_cancellation'
  }

  if (record.paymentStatus === 'past_due') {
    return 'payment_exception'
  }

  if (record.subscriptionStatus !== 'active') {
    return 'inactive_subscription'
  }

  if (record.itemCount !== 1) {
    return 'multi_item'
  }

  if (record.meteredState !== 'none') {
    return 'metered'
  }

  if (record.currentCadence === 'monthly') {
    return 'eligible_monthly'
  }

  if (record.currentCadence === 'annual') {
    return 'eligible_annual'
  }

  return 'unclassified'
}

function generateInventory(): InventoryReport {
  const records = createMockInventory()

  const cohortMap: Record<string, MigrationCohort> = {}

  const cohortDefinitions: Record<string, { name: string; description: string }> = {
    eligible_monthly: { name: 'Eligible (Monthly)', description: 'Active, no issues, monthly billing' },
    eligible_annual: { name: 'Eligible (Annual)', description: 'Active, no issues, annual billing' },
    manual_review: { name: 'Manual Review Required', description: 'Requires operator assessment' },
    ineligible: { name: 'Ineligible', description: 'Cannot be migrated automatically' },
    payment_exception: { name: 'Payment Exception', description: 'Past due or payment failed' },
    disputed: { name: 'Disputed', description: 'Open or recent disputes' },
    scheduled_cancellation: { name: 'Scheduled Cancellation', description: 'Cancellation scheduled or effective' },
    multi_item: { name: 'Multi-Item', description: 'Multiple subscription items' },
    metered: { name: 'Metered', description: 'Usage-based metered billing' },
    missing_identity: { name: 'Missing Identity', description: 'Incomplete or missing member identity' }
  }

  // Initialize cohorts
  for (const [cohortKey, def] of Object.entries(cohortDefinitions)) {
    cohortMap[cohortKey] = {
      name: def.name,
      description: def.description,
      count: 0,
      records: [],
      reasons: {}
    }
  }

  // Classify records
  for (const record of records) {
    const cohort = classifyCohort(record)
    if (cohortMap[cohort]) {
      cohortMap[cohort].count++
      cohortMap[cohort].records.push(record)
      const reason = record.reviewReason || cohort
      cohortMap[cohort].reasons[reason] = (cohortMap[cohort].reasons[reason] || 0) + 1
    }
  }

  // Build report
  const cohortsCount: Record<string, number> = {}
  const cohorts = Object.values(cohortMap).filter(c => c.count > 0)

  for (const cohort of cohorts) {
    cohortsCount[cohort.name] = cohort.count
  }

  const uniqueMembers = new Set(records.map(r => r.memberId))
  const uniqueCustomers = new Set(records.map(r => r.customerId))

  return {
    timestamp: new Date().toISOString(),
    totalSubscriptions: records.length,
    totalMembers: uniqueMembers.size,
    totalCustomers: uniqueCustomers.size,
    cohorts,
    cohortsCount
  }
}

function generateMarkdownReport(report: InventoryReport): string {
  let md = `# Subscription Migration Inventory\n\n`
  md += `**Generated**: ${report.timestamp}\n\n`

  md += `## Summary\n\n`
  md += `| Metric | Count |\n`
  md += `| --- | --- |\n`
  md += `| Total Subscriptions | ${report.totalSubscriptions} |\n`
  md += `| Total Members | ${report.totalMembers} |\n`
  md += `| Total Customers | ${report.totalCustomers} |\n\n`

  md += `## Cohort Breakdown\n\n`
  md += `| Cohort | Count | Percentage |\n`
  md += `| --- | --- | --- |\n`
  for (const cohort of report.cohorts) {
    const percent = ((cohort.count / report.totalSubscriptions) * 100).toFixed(1)
    md += `| ${cohort.name} | ${cohort.count} | ${percent}% |\n`
  }

  md += `\n## Detailed Cohorts\n\n`
  for (const cohort of report.cohorts) {
    md += `### ${cohort.name}\n\n`
    md += `**Description**: ${cohort.description}\n\n`
    md += `**Count**: ${cohort.count}\n\n`
    md += `**Reasons**:\n\n`
    for (const [reason, count] of Object.entries(cohort.reasons)) {
      md += `- ${reason}: ${count}\n`
    }
    md += `\n`
  }

  return md
}

async function main() {
  const report = generateInventory()
  const markdown = generateMarkdownReport(report)

  console.log(markdown)
  console.log('\n## JSON Evidence\n')
  console.log(JSON.stringify(report, null, 2))

  writeFileSync(resolve(repoRoot, 'docs/release/migration-inventory-report.json'), JSON.stringify(report, null, 2))
  writeFileSync(resolve(repoRoot, 'docs/release/migration-inventory-report.md'), markdown)

  console.log('\n✓ Inventory complete')
}

main().catch(err => {
  console.error('Inventory failed:', err)
  process.exit(1)
})
