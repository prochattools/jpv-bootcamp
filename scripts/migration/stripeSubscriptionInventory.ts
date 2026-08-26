/**
 * Real read-only Stripe subscription inventory with dependency injection.
 * Produces a redacted deterministic report — no PII in output, no mutations.
 *
 * Usage (dry-run, TEST mode only in this goal):
 *   STRIPE_ENV=test tsx scripts/migration/stripeSubscriptionInventory.ts --mode=inventory
 */

export interface StripeClientLike {
  subscriptions: {
    list(params: {
      limit: number
      expand: string[]
      status?: string
      starting_after?: string
    }): Promise<{
      data: RawSubscription[]
      has_more: boolean
    }>
  }
  invoices: {
    retrieveUpcoming(params: {
      customer: string
      subscription: string
    }): Promise<{ amount_due: number; currency: string }>
  }
}

export interface RawSubscription {
  id: string
  customer: string | { id: string }
  status: string
  items: { data: Array<{ price: { id: string; recurring?: { interval: string } }; quantity: number }> }
  current_period_start: number
  current_period_end: number
  cancel_at_period_end: boolean
  canceled_at: number | null
  schedule: string | null
  latest_invoice: string | null | { payment_intent: { status: string } | null }
  metadata: Record<string, string>
  discount: { coupon: { id: string; amount_off: number | null; percent_off: number | null } } | null
  default_payment_method: string | null
}

export interface SubscriptionRecord {
  subscriptionId: string
  customerId: string
  memberId: string
  currentPriceId: string
  currentCadence: 'monthly' | 'annual' | 'unknown'
  subscriptionStatus: string
  paymentStatus: 'active' | 'past_due' | 'unknown'
  disputeState: 'none' | 'open'
  cancellationState: 'none' | 'scheduled' | 'effective'
  scheduleState: 'none' | 'scheduled'
  itemCount: number
  meteredState: 'none' | 'metered'
  identityStatus: 'complete' | 'incomplete'
  discountId?: string
  reviewReason?: string
}

export interface TargetPriceMap {
  monthly: string
  annual: string
  allowedProducts: string[]
}

export interface InventoryConfig {
  client: StripeClientLike
  targetPrices: TargetPriceMap
  accountAllowlist: string[]
  maxSubscriptions: number
}

export interface InventoryReport {
  runId: string
  stripeEnv: string
  totalFetched: number
  eligible: SubscriptionRecord[]
  manualReview: SubscriptionRecord[]
  ineligible: SubscriptionRecord[]
  excluded: Array<{ subscriptionId: string; reason: string }>
  cohortCounts: Record<string, number>
}

function redactId(id: string): string {
  if (id.length <= 8) return '***'
  return id.slice(0, 4) + '***' + id.slice(-4)
}

function customerId(raw: RawSubscription): string {
  return typeof raw.customer === 'string' ? raw.customer : raw.customer.id
}

function classify(rec: SubscriptionRecord): 'eligible' | 'manual_review' | 'ineligible' {
  if (rec.identityStatus !== 'complete') return 'ineligible'
  if (rec.disputeState !== 'none') return 'ineligible'
  if (rec.cancellationState === 'effective') return 'ineligible'
  if (rec.subscriptionStatus !== 'active' && rec.subscriptionStatus !== 'trialing') return 'ineligible'
  if (rec.itemCount !== 1) return 'ineligible'
  if (rec.meteredState !== 'none') return 'ineligible'
  if (rec.paymentStatus === 'past_due') return 'manual_review'
  if (rec.cancellationState === 'scheduled') return 'manual_review'
  if (rec.scheduleState === 'scheduled') return 'manual_review'
  if (rec.currentCadence === 'unknown') return 'manual_review'
  return 'eligible'
}

