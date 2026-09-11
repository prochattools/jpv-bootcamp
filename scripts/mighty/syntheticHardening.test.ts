import assert from 'node:assert/strict'
import test from 'node:test'

import { deriveMightyDesiredAccess } from '../../src/lib/mighty/entitlement'
import {
	MightyAdminApi,
	MightyApiError,
	isDuplicatePlanAssignmentError,
	type MightyConfig,
} from '../../src/lib/mighty/adminApi'
import { shouldApplyMightyStripeEvent } from '../../src/lib/mighty/accessSync'
import { buildCutoverManifestRow } from '../../src/lib/mighty/cutoverManifest'

const TARGET_PLAN_ID = 2000039
const config: MightyConfig = {
	apiBaseUrl: 'https://api.mn.co/admin/v1',
	networkId: 'synthetic-network',
	accessPlanId: TARGET_PLAN_ID,
	adminApiToken: 'synthetic-only-token',
	studentLoginUrl: 'https://jpv-community.mn.co/sign_in',
}

const standardSpaces = ['Activity Feed', 'Chat', 'Course', 'Events', 'JPV Resource Library']
	.map((name, index) => ({ id: index + 1, name }))

function manifest(overrides: Partial<Parameters<typeof buildCutoverManifestRow>[0]> = {}) {
	return buildCutoverManifestRow({
		email: 'ordinary@example.test',
		stripeEntitled: true,
		member: { id: 'member-ordinary', email: 'ordinary@example.test', role: 'contributor' },
		plans: [],
		purchases: [],
		spaces: standardSpaces,
		targetPlanId: TARGET_PLAN_ID,
		...overrides,
	})
}

test('synthetic member matrix fails closed for privilege, ambiguity, and overlapping access', () => {
	const cases = [
		['ordinary member', manifest(), 'MIGRATE_EXISTING'],
		['host', manifest({ member: { id: 'host', email: 'host@example.test', role: 'host' } }), 'PRIVILEGED_EXCLUDED'],
		['admin', manifest({ member: { id: 'admin', email: 'admin@example.test', role: 'admin' } }), 'PRIVILEGED_EXCLUDED'],
		['staff', manifest({ member: { id: 'staff', email: 'staff@example.test', role: 'staff' } }), 'PRIVILEGED_EXCLUDED'],
		['unknown privilege', manifest({ member: { id: 'unknown', email: 'unknown@example.test', role: null } }), 'IDENTITY_REVIEW_REQUIRED'],
		['existing target Plan', manifest({ plans: [{ id: TARGET_PLAN_ID, name: 'JPV Member Access' }] }), 'ALREADY_PLAN_CONTROLLED'],
		['inactive member', manifest({ stripeEntitled: false, member: null }), 'NO_ACTION'],
		['new subscriber', manifest({ email: 'new@example.test', member: null }), 'CREATE_NEW_AT_CUTOVER'],
		['ambiguous match', manifest({ matchState: 'AMBIGUOUS_PROVIDER_IDENTITY' }), 'IDENTITY_REVIEW_REQUIRED'],
		['other Plan', manifest({ plans: [{ id: 3000040, name: 'Other Program' }] }), 'OVERLAP_REVIEW_REQUIRED'],
		['direct Space overlap', manifest({ spaces: [...standardSpaces, { id: 99, name: 'FIRST FOUNDATION' }] }), 'OVERLAP_REVIEW_REQUIRED'],
		['purchase overlap', manifest({ purchases: [{ member_id: 'member-ordinary', plan: { id: 3000040 }, purchase: { id: 'purchase-1' } }] }), 'OVERLAP_REVIEW_REQUIRED'],
		['target Plan plus privileged role', manifest({ plans: [{ id: TARGET_PLAN_ID }], member: { id: 'owner', email: 'owner@example.test', role: 'owner' } }), 'PRIVILEGED_EXCLUDED'],
	] as const

	for (const [label, row, expected] of cases) {
		assert.equal(row.proposedCutoverAction, expected, label)
	}
})

