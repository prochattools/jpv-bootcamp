import assert from 'node:assert/strict'
import { openBillingPortal, type OpenBillingPortalResult } from './openBillingPortal'

// SECURITY TESTS FOR BILLING PORTAL AUTHORIZATION

// Test 1: openBillingPortal function signature does not accept client identity parameters
assert.strictEqual(openBillingPortal.length, 0, 'openBillingPortal should accept no parameters')

const functionStr = openBillingPortal.toString()
assert.strictEqual(
	functionStr.includes('memberId'),
	false,
	'openBillingPortal should not reference memberId parameter'
)
assert.strictEqual(
	functionStr.includes('memberEmail'),
	false,
	'openBillingPortal should not reference memberEmail parameter'
)
assert.strictEqual(
	functionStr.includes('returnUrl'),
	false,
	'openBillingPortal should not reference returnUrl parameter'
)

// Test 2: Server action calls requirePortalMember('/portal/billing')
assert.strictEqual(
	functionStr.includes("requirePortalMember('/portal/billing')") || functionStr.includes('requirePortalMember'),
	true,
	'openBillingPortal should call requirePortalMember for server-side auth'
)

// Test 3: Server action does not log sensitive identifiers
assert.strictEqual(
	functionStr.includes('memberId:') || functionStr.includes('memberId,'),
	false,
	'openBillingPortal should not log memberId'
)
assert.strictEqual(
	functionStr.includes('customerId:') || functionStr.includes('sessionId:'),
	false,
	'openBillingPortal should not log customerId or sessionId'
)

// Test 4: Return type is properly typed
const resultType = 'OpenBillingPortalResult'
assert.ok(
	functionStr.includes(resultType),
	`openBillingPortal should return ${resultType}`
)

// Test 5: BILLING_PORTAL_DEFAULT_RETURN_URL is used (not client-controlled)
assert.strictEqual(
	functionStr.includes('BILLING_PORTAL_DEFAULT_RETURN_URL'),
	true,
	'openBillingPortal should use fixed configuration return URL'
)
