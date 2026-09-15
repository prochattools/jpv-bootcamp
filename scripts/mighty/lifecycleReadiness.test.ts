import assert from 'node:assert/strict'
import test from 'node:test'
import type Stripe from 'stripe'

import { buildMightyAccessReadyEmailContent } from '../../src/lib/mighty/accessReadyEmail'
import {
	projectMightyAccessFromStripeEvent,
	reconcileAccess,
	shouldApplyMightyStripeEvent,
} from '../../src/lib/mighty/accessSync'
import type { MightyAdminApi, MightyMember } from '../../src/lib/mighty/adminApi'
import { deriveMightyDesiredAccess } from '../../src/lib/mighty/entitlement'
import type { MightyConfig } from '../../src/lib/mighty/config'
import { getMightyMutationScope } from '../../src/lib/mighty/mutationPolicy'
import {
	BILLING_PAYMENT_FAILED_TEMPLATE_KEY,
	getSystemEmailTemplate,
} from '../../src/lib/payloadCourse/systemEmailTemplates'

const config: MightyConfig = {
	apiBaseUrl: 'https://api.mn.co/admin/v1',
	networkId: '12345',
	accessPlanId: 2000039,
	adminApiToken: 'synthetic-token',
	studentLoginUrl: 'https://jpv-community.mn.co/sign_in',
}

type ProviderState = {
	member: MightyMember | null
	hasPlan: boolean
	createCalls: number
	grantCalls: number
	revokeCalls: number
}

function provider(state: ProviderState): MightyAdminApi {
	return {
		findMember: async () => state.member,
		findMemberByEmail: async () => state.member,
		createMember: async ({ email }) => {
			state.createCalls += 1
			state.member = { id: 'm-new', email, role: 'contributor', member_type: 'full' }
			return state.member
		},
		findPurchases: async () => [],
		listMemberPlans: async () => state.hasPlan ? [{ id: 2000039, name: 'JPV Member Access' }] : [],
		listMemberSpaces: async () => [],
		getAccessState: async () => ({
			memberId: String(state.member?.id ?? 'm-new'),
			planId: '2000039',
			purchases: [],
			plans: state.hasPlan ? [{ id: 2000039, name: 'JPV Member Access' }] : [],
			memberPlanAccess: state.hasPlan,
			hasAccess: state.hasPlan,
		}),
		grantAccess: async () => {
			state.grantCalls += 1
			state.hasPlan = true
			return { id: 2000039, name: 'JPV Member Access' }
		},
		restoreAccess: async () => {
			state.grantCalls += 1
			state.hasPlan = true
			return { id: 2000039, name: 'JPV Member Access' }
		},
		revokeAccess: async () => {
			state.revokeCalls += 1
			state.hasPlan = false
			return null
		},
		revokePlanAccess: async () => {
			state.revokeCalls += 1
			state.hasPlan = false
			return null
		},
	} as unknown as MightyAdminApi
}

function event(type: string, object: Record<string, unknown>, id = `evt_${type}`): Stripe.Event {
	return {
		id,
		created: 1_780_000_000,
		livemode: false,
		type,
		data: { object },
	} as unknown as Stripe.Event
}

function row(overrides: Record<string, unknown> = {}) {
	return {
		id: 'sync-1',
		email: 'member-a@example.test',
		normalizedEmail: 'member-a@example.test',
		stripeCustomerId: 'cus_member_a',
		stripeSubscriptionId: 'sub_member_a',
		lastStripeEventId: 'evt_member_a',
		lastStripeEventCreatedAt: new Date(),
		lastStripeEventType: 'customer.subscription.created',
		plan: 'jpv_bootcamp_membership',
		desiredAccess: 'ALLOWED',
		mightyMemberId: null,
		mightyPurchaseId: null,
		welcomeRequired: false,
		welcomeSentAt: null,
		attemptCount: 0,
		...overrides,
	} as Parameters<typeof reconcileAccess>[0]['row']
}

const ordinaryScope = getMightyMutationScope({
	MIGHTY_PROVIDER_ENV: 'staging',
	MIGHTY_STAGING_ALLOW_API_MUTATIONS: 'true',
	MIGHTY_ACCESS_SYNC_MUTATION_ALLOWLIST: 'member-a@example.test,member-b@example.test,member-c@example.test',
	MIGHTY_ALLOW_NEW_MEMBER_CREATION: 'true',
	MIGHTY_IDENTITY_ROLE_OVERRIDES: 'member-a@example.test:ordinary,member-b@example.test:ordinary,member-c@example.test:ordinary',
})

