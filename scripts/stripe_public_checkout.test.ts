import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { signBillingPortalToken, verifyBillingPortalToken } from '../src/lib/billing-portal-token'

const HMAC_SECRET = 'test-hmac-secret-for-unit-tests'

function makeValidToken(email: string): string {
  const now = Math.floor(Date.now() / 1000)
  return signBillingPortalToken(
    { email, iat: now, exp: now + 600, nonce: 'test-nonce' },
    HMAC_SECRET,
  )
}

async function main() {
  const route = await readFile('src/app/api/stripe/checkout/route.ts', 'utf8')

  // --- Anonymous checkout (no token) creates session without customer_email ---
  assert.doesNotMatch(
    route,
    /if\s*\(\s*!tokenParam\s*\)\s*\{[^}]*Authentication required/s,
    'Route must NOT reject requests when no token is provided',
  )

  // Token handling is conditional — only verify when token is present
  assert.match(route, /if\s*\(\s*tokenParam\s*\)/, 'Token verification must be conditional on tokenParam presence')

  // Invalid token still returns 401
  assert.match(route, /Invalid or expired billing token/, 'Invalid tokens must be rejected with 401')

  // customer_email is conditionally applied
  assert.match(route, /customerEmail\s*\?\s*\{\s*customer_email:\s*customerEmail\s*\}/, 'customer_email must be spread conditionally')

  // --- Required validations are preserved ---
  assert.match(route, /parseCheckoutPlan/, 'Plan validation is required')
  assert.match(route, /resolveCheckoutBilling/, 'Billing resolution is required')
  assert.match(route, /recurringPaymentAccepted/, 'Recurring payment consent check is required')
  assert.match(route, /membership/, 'Only membership plan is accepted')
  assert.match(route, /mode:\s*'subscription'/, 'Session mode must be subscription')
  assert.match(route, /allow_promotion_codes:\s*true/, 'Promotion codes must be enabled')
  assert.match(route, /payment_method_collection:\s*'always'/, 'Payment method collection required')
  assert.match(route, /phone_number_collection:\s*\{\s*enabled:\s*true\s*\}/, 'Phone collection must be enabled')
  assert.match(route, /subscription_data:\s*\{\s*metadata\s*\}/, 'Subscription data metadata is required')
  assert.match(route, /buildSameOriginReturnUrl/, 'Same-origin URL validation is required')
  assert.match(route, /getCheckoutPriceId/, 'Price ID resolution is required')

  // --- Security: never trust email from query params ---
  assert.doesNotMatch(route, /searchParams\.get\(['"]email['"]\)/, 'Must never read email from query params')

  // --- Security: billing portal token verification uses HMAC ---
  assert.match(route, /verifyBillingPortalToken/, 'Must use HMAC-based token verification')

  // --- Metadata structure is preserved ---
  assert.match(route, /membership:\s*'jpv_bootcamp_membership'/, 'Membership metadata value is required')
  assert.match(route, /billingCadence:\s*billing/, 'Billing cadence metadata is required')
  assert.match(route, /source:\s*'landing'/, 'Source metadata is required')
  assert.match(route, /recurringPaymentAccepted:\s*'true'/, 'Consent timestamp metadata is required')
  assert.match(route, /recurringPaymentAcceptedAt/, 'Consent timestamp is recorded')

  // --- Redirect behavior ---
  assert.match(route, /NextResponse\.redirect\(session\.url/, 'Must redirect to Stripe session URL')
  assert.match(route, /status:\s*303/, 'Redirect must use 303 status')

  // --- Token library unit tests ---
  const validToken = makeValidToken('test@example.com')
  const result = verifyBillingPortalToken(validToken, HMAC_SECRET)
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.payload.email, 'test@example.com')
  }

  // Invalid token must fail verification
  const badResult = verifyBillingPortalToken('invalid.token', HMAC_SECRET)
  assert.equal(badResult.ok, false)

  // Expired token must fail
  const now = Math.floor(Date.now() / 1000)
  const expiredToken = signBillingPortalToken(
    { email: 'expired@example.com', iat: now - 700, exp: now - 100, nonce: 'n' },
    HMAC_SECRET,
  )
  const expiredResult = verifyBillingPortalToken(expiredToken, HMAC_SECRET)
  assert.equal(expiredResult.ok, false)
  if (!expiredResult.ok) {
    assert.equal(expiredResult.reason, 'expired')
  }

  // Wrong secret must fail
  const wrongSecretResult = verifyBillingPortalToken(validToken, 'wrong-secret')
  assert.equal(wrongSecretResult.ok, false)
  if (!wrongSecretResult.ok) {
    assert.equal(wrongSecretResult.reason, 'invalid_signature')
  }

  // --- Route rejects missing consent ---
  assert.match(route, /Recurring-payment acknowledgment is required/, 'Missing consent must be rejected')

  // --- Route rejects invalid plan ---
  assert.match(route, /Invalid membership/, 'Invalid plan must be rejected')

  console.log('stripe public checkout tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
