import assert from 'node:assert/strict'
import test from 'node:test'
import type Stripe from 'stripe'

import {
	mightyRetryDelayMs,
	projectMightyAccessFromStripeEvent,
	shouldApplyMightyStripeEvent,
} from './accessSync'

function event(type: string, object: Record<string, unknown>, created = 1_000, id = `evt_${type}`): Stripe.Event {
	return {
		id,
		type,
		created,
		livemode: false,
		data: { object },
	} as unknown as Stripe.Event
}

test('required Stripe lifecycle events map to the binary Mighty access state', () => {
	const subscription = {
		id: 'sub_123',
		customer: 'cus_123',
		status: 'active',
		cancel_at_period_end: true,
	}
	const cases: Array<[string, Record<string, unknown>, 'ALLOWED' | 'DENIED', string]> = [
		['checkout.session.completed', { mode: 'subscription', payment_status: 'paid', customer: 'cus_123', subscription: 'sub_123' }, 'ALLOWED', 'sub_123'],
		['invoice.paid', { customer: 'cus_123', subscription: 'sub_123' }, 'ALLOWED', 'sub_123'],
		['invoice.payment_failed', { customer: 'cus_123', subscription: 'sub_123' }, 'DENIED', 'sub_123'],
		['customer.subscription.updated', subscription, 'ALLOWED', 'sub_123'],
		['customer.subscription.deleted', subscription, 'DENIED', 'sub_123'],
	]

	for (const [type, object, desiredAccess, subscriptionId] of cases) {
		const projection = projectMightyAccessFromStripeEvent(event(type, object))
		assert.equal(projection?.desiredAccess, desiredAccess, type)
		assert.equal(projection?.stripeSubscriptionId, subscriptionId, type)
	}

	assert.equal(
		projectMightyAccessFromStripeEvent(event('checkout.session.completed', {
			mode: 'subscription',
			payment_status: 'unpaid',
		})) ,
		null,
	)
	assert.equal(
		projectMightyAccessFromStripeEvent(event('customer.subscription.updated', {
			...subscription,
			status: 'past_due',
		}))?.desiredAccess,
		'DENIED',
	)
})

test('older deliveries cannot overwrite a newer denial or terminal subscription state', () => {
	const failed = {
		lastStripeEventId: 'evt_failed',
		lastStripeEventCreatedAt: new Date(2_000_000),
		lastStripeEventType: 'invoice.payment_failed',
		stripeSubscriptionId: 'sub_123',
	}

	assert.deepEqual(
		shouldApplyMightyStripeEvent(failed, {
			stripeEventId: 'evt_old_paid',
			stripeEventCreatedAt: new Date(1_000_000),
			stripeEventType: 'invoice.paid',
			desiredAccess: 'ALLOWED',
			stripeSubscriptionId: 'sub_123',
		}),
		{ apply: false, reason: 'stale_stripe_event' },
	)

	assert.deepEqual(
		shouldApplyMightyStripeEvent(failed, {
			stripeEventId: 'evt_updated_after_failure',
			stripeEventCreatedAt: new Date(3_000_000),
			stripeEventType: 'customer.subscription.updated',
			desiredAccess: 'ALLOWED',
			stripeSubscriptionId: 'sub_123',
		}),
		{ apply: false, reason: 'payment_confirmation_required' },
	)

	assert.equal(shouldApplyMightyStripeEvent(failed, {
		stripeEventId: 'evt_recovered',
		stripeEventCreatedAt: new Date(3_000_000),
		stripeEventType: 'invoice.paid',
		desiredAccess: 'ALLOWED',
		stripeSubscriptionId: 'sub_123',
	}).apply, true)

	assert.equal(shouldApplyMightyStripeEvent({
		...failed,
		lastStripeEventType: 'customer.subscription.deleted',
	}, {
		stripeEventId: 'evt_late_paid',
		stripeEventCreatedAt: new Date(4_000_000),
		stripeEventType: 'invoice.paid',
		desiredAccess: 'ALLOWED',
		stripeSubscriptionId: 'sub_123',
	}).reason, 'ended_subscription_cannot_restore')
})

test('same-second lifecycle events fail closed when precedence is ambiguous', () => {
	const allowed = {
		lastStripeEventId: 'evt_allowed',
		lastStripeEventCreatedAt: new Date(2_000_000),
		lastStripeEventType: 'invoice.paid',
		stripeSubscriptionId: 'sub_123',
	}

	assert.equal(shouldApplyMightyStripeEvent(allowed, {
		stripeEventId: 'evt_failed',
		stripeEventCreatedAt: new Date(2_000_000),
		stripeEventType: 'invoice.payment_failed',
		desiredAccess: 'DENIED',
		stripeSubscriptionId: 'sub_123',
	}).apply, true)
	assert.equal(shouldApplyMightyStripeEvent(allowed, {
		stripeEventId: 'evt_older_allowed',
		stripeEventCreatedAt: new Date(2_000_000),
		stripeEventType: 'checkout.session.completed',
		desiredAccess: 'ALLOWED',
		stripeSubscriptionId: 'sub_123',
	}).apply, false)
})

test('worker retry backoff is exponential and capped', () => {
	assert.equal(mightyRetryDelayMs(1), 2 * 60 * 1000)
	assert.equal(mightyRetryDelayMs(3), 8 * 60 * 1000)
	assert.equal(mightyRetryDelayMs(99), 60 * 60 * 1000)
})