test('coupon and lifecycle fixtures use subscription truth, not amount paid', () => {
	for (const input of [
		{ subscriptionStatus: 'active', paymentStatus: 'paid' },
		{ subscriptionStatus: 'active', paymentStatus: 'paid', checkoutPaymentStatus: 'no_payment_required' },
		{ subscriptionStatus: 'active', paymentStatus: 'paid', checkoutPaymentStatus: 'paid' },
		{ subscriptionStatus: 'trialing', paymentStatus: 'paid' },
	]) {
		assert.equal(deriveMightyDesiredAccess(input), 'ALLOWED')
	}
	assert.equal(deriveMightyDesiredAccess({ subscriptionStatus: 'canceled', paymentStatus: 'paid' }), 'DENIED')
	assert.equal(deriveMightyDesiredAccess({ subscriptionStatus: 'active', paymentStatus: 'failed' }), 'DENIED')
})

test('synthetic new subscriber receives one Mighty-ready message and resumes without duplication', async () => {
	const state: ProviderState = { member: null, hasPlan: false, createCalls: 0, grantCalls: 0, revokeCalls: 0 }
	const outbox: string[] = []
	const projection = projectMightyAccessFromStripeEvent(event('checkout.session.completed', {
		mode: 'subscription',
		payment_status: 'no_payment_required',
		customer_email: 'member-a@example.test',
		customer: 'cus_member_a',
		subscription: 'sub_member_a',
	}))
	assert.equal(projection?.desiredAccess, 'ALLOWED')

	const first = await reconcileAccess({
		row: row({ welcomeRequired: true }),
		config,
		api: provider(state),
		mutationScope: ordinaryScope,
		sendWelcome: async () => { outbox.push('mighty-access-ready') },
	})
	assert.equal(first.mightyMemberId, 'm-new')
	assert.equal(state.createCalls, 1)
	assert.equal(state.grantCalls, 1)
	assert.deepEqual(outbox, ['mighty-access-ready'])

	await reconcileAccess({
		row: row({ mightyMemberId: first.mightyMemberId, welcomeRequired: true, welcomeSentAt: new Date() }),
		config,
		api: provider(state),
		mutationScope: ordinaryScope,
		sendWelcome: async () => { outbox.push('duplicate') },
	})
	assert.equal(state.createCalls, 1)
	assert.equal(state.grantCalls, 1)
	assert.deepEqual(outbox, ['mighty-access-ready'])
})

test('payment failure, recovery, and cancellation converge the same Mighty identity', async () => {
	const state: ProviderState = {
		member: { id: 'm-existing', email: 'member-b@example.test', role: 'contributor' },
		hasPlan: true,
		createCalls: 0,
		grantCalls: 0,
		revokeCalls: 0,
	}
	const api = provider(state)
	const failed = projectMightyAccessFromStripeEvent(event('invoice.payment_failed', {
		customer: 'cus_member_b', subscription: 'sub_member_b',
	}))
	assert.equal(failed?.desiredAccess, 'DENIED')
	await reconcileAccess({ row: row({ email: 'member-b@example.test', normalizedEmail: 'member-b@example.test', mightyMemberId: 'm-existing', desiredAccess: 'DENIED', stripeCustomerId: 'cus_member_b', stripeSubscriptionId: 'sub_member_b' }), config, api, mutationScope: ordinaryScope })
	assert.equal(state.revokeCalls, 1)

	const recovered = projectMightyAccessFromStripeEvent(event('invoice.paid', {
		customer: 'cus_member_b', subscription: 'sub_member_b',
	}))
	assert.equal(recovered?.desiredAccess, 'ALLOWED')
	await reconcileAccess({ row: row({ email: 'member-b@example.test', normalizedEmail: 'member-b@example.test', mightyMemberId: 'm-existing', stripeCustomerId: 'cus_member_b', stripeSubscriptionId: 'sub_member_b', desiredAccess: 'ALLOWED' }), config, api, mutationScope: ordinaryScope })
	assert.equal(state.member?.id, 'm-existing')
	assert.equal(state.grantCalls, 1)

	const canceled = projectMightyAccessFromStripeEvent(event('customer.subscription.deleted', {
		id: 'sub_member_b', customer: 'cus_member_b', status: 'canceled',
	}))
	assert.equal(canceled?.desiredAccess, 'DENIED')
})

