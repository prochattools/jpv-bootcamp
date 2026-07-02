import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function main() {
  const [action, button] = await Promise.all([
    readFile('src/lib/actions/openBillingPortal.ts', 'utf8'),
    readFile('src/components/portal/BillingPortalButton.tsx', 'utf8'),
  ])

  assert.match(action, /export async function openBillingPortal\(\)/)
  assert.match(action, /requirePortalMember\('\/portal\/billing'\)/)
  assert.match(action, /where: \{ normalizedEmail \}/)
  assert.match(action, /BILLING_PORTAL_DEFAULT_RETURN_URL/)
  assert.doesNotMatch(action, /openBillingPortal\([^)]*(memberId|memberEmail|returnUrl)/)
  assert.doesNotMatch(action, /console\.(info|warn|error)\([^\n]*(customerId|sessionId|memberId)/)

  assert.match(button, /openBillingPortal\(\)/)
  assert.match(button, /type='button'/)
  assert.doesNotMatch(button, /memberId|memberEmail|stripeCustomerId|returnUrl/)

  console.log('billing portal security tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
