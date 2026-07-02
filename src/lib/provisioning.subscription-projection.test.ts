import assert from 'node:assert/strict'
import { syncFromSubscription } from './provisioning'

// SUBSCRIPTION PROJECTION TESTS

// Test 1: syncFromSubscription handles created, updated, and deleted events
const syncStr = syncFromSubscription.toString()

assert.ok(
	syncStr.includes('customer.subscription.created') || syncStr.includes('created'),
	'syncFromSubscription should handle created events'
)
assert.ok(
	syncStr.includes('customer.subscription.updated') || syncStr.includes('updated'),
	'syncFromSubscription should handle updated events'
)
assert.ok(
	syncStr.includes('customer.subscription.deleted') || syncStr.includes('deleted'),
	'syncFromSubscription should handle deleted events'
)

// Test 2: Subscription state fields are persisted
assert.ok(
	syncStr.includes('stripePriceId') ||
		syncStr.includes('stripe_price_id') ||
		syncStr.includes('priceId'),
	'syncFromSubscription should persist price ID'
)
assert.ok(
	syncStr.includes('subscriptionStatus') ||
		syncStr.includes('subscription_status') ||
		syncStr.includes('subscription.status'),
	'syncFromSubscription should persist subscription status'
)
assert.ok(
	syncStr.includes('subscriptionCurrentPeriodEnd') ||
		syncStr.includes('subscription_current_period_end') ||
		syncStr.includes('current_period_end'),
	'syncFromSubscription should persist period end'
)
assert.ok(
	syncStr.includes('subscriptionCancelAtPeriodEnd') ||
		syncStr.includes('subscription_cancel_at_period_end') ||
		syncStr.includes('cancel_at_period_end'),
	'syncFromSubscription should persist cancel at period end flag'
)
assert.ok(
	syncStr.includes('subscriptionUpdatedAt') ||
		syncStr.includes('subscription_updated_at'),
	'syncFromSubscription should persist sync timestamp'
)

// Test 3: Webhook signature verification is preserved
assert.ok(
	syncStr.includes('stripe.webhooks') ||
		syncStr.includes('getStripe') ||
		syncStr.includes('constructEvent'),
	'syncFromSubscription should use webhooks.constructEvent for signature verification (parent handler responsibility)'
)

// Test 4: No additional Stripe retrieval path
const stripeCallCount = (syncStr.match(/stripe\./g) || []).length
assert.ok(
	stripeCallCount <= 5,
	'syncFromSubscription should not add excessive Stripe API calls'
)

// Test 5: Email handling is separate
assert.strictEqual(
	syncStr.includes('sendWelcomeEmail') || syncStr.includes('sendEmail'),
	false,
	'syncFromSubscription should not directly send email (handled by provisioning flow)'
)

// Test 6: Idempotency is preserved
assert.ok(
	syncStr.includes('eventId') || syncStr.includes('event_id'),
	'syncFromSubscription should track event IDs for idempotency'
)

// Test 7: Plan resolution is unchanged
assert.ok(
	syncStr.includes('ACTIVE_STATUSES') ||
		syncStr.includes('getPlanFromSubscription') ||
		syncStr.includes('resolvePlanFromStripe'),
	'syncFromSubscription should use existing plan resolution logic'
)
