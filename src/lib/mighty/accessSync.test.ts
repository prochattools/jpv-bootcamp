import assert from 'node:assert/strict'
import test from 'node:test'

import { reconcileAccess } from './accessSync'
import type { MightyAdminApi, MightyMember } from './adminApi'
import type { MightyConfig } from './config'

const config: MightyConfig = {
	apiBaseUrl: 'https://api.mn.co/admin/v1',
	networkId: '12345',
	accessPlanId: 678,
	adminApiToken: 'test-token',
	studentLoginUrl: 'https://jpv-community.mn.co/sign_in',
}

type FakeState = {
	member: MightyMember | null
	purchases: Array<{ purchase?: { id?: number | string | null } }>
	memberPlanAccess: boolean
	findMemberCalls: number
	createMemberCalls: number
	grantCalls: number
	revokeCalls: string[]
	revokePlanCalls: string[]
}

function fakeApi(state: FakeState): MightyAdminApi {
	return {
		findMember: async () => {
			state.findMemberCalls += 1
			return state.member
		},
		createMember: async ({ email }) => {
			state.createMemberCalls += 1
			state.member = { id: 22, email }
			return state.member
		},
		findPurchases: async () => state.purchases,
		getAccessState: async () => ({
			memberId: '22',
			planId: '678',
			purchases: state.purchases,
			memberPlanAccess: state.memberPlanAccess,
			hasAccess: state.memberPlanAccess || state.purchases.length > 0,
		}),
		grantAccess: async () => {
			state.grantCalls += 1
			state.purchases = [{ purchase: { id: 'purchase-1' } }]
			return { id: 678 }
		},
		restoreAccess: async () => {
			state.grantCalls += 1
			state.purchases = [{ purchase: { id: 'purchase-1' } }]
			return { id: 678 }
		},
		revokeAccess: async (purchaseId) => {
			state.revokeCalls.push(String(purchaseId))
			state.purchases = []
			return null
		},
		revokePlanAccess: async () => {
			state.revokePlanCalls.push('678')
			state.memberPlanAccess = false
			return null
		},
	} as unknown as MightyAdminApi
}

function row(overrides: Partial<Parameters<typeof reconcileAccess>[0]['row']> = {}) {
	return {
		id: 'sync-1',
		email: 'student@example.com',
		normalizedEmail: 'student@example.com',
		stripeCustomerId: 'cus_1',
		stripeSubscriptionId: 'sub_1',
		lastStripeEventId: 'evt_1',
		plan: 'jpv_bootcamp_membership',
		desiredAccess: 'ALLOWED',
		mightyMemberId: null,
		mightyPurchaseId: null,
		welcomeRequired: true,
		welcomeSentAt: null,
		attemptCount: 0,
		...overrides,
	} as Parameters<typeof reconcileAccess>[0]['row']
}

test('allowed reconciliation reuses an existing Mighty member, grants once, then sends welcome', async () => {
	const state: FakeState = {
		member: { id: 22, email: 'student@example.com' },
		purchases: [],
		memberPlanAccess: false,
		findMemberCalls: 0,
		createMemberCalls: 0,
		grantCalls: 0,
		revokeCalls: [],
		revokePlanCalls: [],
	}
	let welcomeCalls = 0

	const result = await reconcileAccess({
		row: row(),
		config,
		api: fakeApi(state),
		sendWelcome: async () => {
			welcomeCalls += 1
		},
	})

	assert.equal(state.findMemberCalls, 1)
	assert.equal(state.createMemberCalls, 0)
	assert.equal(state.grantCalls, 1)
	assert.equal(welcomeCalls, 1)
	assert.equal(result.mightyMemberId, '22')
	assert.equal(result.mightyPurchaseId, 'purchase-1')
})

test('allowed reconciliation does not duplicate an existing Mighty purchase', async () => {
	const state: FakeState = {
		member: { id: 22, email: 'student@example.com' },
		purchases: [{ purchase: { id: 'purchase-existing' } }],
		memberPlanAccess: false,
		findMemberCalls: 0,
		createMemberCalls: 0,
		grantCalls: 0,
		revokeCalls: [],
		revokePlanCalls: [],
	}

	const result = await reconcileAccess({ row: row({ welcomeRequired: false }), config, api: fakeApi(state) })
	assert.equal(state.grantCalls, 0)
		assert.equal(result.mightyPurchaseId, 'purchase-existing')
})

test('denied reconciliation removes every matching purchase immediately and is a no-op when absent', async () => {
	const state: FakeState = {
		member: { id: 22, email: 'student@example.com' },
		purchases: [{ purchase: { id: 'purchase-1' } }, { purchase: { id: 'purchase-2' } }],
		memberPlanAccess: false,
		findMemberCalls: 0,
		createMemberCalls: 0,
		grantCalls: 0,
		revokeCalls: [],
		revokePlanCalls: [],
	}

	const result = await reconcileAccess({
		row: row({ desiredAccess: 'DENIED', welcomeRequired: false }),
		config,
		api: fakeApi(state),
	})

	assert.deepEqual(state.revokeCalls, ['purchase-1', 'purchase-2'])
	assert.equal(result.mightyPurchaseId, null)
})

test('denied reconciliation removes direct nonpaid plan access', async () => {
	const state: FakeState = {
		member: { id: 22, email: 'student@example.com' },
		purchases: [],
		memberPlanAccess: true,
		findMemberCalls: 0,
		createMemberCalls: 0,
		grantCalls: 0,
		revokeCalls: [],
		revokePlanCalls: [],
	}

	await reconcileAccess({
		row: row({ desiredAccess: 'DENIED', welcomeRequired: false }),
		config,
		api: fakeApi(state),
	})

	assert.deepEqual(state.revokePlanCalls, ['678'])
	assert.equal(state.memberPlanAccess, false)
})