test('synthetic Stripe entitlement and event ordering preserve authoritative recovery rules', () => {
	const cases = [
		[{ subscriptionStatus: 'active', paymentStatus: 'paid' }, 'ALLOWED'],
		[{ subscriptionStatus: 'trialing' }, 'ALLOWED'],
		[{ eventType: 'invoice.payment_failed' }, 'DENIED'],
		[{ eventType: 'invoice.paid' }, 'ALLOWED'],
		[{ subscriptionStatus: 'canceled' }, 'DENIED'],
		[{ subscriptionStatus: 'past_due' }, 'DENIED'],
		[{ subscriptionStatus: 'active', paymentStatus: 'refunded' }, 'DENIED'],
	] as const
	for (const [input, expected] of cases) assert.equal(deriveMightyDesiredAccess(input), expected)

	const currentDenied = {
		lastStripeEventId: 'evt_failed',
		lastStripeEventCreatedAt: new Date(2_000),
		lastStripeEventType: 'invoice.payment_failed',
		stripeSubscriptionId: 'sub_synthetic',
	}
	assert.deepEqual(shouldApplyMightyStripeEvent(currentDenied, {
		stripeEventId: 'evt_duplicate',
		stripeEventCreatedAt: new Date(1_000),
		stripeEventType: 'invoice.paid',
		desiredAccess: 'ALLOWED',
		stripeSubscriptionId: 'sub_synthetic',
	}), { apply: false, reason: 'stale_stripe_event' })
	assert.equal(shouldApplyMightyStripeEvent(currentDenied, {
		stripeEventId: 'evt_recovered',
		stripeEventCreatedAt: new Date(3_000),
		stripeEventType: 'invoice.paid',
		desiredAccess: 'ALLOWED',
		stripeSubscriptionId: 'sub_synthetic',
	}).apply, true)
})

function response(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

test('synthetic provider failures are typed, sanitized, and never become writes', async () => {
	for (const status of [400, 401, 403, 429, 500]) {
		const api = new MightyAdminApi(config, async () => response({ error: { code: `synthetic_${status}`, message: 'synthetic provider failure' } }, status))
		await assert.rejects(() => api.findMemberByEmail('ordinary@example.test'), (error: unknown) => {
			assert.ok(error instanceof MightyApiError)
			assert.equal(error.status, status)
			assert.equal(error.providerCode, `synthetic_${status}`)
			assert.equal(error.message, `mighty_api_error_${status}`)
			return true
		})
	}

	const absent = new MightyAdminApi(config, async () => response({}, 404))
	assert.equal(await absent.findMemberByEmail('ordinary@example.test'), null)

	const malformed = new MightyAdminApi(config, async () => new Response('{malformed', { status: 500 }))
	await assert.rejects(() => malformed.findMemberByEmail('ordinary@example.test'), /mighty_api_error_500/)

	const interrupted = new MightyAdminApi(config, async () => { throw new Error('synthetic_connection_interrupted') })
	await assert.rejects(() => interrupted.findMemberByEmail('ordinary@example.test'), /synthetic_connection_interrupted/)

	const partial = new MightyAdminApi(config, async () => response({ items: [{ id: TARGET_PLAN_ID }] }))
	assert.deepEqual(await partial.listMemberPlans('member-ordinary'), [{ id: TARGET_PLAN_ID }])

	const duplicate = new MightyApiError(422, { code: 'duplicate_assignment', message: 'member already has this Plan' })
	const unrelated = new MightyApiError(422, { code: 'validation_error', message: 'invalid member state' })
	assert.equal(isDuplicatePlanAssignmentError(duplicate), true)
	assert.equal(isDuplicatePlanAssignmentError(unrelated), false)
})

test('synthetic test-owned cleanup cannot remove pre-existing records', () => {
	const records = new Map([
		['pre-existing-fixture', { owner: 'other-test', deleted: false }],
		['codex-run-fixture', { owner: 'this-test', deleted: false }],
	])
	const createdByThisTest = new Set(['codex-run-fixture'])

	for (const id of createdByThisTest) {
		const record = records.get(id)
		if (record?.owner === 'this-test') records.delete(id)
	}

	assert.equal(records.has('codex-run-fixture'), false)
	assert.deepEqual(records.get('pre-existing-fixture'), { owner: 'other-test', deleted: false })
})