function mapRecord(raw: RawSubscription, targetPrices: TargetPriceMap): SubscriptionRecord {
  const cid = customerId(raw)
  const items = raw.items.data
  const price = items[0]?.price
  const priceId = price?.id ?? ''
  const interval = price?.recurring?.interval ?? ''
  const cadence: SubscriptionRecord['currentCadence'] =
    interval === 'month' ? 'monthly' : interval === 'year' ? 'annual' : 'unknown'

  const isMetered = items.some((i) => !i.price.recurring)
  const hasSchedule = raw.schedule !== null
  const cancelScheduled = raw.cancel_at_period_end
  const canceledAt = raw.canceled_at

  const paymentStatus: SubscriptionRecord['paymentStatus'] =
    raw.status === 'past_due' ? 'past_due' : 'active'

  const memberId = raw.metadata?.['memberId'] ?? raw.metadata?.['member_id'] ?? ''

  return {
    subscriptionId: raw.id,
    customerId: cid,
    memberId,
    currentPriceId: priceId,
    currentCadence: cadence,
    subscriptionStatus: raw.status,
    paymentStatus,
    disputeState: 'none',
    cancellationState: canceledAt
      ? 'effective'
      : cancelScheduled
        ? 'scheduled'
        : 'none',
    scheduleState: hasSchedule ? 'scheduled' : 'none',
    itemCount: items.length,
    meteredState: isMetered ? 'metered' : 'none',
    identityStatus: memberId ? 'complete' : 'incomplete',
    discountId: raw.discount?.coupon.id,
    reviewReason: undefined,
  }
}

export async function fetchInventory(config: InventoryConfig): Promise<SubscriptionRecord[]> {
  const records: SubscriptionRecord[] = []
  let startingAfter: string | undefined
  let fetched = 0

  while (fetched < config.maxSubscriptions) {
    const batch = await config.client.subscriptions.list({
      limit: 100,
      expand: ['data.customer', 'data.discount', 'data.schedule'],
      status: 'all',
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    })

    for (const raw of batch.data) {
      const cid = customerId(raw)
      if (config.accountAllowlist.length > 0 && !config.accountAllowlist.includes(cid)) {
        continue
      }
      records.push(mapRecord(raw, config.targetPrices))
      fetched++
    }

    if (!batch.has_more || fetched >= config.maxSubscriptions) break
    startingAfter = batch.data[batch.data.length - 1]?.id
  }

  return records
}

export function buildReport(
  runId: string,
  stripeEnv: string,
  records: SubscriptionRecord[],
): InventoryReport {
  const eligible: SubscriptionRecord[] = []
  const manualReview: SubscriptionRecord[] = []
  const ineligible: SubscriptionRecord[] = []
  const excluded: Array<{ subscriptionId: string; reason: string }> = []
  const cohortCounts: Record<string, number> = {}

  for (const rec of records) {
    const tier = classify(rec)
    const reason = rec.reviewReason ?? tier

    cohortCounts[reason] = (cohortCounts[reason] ?? 0) + 1

    if (tier === 'eligible') eligible.push(rec)
    else if (tier === 'manual_review') manualReview.push(rec)
    else {
      ineligible.push(rec)
      excluded.push({ subscriptionId: redactId(rec.subscriptionId), reason })
    }
  }

  return {
    runId,
    stripeEnv,
    totalFetched: records.length,
    eligible,
    manualReview,
    ineligible,
    excluded,
    cohortCounts,
  }
}

export function redactedReportMarkdown(report: InventoryReport): string {
  const lines: string[] = [
    `# Stripe Subscription Inventory`,
    ``,
    `- Run ID: ${report.runId}`,
    `- Stripe env: ${report.stripeEnv}`,
    `- Total fetched: ${report.totalFetched}`,
    ``,
    `## Cohort summary`,
    ``,
    `| Cohort | Count |`,
    `| --- | --- |`,
    `| Eligible | ${report.eligible.length} |`,
    `| Manual review | ${report.manualReview.length} |`,
    `| Ineligible/excluded | ${report.ineligible.length} |`,
    ``,
    `## Cohort breakdown`,
    ``,
    `| Reason | Count |`,
    `| --- | --- |`,
  ]

  for (const [reason, count] of Object.entries(report.cohortCounts)) {
    lines.push(`| ${reason} | ${count} |`)
  }

  if (report.excluded.length > 0) {
    lines.push(``, `## Excluded (redacted IDs)`, ``)
    for (const exc of report.excluded) {
      lines.push(`- ${exc.subscriptionId}: ${exc.reason}`)
    }
  }

  return lines.join('\n')
}
