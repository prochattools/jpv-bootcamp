import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function main() {
  const [billingAction, billingPage, upgradeRoute, checkoutButtons] = await Promise.all([
    readFile('src/lib/actions/openBillingPortal.ts', 'utf8'),
    readFile('src/app/(frontend)/learn/billing/page.tsx', 'utf8'),
    readFile('src/app/api/stripe/upgrade-vip/route.ts', 'utf8'),
    readFile('src/components/portal/MemberCheckoutButtons.tsx', 'utf8'),
  ])

  assert.match(billingAction, /requirePortalMember\('\/portal\/billing'\)/)
  assert.match(billingAction, /BILLING_PORTAL_DEFAULT_RETURN_URL/)
  assert.doesNotMatch(billingAction, /openBillingPortal\([^)]*(memberId|memberEmail|stripeCustomerId|returnUrl)/)
  assert.doesNotMatch(billingAction, /openBillingPortal\([^)]*customer:/)

  assert.match(billingPage, /Plan changes, cancellation, and payment-method updates are managed in the Stripe billing portal\./)
  assert.match(billingPage, /MemberCheckoutButtons/)
  assert.match(billingPage, /Checkout is available for members without an active subscription\./)
  assert.doesNotMatch(billingPage, /openMemberVipUpgradeAction/)
  assert.doesNotMatch(billingPage, /getStripe\(\)|stripe\.checkout|stripe\.billingPortal/)

  assert.match(upgradeRoute, /status: 410/)
  assert.match(upgradeRoute, /Use \/portal\/billing/)
  assert.doesNotMatch(upgradeRoute, /getStripe\(|stripe\.billingPortal|verifyBillingPortalToken|normalizeEmail/)

  assert.match(checkoutButtons, /startMemberCheckout\(plan\)/)
  assert.match(checkoutButtons, /existing_subscription/)
  assert.match(checkoutButtons, /Use Manage billing instead\./)

  console.log('billing portal refinement tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
