import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function main() {
  const [action, component, page] = await Promise.all([
    readFile('src/lib/actions/startMemberCheckout.ts', 'utf8'),
    readFile('src/components/portal/MemberCheckoutButtons.tsx', 'utf8'),
    readFile('src/app/(frontend)/portal/[section]/page.tsx', 'utf8'),
  ])

  assert.match(action, /requirePortalMember\('\/portal\/billing'\)/)
  assert.match(action, /stripeCustomerId: true/)
  assert.match(action, /subscriptionStatus: true/)
  assert.match(action, /commitmentStatus: true/)
  assert.match(action, /ACTIVE_SUBSCRIPTION_STATUSES\.has/)
  assert.match(action, /ACTIVE_COMMITMENT_STATUSES\.has/)
  assert.match(action, /consent_required/)
  assert.match(action, /contractAccepted/)
  assert.match(action, /immediateAccessRequested/)
  assert.match(action, /buildCheckoutContractMetadata/)
  assert.match(action, /allow_promotion_codes: billing === 'annual'/)
  assert.match(action, /new URL\('\/portal\/billing\?checkout=success'/)
  assert.match(action, /new URL\('\/portal\/billing\?checkout=cancelled'/)
  assert.match(action, /customer: record\.stripeCustomerId/)
  assert.match(action, /customer_email: memberEmail/)
  assert.match(action, /catch \(error\)/)
  assert.match(action, /console\.error\('Failed to create member checkout session', error\)/)
  assert.doesNotMatch(action, /customerId:\s*string/)
  assert.doesNotMatch(action, /returnUrl:\s*string/)
  assert.doesNotMatch(action, /console\.(info|warn).*customer/i)

  assert.match(component, /£80 each month for an initial 12-month commitment/)
  assert.match(component, /Total initial commitment: £960/)
  assert.match(component, /continues at £80 per month until you cancel/)
  assert.match(component, /Contract acknowledgment/)
  assert.match(component, /Immediate access request/)
  assert.match(component, /Start Pro — pay £80 now/)
  assert.match(component, /Start Pro annual — pay £880 now/)
  assert.match(component, /startMemberCheckout\(/)
  assert.match(component, /contractAccepted, immediateAccessRequested/)
  assert.match(component, /type='checkbox'/)
  assert.match(component, /type='button'/)
  assert.doesNotMatch(component, /memberId|memberEmail|stripeCustomerId|returnUrl/)

  assert.match(page, /billingStatus\.hasActiveSubscription/)
  assert.match(page, /<MemberCheckoutButtons \/>/)
  assert.match(page, /billingStatus\.hasBillingAccount/)
  assert.match(page, /billingStatus\.restrictedPortalRequired/)
  assert.match(page, /requestMembershipCancellation/)
  assert.match(page, /commitmentEndAt/)
  assert.match(page, /cancellationEffectiveAt/)

  console.log('member checkout tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
