import assert from 'node:assert/strict'
import test from 'node:test'

import { reconcileAccess } from './accessSync'
import { MightyApiError, type MightyAdminApi, type MightyMember } from './adminApi'
import type { MightyConfig } from './config'
import { getMightyMutationScope } from './mutationPolicy'

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
		findMemberByEmail: async () => state.member,
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

test('allowed reconciliation creates an absent member before granting access', async () => {
	const state: FakeState = {
		member: null,
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
	assert.equal(state.createMemberCalls, 1)
	assert.equal(state.grantCalls, 1)
	assert.equal(welcomeCalls, 1)
	assert.equal(result.mightyMemberId, '22')
})

test('allowed recovery re-provisions the stored Mighty identity after Plan removal', async () => {
	let accessStateCalls = 0
	let createMemberCalls = 0
	let restoreCalls = 0
	let welcomeCalls = 0
	const api = {
		createMember: async ({ email }: { email: string }) => {
			createMemberCalls += 1
			return { id: 22, email }
		},
		getAccessState: async () => {
			accessStateCalls += 1
			return accessStateCalls === 1
				? { memberId: '22', planId: '678', purchases: [], memberPlanAccess: false, hasAccess: false }
				: { memberId: '22', planId: '678', purchases: [], memberPlanAccess: true, hasAccess: true }
		},
		restoreAccess: async () => {
			restoreCalls += 1
			if (restoreCalls === 1) throw new MightyApiError(404)
			return { id: 678 }
		},
	} as unknown as MightyAdminApi

	const result = await reconcileAccess({
		row: row({ mightyMemberId: '22', welcomeRequired: false }),
		config,
		api,
		sendWelcome: async () => {
			welcomeCalls += 1
		},
	})

	assert.equal(createMemberCalls, 1)
	assert.equal(restoreCalls, 2)
	assert.equal(welcomeCalls, 0)
	assert.equal(result.mightyMemberId, '22')
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

test('duplicate Plan 422 is accepted only after independent target-Plan verification', async () => {
	let reads = 0
	const api = {
		findMember: async () => ({ id: 22, email: 'student@example.com', member_type: 'full', role: 'contributor' }),
		getAccessState: async () => {
			reads += 1
			return {
				memberId: '22',
				planId: '678',
				purchases: [],
				plans: reads > 1 ? [{ id: 678 }] : [],
				memberPlanAccess: reads > 1,
				hasAccess: reads > 1,
			}
		},
		restoreAccess: async () => {
			throw new MightyApiError(422, { code: 'duplicate_assignment', message: 'member already has this Plan' })
		},
	} as unknown as MightyAdminApi

	await assert.doesNotReject(() => reconcileAccess({ row: row({ welcomeRequired: false }), config, api }))
	assert.equal(reads, 3)
})

test('unrelated Plan 422 remains a failure even when current access is absent', async () => {
	const api = {
		findMember: async () => ({ id: 22, email: 'student@example.com', member_type: 'full', role: 'contributor' }),
		getAccessState: async () => ({ memberId: '22', planId: '678', purchases: [], plans: [], memberPlanAccess: false, hasAccess: false }),
		restoreAccess: async () => {
			throw new MightyApiError(422, { code: 'validation_error', message: 'invalid member state' })
		},
	} as unknown as MightyAdminApi

	await assert.rejects(() => reconcileAccess({ row: row({ welcomeRequired: false }), config, api }), /mighty_api_error_422/)
})

test('production mutation scope rejects an identity outside the explicit test allowlist', async () => {
	const scope = getMightyMutationScope({
		MIGHTY_PROVIDER_ENV: 'production',
		MIGHTY_PRODUCTION_ALLOW_API_MUTATIONS: 'true',
		MIGHTY_PRODUCTION_TEST_EMAIL: 'authorized@example.com',
		MIGHTY_IDENTITY_ROLE_OVERRIDES: 'student@example.com:ordinary',
	})
	const state: FakeState = {
		member: { id: 22, email: 'student@example.com', role: 'contributor' },
		purchases: [],
		memberPlanAccess: false,
		findMemberCalls: 0,
		createMemberCalls: 0,
		grantCalls: 0,
		revokeCalls: [],
		revokePlanCalls: [],
	}
	await assert.rejects(
		() => reconcileAccess({ row: row({ welcomeRequired: false }), config, api: fakeApi(state), mutationScope: scope }),
		(error: unknown) => error instanceof Error && 'code' in error && (error as { code?: string }).code === 'mighty_mutation_scope_denied',
	)
	assert.equal(state.grantCalls, 0)
})

test('both authorized Host test accounts are protected from ordinary billing mutation', async () => {
	for (const email of ['steve@yeshua.academy', 'info@prochat.tools']) {
		const scope = getMightyMutationScope({
			MIGHTY_PROVIDER_ENV: 'production',
			MIGHTY_PRODUCTION_ALLOW_API_MUTATIONS: 'true',
			MIGHTY_PRODUCTION_TEST_EMAIL: email,
		})
		const state: FakeState = {
			member: { id: 22, email, role: null },
			purchases: [],
			memberPlanAccess: true,
			findMemberCalls: 0,
			createMemberCalls: 0,
			grantCalls: 0,
			revokeCalls: [],
			revokePlanCalls: [],
		}
		await assert.rejects(() => reconcileAccess({ row: row({ email, normalizedEmail: email, desiredAccess: 'DENIED', welcomeRequired: false }), config, api: fakeApi(state), mutationScope: scope }), /mighty_host_mutation_protected/)
		assert.equal(state.revokePlanCalls.length, 0)
	}
})
