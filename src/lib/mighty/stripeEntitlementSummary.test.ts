import assert from 'node:assert/strict'
import test from 'node:test'

import { isStripeEntitled, summarizeStripeRoster } from './stripeEntitlementSummary'
import { deriveMightyDesiredAccess } from './entitlement'

const entitled = {
	status: 'active',
	stripeSubscriptionId: 'sub_1',
	subscriptionStatus: 'active',
	paymentStatus: 'paid',
}

test('classifies only active/trialing, non-blocked Stripe rows as entitled', () => {
	assert.equal(isStripeEntitled(entitled), true)
	assert.equal(isStripeEntitled({ ...entitled, subscriptionStatus: null }), false)
	assert.equal(isStripeEntitled({ ...entitled, paymentStatus: 'failed' }), false)
	assert.equal(isStripeEntitled({ ...entitled, status: 'inactive' }), false)
})

test('summarizes ambiguous active records instead of dropping them', () => {
	assert.deepEqual(summarizeStripeRoster([
		entitled,
		{ ...entitled, stripeSubscriptionId: null, subscriptionStatus: null },
		{ ...entitled, stripeSubscriptionId: 'sub_3', subscriptionStatus: 'canceled' },
	]), {
		totalActiveProvisioningRecords: 3,
		totalCandidateStripeSubscriptions: 2,
		entitledSubscriberCount: 1,
		ambiguousOrUnmatchedRecordCount: 2,
		recordsRequiringManualReview: 2,
		missingStripeSubscriptionIdCount: 1,
		missingSubscriptionStatusCount: 1,
	})
})

test('the canonical entitlement function handles payment failure, recovery, cancellation, and terminal states', () => {
	assert.equal(deriveMightyDesiredAccess({ subscriptionStatus: 'active', paymentStatus: 'paid' }), 'ALLOWED')
	assert.equal(deriveMightyDesiredAccess({ subscriptionStatus: 'trialing' }), 'ALLOWED')
	assert.equal(deriveMightyDesiredAccess({ eventType: 'invoice.payment_failed' }), 'DENIED')
	assert.equal(deriveMightyDesiredAccess({ eventType: 'invoice.paid' }), 'ALLOWED')
	assert.equal(deriveMightyDesiredAccess({ eventType: 'customer.subscription.deleted' }), 'DENIED')
	assert.equal(deriveMightyDesiredAccess({ subscriptionStatus: 'past_due' }), 'DENIED')
	assert.equal(deriveMightyDesiredAccess({ subscriptionStatus: 'active', paymentStatus: 'refunded' }), 'DENIED')
})

test('scheduled cancellation remains allowed while the subscription is still active', () => {
	assert.equal(deriveMightyDesiredAccess({ subscriptionStatus: 'active' }), 'ALLOWED')
})
