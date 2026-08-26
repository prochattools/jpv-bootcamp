import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function main() {
  const [action, component, page] = await Promise.all([
    readFile('src/lib/actions/startMemberCheckout.ts', 'utf8'),
    readFile('src/components/portal/MemberCheckoutButtons.tsx', 'utf8'),
    readFile('src/app/(frontend)/portal/[section]/page.tsx', 'utf8'),
  ])

  assert.match(action, /requirePortalMember\('\/portal\/billing'\)/)
  assert.match(action, /plan !== 'membership'/)
  assert.match(action, /stripeCustomerId: true/)
  assert.match(action, /subscriptionStatus: true/)
  assert.match(action, /ACTIVE_SUBSCRIPTION_STATUSES\.has/)
  assert.match(action, /consent_required/)
  assert.match(action, /recurringPaymentAccepted/)
  assert.match(action, /allow_promotion_codes: true/)
  assert.match(action, /payment_method_collection: 'always'/)
  assert.match(action, /phone_number_collection: \{ enabled: true \}/)
  assert.match(action, /membership: 'jpv_bootcamp_membership'/)
  assert.match(action, /billingCadence: billing/)
  assert.match(action, /new URL\('\/portal\/billing\?checkout=success'/)
  assert.match(action, /new URL\('\/portal\/billing\?checkout=cancelled'/)
  assert.match(action, /customer: record\.stripeCustomerId/)
  assert.match(action, /customer_email: memberEmail/)
  assert.match(action, /catch \(error\)/)
  assert.match(action, /console\.error\('Failed to create member checkout session', error\)/)
  assert.doesNotMatch(action, /commitmentStatus/)
  assert.doesNotMatch(action, /contractAccepted/)
  assert.doesNotMatch(action, /immediateAccessRequested/)
  assert.doesNotMatch(action, /customerId:\s*string/)
  assert.doesNotMatch(action, /returnUrl:\s*string/)
  assert.doesNotMatch(action, /console\.(info|warn).*customer/i)

  assert.match(component, /const PLAN = 'membership'/)
  assert.match(component, /JPV Bootcamp Membership — Monthly/)
  assert.match(component, /£80 each month/)
  assert.match(component, /There is no minimum commitment/)
  assert.match(component, /cancellation takes effect at the end of the current paid month/)
  assert.match(component, /JPV Bootcamp Membership — Annual/)
  assert.match(component, /£800 upfront for 12 months/)
  assert.match(component, /renews automatically each year unless you cancel/)
  assert.match(component, /Recurring-payment acknowledgment/)
  assert.match(component, /voucher or pay-it-forward code/)
  assert.match(component, /Start monthly membership — pay £80 now/)
  assert.match(component, /Start annual membership — pay £800 now/)
  assert.match(component, /startMemberCheckout\(PLAN, billing, \{ recurringPaymentAccepted \}\)/)
  assert.match(component, /type='checkbox'/)
  assert.match(component, /type='button'/)
  assert.doesNotMatch(component, /12-month commitment/)
  assert.doesNotMatch(component, /£960|£880|Start Pro/)
  assert.doesNotMatch(component, /memberId|memberEmail|stripeCustomerId|returnUrl/)

  assert.match(page, /billingStatus\.hasActiveSubscription/)
  assert.match(page, /<MemberCheckoutButtons \/>/)
  assert.match(page, /billingStatus\.hasBillingAccount/)
  assert.match(page, /billingStatus\.restrictedPortalRequired/)
  assert.match(page, /requestMembershipCancellation/)
  assert.match(page, /cancellationEffectiveAt/)

  console.log('member checkout tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