test('privileged and unknown identities fail closed during billing reconciliation', async () => {
	for (const role of ['administrator', 'staff', 'owner']) {
		const state: ProviderState = {
			member: { id: `m-${role}`, email: `${role}@example.test`, role },
			hasPlan: true,
			createCalls: 0,
			grantCalls: 0,
			revokeCalls: 0,
		}
		const scope = getMightyMutationScope({
			MIGHTY_PROVIDER_ENV: 'staging',
			MIGHTY_STAGING_ALLOW_API_MUTATIONS: 'true',
			MIGHTY_ACCESS_SYNC_MUTATION_ALLOWLIST: `${role}@example.test`,
		})
		await assert.doesNotReject(() => reconcileAccess({
			row: row({ email: `${role}@example.test`, normalizedEmail: `${role}@example.test`, mightyMemberId: `m-${role}`, desiredAccess: 'DENIED' }),
			config,
			api: provider(state),
			mutationScope: scope,
		}))
		assert.equal(state.revokeCalls, 0)
	}

	const unknownState: ProviderState = {
		member: { id: 'm-unknown', email: 'unknown@example.test', role: null },
		hasPlan: true,
		createCalls: 0,
		grantCalls: 0,
		revokeCalls: 0,
	}
	const unknownScope = getMightyMutationScope({
		MIGHTY_PROVIDER_ENV: 'staging',
		MIGHTY_STAGING_ALLOW_API_MUTATIONS: 'true',
		MIGHTY_ACCESS_SYNC_MUTATION_ALLOWLIST: 'unknown@example.test',
	})
	await assert.rejects(() => reconcileAccess({
		row: row({ email: 'unknown@example.test', normalizedEmail: 'unknown@example.test', mightyMemberId: 'm-unknown', desiredAccess: 'DENIED' }),
		config,
		api: provider(unknownState),
		mutationScope: unknownScope,
	}), /mighty_identity_review_required/)
	assert.equal(unknownState.revokeCalls, 0)
})

test('onboarding and payment-failure copy render the exact safe meaning and links', () => {
	const onboarding = buildMightyAccessReadyEmailContent({
		email: 'member-a@example.test',
		loginUrl: 'https://jpv-community.mn.co/sign_in',
		from: 'support@example.test',
		replyTo: 'support@example.test',
	})
	assert.match(onboarding.text, /membership is ready/i)
	assert.match(onboarding.text, /jpv-community\.mn\.co\/sign_in/)
	assert.match(onboarding.text, /member-a@example\.test/)
	assert.match(onboarding.text, /first-time authentication/i)
	assert.doesNotMatch(onboarding.text, /reset your password|jpvbootcamp\.com\/portal/i)
	assert.match(onboarding.html, /jpv-community\.mn\.co\/sign_in/)
	assert.doesNotMatch(onboarding.html, /reset your password|forgot password/i)

	const failed = getSystemEmailTemplate(BILLING_PAYMENT_FAILED_TEMPLATE_KEY)
	assert.ok(failed)
	assert.match(String(failed.textBody), /access has been paused/i)
	assert.match(String(failed.textBody), /restored automatically/i)
	assert.match(String(failed.textBody), /\{\{billingUrl\}\}/)
})

test('replayed events are idempotent and stale workers cannot overwrite recovery', () => {
	const existing = {
		lastStripeEventId: 'evt_paid',
		lastStripeEventCreatedAt: new Date(2_000),
		lastStripeEventType: 'invoice.paid',
		stripeSubscriptionId: 'sub_member_c',
	}
	assert.deepEqual(shouldApplyMightyStripeEvent(existing, {
		stripeEventId: 'evt_paid',
		stripeEventCreatedAt: new Date(2_000),
		stripeEventType: 'invoice.paid',
		desiredAccess: 'ALLOWED',
		stripeSubscriptionId: 'sub_member_c',
	}), { apply: false, reason: 'duplicate_stripe_event' })
	assert.deepEqual(shouldApplyMightyStripeEvent(existing, {
		stripeEventId: 'evt_old_failed',
		stripeEventCreatedAt: new Date(1_000),
		stripeEventType: 'invoice.payment_failed',
		desiredAccess: 'DENIED',
		stripeSubscriptionId: 'sub_member_c',
	}), { apply: false, reason: 'stale_stripe_event' })
})

console.log('Mighty lifecycle readiness tests passed')
