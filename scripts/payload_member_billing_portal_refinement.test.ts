import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function main() {
  const [billingAction, billingPage, checkoutButtons] = await Promise.all([
    readFile('src/lib/actions/openBillingPortal.ts', 'utf8'),
    readFile('src/app/(frontend)/portal/[section]/page.tsx', 'utf8'),
    readFile('src/components/portal/MemberCheckoutButtons.tsx', 'utf8'),
  ])

  assert.match(billingAction, /requirePortalMember\('\/portal\/billing'\)/)
  assert.match(billingAction, /BILLING_PORTAL_DEFAULT_RETURN_URL/)
  assert.match(billingAction, /stripeConfig\.portalConfigurationId/)
  assert.doesNotMatch(billingAction, /commitmentPortalConfigurationId|restrictedPortalRequired|monthly_commitment/)
  assert.doesNotMatch(billingAction, /openBillingPortal\([^)]*(memberId|memberEmail|stripeCustomerId|returnUrl)/)

  assert.match(billingPage, /MemberCheckoutButtons/)
  assert.match(billingPage, /BillingPortalButton/)
  assert.match(billingPage, /requestMembershipCancellation/)
  assert.match(billingPage, /checkout === 'success'/)
  assert.match(billingPage, /checkout === 'cancelled'/)
  assert.doesNotMatch(billingPage, /openMemberPaidUpgradeAction/)
  assert.doesNotMatch(billingPage, /getStripe\(\)|stripe\.checkout|stripe\.billingPortal/)

  assert.match(checkoutButtons, /Start monthly membership — pay £80 now/)
  assert.match(checkoutButtons, /Start annual membership — pay £800 now/)
  assert.match(checkoutButtons, /Recurring-payment acknowledgment/)
  assert.match(checkoutButtons, /startMemberCheckout\(PLAN, billing, \{ recurringPaymentAccepted \}\)/)
  assert.match(checkoutButtons, /existing_subscription/)
  assert.match(checkoutButtons, /Use Manage billing instead\./)
  assert.doesNotMatch(checkoutButtons, /Contract acknowledgment|Immediate access request|Start Pro|£880/)

  console.log('billing portal refinement tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
