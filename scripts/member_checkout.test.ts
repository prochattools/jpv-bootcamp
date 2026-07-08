import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function main() {
  const [action, component, page] = await Promise.all([
    readFile('src/lib/actions/startMemberCheckout.ts', 'utf8'),
    readFile('src/components/portal/MemberCheckoutButtons.tsx', 'utf8'),
    readFile('src/app/(frontend)/portal/[section]/page.tsx', 'utf8'),
  ])

  assert.match(action, /requirePortalMember\('\/portal\/billing'\)/)
  assert.match(action, /select: \{ stripeCustomerId: true, subscriptionStatus: true \}/)
  assert.match(action, /ACTIVE_SUBSCRIPTION_STATUSES\.has/)
  assert.match(action, /new URL\('\/portal\/billing\?checkout=success'/)
  assert.match(action, /new URL\('\/portal\/billing\?checkout=cancelled'/)
  assert.match(action, /customer: record\.stripeCustomerId/)
  assert.match(action, /customer_email: memberEmail/)
  assert.doesNotMatch(action, /customerId:\s*string/)
  assert.doesNotMatch(action, /returnUrl:\s*string/)
  assert.doesNotMatch(action, /console\.(info|warn).*customer/i)

  assert.match(component, /Start Pro monthly/)
  assert.match(component, /Start Pro annual/)
  assert.match(component, /startMemberCheckout\(plan, billing\)/)
  assert.match(component, /type='button'/)
  assert.doesNotMatch(component, /memberId|memberEmail|stripeCustomerId|returnUrl/)

  assert.match(page, /billingStatus\.hasActiveSubscription/)
  assert.match(page, /<MemberCheckoutButtons \/>/)
  assert.match(page, /billingStatus\.hasBillingAccount/)

  console.log('member checkout tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
