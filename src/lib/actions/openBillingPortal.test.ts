import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function main() {
  const [action, button, returnPage] = await Promise.all([
    readFile('src/lib/actions/openBillingPortal.ts', 'utf8'),
    readFile('src/components/portal/BillingPortalButton.tsx', 'utf8'),
    readFile('src/app/(frontend)/billing-return/page.tsx', 'utf8'),
  ])

  assert.match(action, /export async function openBillingPortal\(\)/)
  assert.match(action, /requirePortalMember\('\/portal\/billing'\)/)
  assert.match(action, /where: \{ normalizedEmail \}/)
  assert.match(action, /resolveReturnUrl\(\)/)
  assert.match(action, /BILLING_PORTAL_RETURN_PATH = '\/billing-return'/)
  assert.match(action, /\/portal\/billing/)
  assert.doesNotMatch(action, /openBillingPortal\([^)]*(memberId|memberEmail|returnUrl)/)
  assert.doesNotMatch(action, /console\.(info|warn|error)\([^\n]*(customerId|sessionId|memberId)/)

  assert.match(button, /openBillingPortal\(\)/)
  assert.match(button, /type='button'/)
  assert.doesNotMatch(button, /memberId|memberEmail|stripeCustomerId|returnUrl/)

  assert.match(returnPage, /window\.location\.replace\('\/portal\/billing'\)/)
  assert.match(returnPage, /href='\/portal\/billing'/)

  console.log('billing portal security tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
