import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function main() {
  const source = await readFile('src/lib/billing/billingStatusHelper.ts', 'utf8')
  const typeBlock = source.match(/export type BillingStatus = \{([\s\S]*?)\n\}/)?.[1] ?? ''

  assert.match(source, /import 'server-only'/)
  assert.match(source, /customerProvisioning\.findUnique/)
  assert.match(source, /normalizeEmail\(memberEmail\)/)
  assert.match(source, /resolveMembershipLifecycle/)
  assert.match(source, /billingAccessStateForLifecycle/)
  assert.doesNotMatch(source, /resolveBillingAccessState/)
  assert.doesNotMatch(source, /getStripe|stripe\./)

  for (const field of [
    'hasBillingAccount',
    'hasActiveSubscription',
    'planLabel',
    'subscriptionStatus',
    'membershipStatus',
    'billingAccessState',
    'periodEndDate',
    'cancelAtPeriodEnd',
    'paymentStatus',
    'paymentFailedAt',
    'paymentRefundedAt',
    'paymentDisputeStatus',
    'paymentDisputedAt',
    'paymentDisputeResolvedAt',
    'showPaymentWarning',
    'showRefundNotice',
    'showDisputeNotice',
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

  assert.match(source, /planLabel: 'JPV Bootcamp Membership'/)
  assert.match(source, /membershipStatus: lifecycle\.state/)
  assert.match(source, /hasActiveSubscription: lifecycle\.accessAllowed/)
  assert.match(source, /params\.state === 'past_due'/)
  assert.match(source, /params\.state === 'unreconciled'/)
  assert.match(source, /restrictedPortalRequired: false/)
  assert.doesNotMatch(source, /record\.currentPlan/)
  assert.doesNotMatch(source, /monthly_commitment/)

  console.log('billing status helper tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
