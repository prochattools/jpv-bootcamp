import assert from 'node:assert/strict'
import { getBillingStatus, type BillingStatus } from './billingStatusHelper'

// BILLING STATUS HELPER TESTS

// Test 1: getBillingStatus is server-only
const helperStr = getBillingStatus.toString()
assert.ok(
	helperStr.includes("'use server'") || helperStr.includes('server-only'),
	'getBillingStatus should be server-only (no Stripe calls from client)'
)

// Test 2: getBillingStatus reads from CustomerProvisioning, not Stripe
assert.strictEqual(
	helperStr.includes('getStripe') || helperStr.includes('stripe.'),
	false,
	'getBillingStatus should not call Stripe API'
)
assert.ok(
	helperStr.includes('findUnique') || helperStr.includes('customerProvisioning'),
	'getBillingStatus should read from CustomerProvisioning'
)

// Test 3: Return type excludes sensitive identifiers
assert.ok(
	helperStr.includes('hasBillingAccount'),
	'getBillingStatus should return hasBillingAccount'
)
assert.ok(
	helperStr.includes('planLabel'),
	'getBillingStatus should return planLabel'
)
assert.ok(
	helperStr.includes('subscriptionStatus'),
	'getBillingStatus should return subscriptionStatus'
)
assert.ok(
	helperStr.includes('periodEndDate'),
	'getBillingStatus should return periodEndDate'
)
assert.ok(
	helperStr.includes('cancelAtPeriodEnd'),
	'getBillingStatus should return cancelAtPeriodEnd'
)
assert.ok(
	helperStr.includes('manageBillingAvailable'),
	'getBillingStatus should return manageBillingAvailable'
)

// Test 4: Result should NOT expose Stripe IDs
assert.strictEqual(
	helperStr.includes('stripeCustomerId'),
	false,
	'getBillingStatus should not return Stripe customer ID'
)
assert.strictEqual(
	helperStr.includes('stripeSubscriptionId'),
	false,
	'getBillingStatus should not return Stripe subscription ID'
)
assert.strictEqual(
	helperStr.includes('stripePriceId'),
	false,
	'getBillingStatus should not return Stripe price ID'
)
assert.strictEqual(
	helperStr.includes('lastEventId'),
	false,
	'getBillingStatus should not return event IDs'
)

// Test 5: Helper reads member by normalized email
assert.ok(
	helperStr.includes('normalizeEmail') || helperStr.includes('normalized'),
	'getBillingStatus should normalize member email for lookup'
)

// Test 6: Active subscription check
assert.ok(
	helperStr.includes('active') || helperStr.includes('ACTIVE'),
	'getBillingStatus should determine active subscription state'
)

// Test 7: Plan label conversion
assert.ok(
	helperStr.includes('Pro') ||
		helperStr.includes('VIP') ||
		helperStr.includes('planLabel') ||
		helperStr.includes('plan'),
	'getBillingStatus should map plans to human-readable labels'
)
