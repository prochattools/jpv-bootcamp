import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function main() {
  const source = await readFile('src/lib/billing/billingStatusHelper.ts', 'utf8')
  const typeBlock = source.match(/export type BillingStatus = \{([\s\S]*?)\n\}/)?.[1] ?? ''

  assert.match(source, /import 'server-only'/)
  assert.match(source, /customerProvisioning\.findUnique/)
  assert.match(source, /normalizeEmail\(memberEmail\)/)
  assert.doesNotMatch(source, /getStripe|stripe\./)

  for (const field of [
    'hasBillingAccount',
    'hasActiveSubscription',
    'planLabel',
    'subscriptionStatus',
    'periodEndDate',
    'cancelAtPeriodEnd',
    'paymentStatus',
    'paymentFailedAt',
    'showPaymentWarning',
    'manageBillingAvailable',
  ]) {
    assert.match(typeBlock, new RegExp(field))
  }

  for (const sensitiveField of [
    'stripeCustomerId',
    'stripeSubscriptionId',
    'stripePriceId',
    'lastEventId',
    'email',
  ]) {
    assert.doesNotMatch(typeBlock, new RegExp(sensitiveField))
  }

  assert.match(source, /ACTIVE_SUBSCRIPTION_STATUSES/)
  assert.match(source, /record\.subscriptionStatus/)
  assert.match(source, /record\.currentPlan/)

  console.log('billing status helper tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
