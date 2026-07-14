import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function main() {
  const [billingAction, billingPage, checkoutButtons] = await Promise.all([
    readFile('src/lib/actions/openBillingPortal.ts', 'utf8'),
    readFile('src/app/(frontend)/learn/billing/page.tsx', 'utf8'),
    readFile('src/components/portal/MemberCheckoutButtons.tsx', 'utf8'),
  ])

  assert.match(billingAction, /requirePortalMember\('\/portal\/billing'\)/)
  assert.match(billingAction, /BILLING_PORTAL_DEFAULT_RETURN_URL/)
  assert.doesNotMatch(billingAction, /openBillingPortal\([^)]*(memberId|memberEmail|stripeCustomerId|returnUrl)/)
  assert.doesNotMatch(billingAction, /openBillingPortal\([^)]*customer:/)

  assert.match(billingPage, /import \{ redirect \} from 'next\/navigation'/)
  assert.match(billingPage, /new URLSearchParams\(\)/)
  assert.match(billingPage, /checkout/)
  assert.match(billingPage, /cancellation_requested/)
  assert.match(billingPage, /cancellation_effective_at/)
  assert.match(billingPage, /cancellation_error/)
  assert.match(billingPage, /redirect\(destination\)/)
  assert.doesNotMatch(billingPage, /MemberCheckoutButtons/)
  assert.doesNotMatch(billingPage, /Checkout is available for members without an active subscription\./)
  assert.doesNotMatch(billingPage, /openMemberPaidUpgradeAction/)
  assert.doesNotMatch(billingPage, /getStripe\(\)|stripe\.checkout|stripe\.billingPortal/)

  assert.match(checkoutButtons, /Start Pro — pay £80 now/)
  assert.match(checkoutButtons, /Start Pro annual — pay £880 now/)
  assert.match(checkoutButtons, /Contract acknowledgment/)
  assert.match(checkoutButtons, /Immediate access request/)
  assert.match(checkoutButtons, /startMemberCheckout\(/)
  assert.match(checkoutButtons, /contractAccepted, immediateAccessRequested/)
  assert.match(checkoutButtons, /existing_subscription/)
  assert.match(checkoutButtons, /Use Manage billing instead\./)

  console.log('billing portal refinement tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
