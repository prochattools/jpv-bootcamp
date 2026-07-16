import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(path, 'utf8')

const checkoutAction = read('src/lib/actions/startMemberCheckout.ts')
const checkoutComponent = read('src/components/portal/MemberCheckoutButtons.tsx')
const webhook = read('src/lib/stripe-webhook-handler.ts')
const portalAction = read('src/lib/actions/openBillingPortal.ts')
const plans = read('src/lib/plans.ts')

function assertContains(source: string, phrases: string[], label: string): void {
  for (const phrase of phrases) {
    assert.ok(source.includes(phrase), `${label} must contain: ${phrase}`)
  }
}

function main(): void {
  assertContains(
    checkoutAction,
    [
      "plan !== 'membership'",
      "allow_promotion_codes: true",
      "payment_method_collection: 'always'",
      "phone_number_collection: { enabled: true }",
      "membership: 'jpv_bootcamp_membership'",
      'recurringPaymentAccepted',
    ],
    'member checkout action',
  )
  assert.doesNotMatch(checkoutAction, /contractAccepted|immediateAccessRequested|commitmentStatus/)

  assertContains(
    checkoutComponent,
    [
      'JPV Bootcamp Membership — Monthly',
      '£80 each month',
      'There is no minimum commitment',
      'JPV Bootcamp Membership — Annual',
      '£800 upfront for 12 months',
      'Recurring-payment acknowledgment',
    ],
    'checkout component',
  )
  assert.doesNotMatch(checkoutComponent, /12-month commitment|£960|£880|Start Pro/)

  assertContains(
    portalAction,
    ['stripeConfig.portalConfigurationId', 'BILLING_PORTAL_DEFAULT_RETURN_URL'],
    'billing portal action',
  )
  assert.doesNotMatch(portalAction, /commitmentPortalConfigurationId|restrictedPortalRequired|monthly_commitment/)

  assertContains(
    plans,
    ["normalized === 'membership'", "normalized === 'jpv_bootcamp_membership'", "? 'pro'"],
    'membership compatibility bridge',
  )

  assert.doesNotMatch(webhook, /ensureMonthlyCommitmentSchedule|projectCheckoutCommitment/)
  assert.match(webhook, /syncFromSubscription\(subscription\.id/)
  assert.match(webhook, /projectInvoicePaymentState/)

  console.log('single membership billing contract tests passed')
}

main()
