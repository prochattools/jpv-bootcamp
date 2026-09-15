import assert from 'node:assert/strict'
import test from 'node:test'

import {
	MightyAccessSyncCheckpointError,
	normalizeMightyAccessSyncScope,
	projectMightyAccessFromStripeEvent,
	reconcileAccess,
	shouldApplyMightyOperatorBootstrap,
	shouldApplyMightyStripeEvent,
} from './accessSync'
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

const syntheticMutationScope = getMightyMutationScope({
	MIGHTY_PROVIDER_ENV: 'staging',
	MIGHTY_STAGING_ALLOW_API_MUTATIONS: 'true',
	MIGHTY_ACCESS_SYNC_MUTATION_ALLOWLIST: 'student@example.com',
	MIGHTY_ALLOW_NEW_MEMBER_CREATION: 'true',
	MIGHTY_IDENTITY_ROLE_OVERRIDES: 'student@example.com:ordinary',
})

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
	lastStripeEventCreatedAt: new Date(1_000),
	lastStripeEventType: 'invoice.paid',
	stateSource: 'stripe_webhook',
	stateObservedAt: new Date(1_000),
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
		mutationScope: syntheticMutationScope,
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

test('stored member ID cannot mask a returned email mismatch and no Plan read or mutation follows', async () => {
	const state: FakeState = {
		member: { id: 22, email: 'other@example.com' },
		purchases: [],
		memberPlanAccess: false,
		findMemberCalls: 0,
		createMemberCalls: 0,
		grantCalls: 0,
		revokeCalls: [],
		revokePlanCalls: [],
	}
	await assert.rejects(
		() => reconcileAccess({ row: row({ mightyMemberId: '22', welcomeRequired: false }), config, api: fakeApi(state), mutationScope: syntheticMutationScope }),
		(error: unknown) => error instanceof MightyAccessSyncCheckpointError && error.code === 'mighty_member_email_conflict',
	)
	assert.equal(state.createMemberCalls, 0)
	assert.equal(state.grantCalls, 0)
})

test('masked exact-lookup identity can proceed through access sync without changing provider email', async () => {
	const state: FakeState = {
		member: {
			id: 41580317,
			email: '',
			identityEvidence: { source: 'exact_by_email_lookup', requestedEmail: 'student@example.com' },
		},
		purchases: [],
		memberPlanAccess: false,
		findMemberCalls: 0,
		createMemberCalls: 0,
		grantCalls: 0,
		revokeCalls: [],
		revokePlanCalls: [],
	}
	const result = await reconcileAccess({ row: row({ email: 'student@example.com', normalizedEmail: 'student@example.com', welcomeRequired: false }), config, api: fakeApi(state), mutationScope: syntheticMutationScope })
	assert.equal(result.mightyMemberId, '41580317')
	assert.equal(state.grantCalls, 1)
	assert.equal(state.member?.email, '')
})

test('masked member without exact-lookup evidence stops before Plan access', async () => {
	const state: FakeState = {
		member: { id: 41580317, email: '' },
		purchases: [],
		memberPlanAccess: false,
		findMemberCalls: 0,
		createMemberCalls: 0,
		grantCalls: 0,
		revokeCalls: [],
		revokePlanCalls: [],
	}
	await assert.rejects(
		() => reconcileAccess({ row: row({ welcomeRequired: false }), config, api: fakeApi(state), mutationScope: syntheticMutationScope }),
		/error|mighty_member_email_conflict/,
	)
	assert.equal(state.grantCalls, 0)
})

test('stored member ID conflict remains fail-closed before Plan access', async () => {
	const state: FakeState = {
		member: {
			id: 99,
			email: '',
			identityEvidence: { source: 'exact_by_email_lookup', requestedEmail: 'student@example.com' },
		},
		purchases: [],
		memberPlanAccess: false,
		findMemberCalls: 0,
		createMemberCalls: 0,
		grantCalls: 0,
		revokeCalls: [],
		revokePlanCalls: [],
	}
	await assert.rejects(
		() => reconcileAccess({ row: row({ mightyMemberId: '41580317', welcomeRequired: false }), config, api: fakeApi(state), mutationScope: syntheticMutationScope }),
		(error: unknown) => error instanceof MightyAccessSyncCheckpointError && error.code === 'mighty_member_identity_conflict',
	)
	assert.equal(state.grantCalls, 0)
})

test('new-member email mismatch stops before Plan grant', async () => {
	let grantCalls = 0
	const api = {
		findMember: async () => null,
		createMember: async () => ({ id: 22, email: 'other@example.com' }),
		getAccessState: async () => { throw new Error('Plan state must not be read after identity mismatch') },
		restoreAccess: async () => { grantCalls += 1; return { id: 678 } },
	} as unknown as MightyAdminApi

	await assert.rejects(
		() => reconcileAccess({ row: row({ welcomeRequired: false }), config, api, mutationScope: syntheticMutationScope }),
		(error: unknown) => error instanceof MightyAccessSyncCheckpointError && error.code === 'mighty_member_email_conflict',
	)
	assert.equal(grantCalls, 0)
})

test('422 recovery email mismatch stops before Plan grant', async () => {
	let findCalls = 0
	let grantCalls = 0
	const api = {
		findMember: async () => {
			findCalls += 1
			return findCalls === 1 ? null : { id: 22, email: 'other@example.com' }
		},
		createMember: async () => { throw new MightyApiError(422, { code: 'duplicate_assignment' }) },
		getAccessState: async () => { throw new Error('Plan state must not be read after recovery identity mismatch') },
		restoreAccess: async () => { grantCalls += 1; return { id: 678 } },
	} as unknown as MightyAdminApi

	await assert.rejects(
		() => reconcileAccess({ row: row({ welcomeRequired: false }), config, api, mutationScope: syntheticMutationScope }),
		(error: unknown) => error instanceof MightyAccessSyncCheckpointError && error.code === 'mighty_member_email_conflict',
	)
	assert.equal(grantCalls, 0)
})

test('422 recovery accepts a masked exact-lookup member only after ID-bound lookup evidence', async () => {
	let findCalls = 0
	let grantCalls = 0
	let accessStateCalls = 0
	const api = {
		findMember: async () => {
			findCalls += 1
			return findCalls === 1 ? null : {
				id: 41580317,
				email: '',
				identityEvidence: { source: 'exact_by_email_lookup' as const, requestedEmail: 'student@example.com' },
			}
		},
		createMember: async () => { throw new MightyApiError(422, { code: 'duplicate_assignment' }) },
		getAccessState: async () => {
			accessStateCalls += 1
			return { memberId: '41580317', planId: '678', purchases: [], plans: accessStateCalls > 1 ? [{ id: 678 }] : [], memberPlanAccess: accessStateCalls > 1, hasAccess: accessStateCalls > 1 }
		},
		restoreAccess: async () => { grantCalls += 1; return { id: 678 } },
	} as unknown as MightyAdminApi

	const result = await reconcileAccess({ row: row({ welcomeRequired: false }), config, api, mutationScope: syntheticMutationScope })
	assert.equal(result.mightyMemberId, '41580317')
	assert.equal(findCalls, 2)
	assert.equal(grantCalls, 1)
})

test('denied reconciliation rejects an email mismatch before access reads or revocation', async () => {
	const state: FakeState = {
		member: { id: 22, email: 'other@example.com' },
		purchases: [{ purchase: { id: 'purchase-1' } }],
		memberPlanAccess: true,
		findMemberCalls: 0,
		createMemberCalls: 0,
		grantCalls: 0,
		revokeCalls: [],
		revokePlanCalls: [],
	}
	await assert.rejects(
		() => reconcileAccess({ row: row({ desiredAccess: 'DENIED', mightyMemberId: '22', welcomeRequired: false }), config, api: fakeApi(state), mutationScope: syntheticMutationScope }),
		/error|mighty_member_email_conflict/,
	)
	assert.deepEqual(state.revokeCalls, [])
	assert.deepEqual(state.revokePlanCalls, [])
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
		mutationScope: syntheticMutationScope,
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

test('late reconciliation failure checkpoints the newly-created member for safe resume', async () => {
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
	let firstGrant = true
	const api = {
		...fakeApi(state),
		restoreAccess: async () => {
			state.grantCalls += 1
			if (firstGrant) {
				firstGrant = false
				throw new Error('synthetic_provider_timeout')
			}
			state.purchases = [{ purchase: { id: 'purchase-1' } }]
			return { id: 678 }
		},
	} as unknown as MightyAdminApi

	let checkpoint: MightyAccessSyncCheckpointError | null = null
	await assert.rejects(
		() => reconcileAccess({ row: row({ welcomeRequired: false }), config, api, mutationScope: syntheticMutationScope }),
		(error: unknown) => {
			checkpoint = error instanceof MightyAccessSyncCheckpointError ? error : null
			return checkpoint !== null
		},
	)
	assert.equal(checkpoint?.mightyMemberId, '22')
	assert.equal(state.createMemberCalls, 1)

	const resumed = await reconcileAccess({
		row: row({ mightyMemberId: checkpoint?.mightyMemberId, welcomeRequired: false }),
		config,
		api,
		mutationScope: syntheticMutationScope,
	})
	assert.equal(resumed.mightyMemberId, '22')
	assert.equal(state.createMemberCalls, 1)
})

test('worker scope normalization is explicit, unique, and limited to the allowed set', () => {
	const allowed = new Set(['student@example.com', 'second@example.com'])
	assert.deepEqual(normalizeMightyAccessSyncScope([' Student@Example.com '], allowed), ['student@example.com'])
	assert.throws(() => normalizeMightyAccessSyncScope([], allowed), /mighty_worker_scope_invalid/)
	assert.throws(() => normalizeMightyAccessSyncScope(['student@example.com', 'student@example.com'], allowed), /mighty_worker_scope_duplicate/)
	assert.throws(
		() => normalizeMightyAccessSyncScope(['outside@example.com'], allowed),
		(error: unknown) => error instanceof Error && 'code' in error && (error as { code?: string }).code === 'mighty_worker_scope_denied',
	)
})

test('operator bootstrap is idempotent at the same observation and cannot regress newer state', () => {
	const existing = {
		lastStripeEventId: null,
		lastStripeEventCreatedAt: null,
		lastStripeEventType: null,
		stateSource: 'operator_bootstrap',
		stateObservedAt: new Date(2_000),
		stripeSubscriptionId: 'sub_1',
	}
	assert.deepEqual(shouldApplyMightyOperatorBootstrap(existing, {
		stateObservedAt: new Date(2_000),
		desiredAccess: 'ALLOWED',
		stripeCustomerId: 'cus_1',
		stripeSubscriptionId: 'sub_1',
		plan: 'jpv_bootcamp_membership',
	}), { apply: false, reason: 'duplicate_operator_bootstrap' })
	assert.deepEqual(shouldApplyMightyOperatorBootstrap(existing, {
		stateObservedAt: new Date(1_000),
		desiredAccess: 'DENIED',
		stripeCustomerId: 'cus_1',
		stripeSubscriptionId: 'sub_1',
		plan: 'jpv_bootcamp_membership',
	}), { apply: false, reason: 'stale_operator_bootstrap' })
})

test('a newer genuine Stripe event supersedes bootstrap and an older event cannot regress it', () => {
	const existing = {
		lastStripeEventId: null,
		lastStripeEventCreatedAt: null,
		lastStripeEventType: null,
		stateSource: 'operator_bootstrap',
		stateObservedAt: new Date(2_000),
		stripeSubscriptionId: 'sub_1',
	}
	assert.equal(shouldApplyMightyStripeEvent(existing, {
		stripeEventId: 'evt_new',
		stripeEventCreatedAt: new Date(3_000),
		stripeEventType: 'customer.subscription.updated',
		desiredAccess: 'DENIED',
		stripeSubscriptionId: 'sub_1',
	}).apply, true)
	assert.deepEqual(shouldApplyMightyStripeEvent(existing, {
		stripeEventId: 'evt_old',
		stripeEventCreatedAt: new Date(1_000),
		stripeEventType: 'invoice.payment_failed',
		desiredAccess: 'DENIED',
		stripeSubscriptionId: 'sub_1',
	}), { apply: false, reason: 'stale_stripe_event' })
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
		mutationScope: syntheticMutationScope,
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

	const result = await reconcileAccess({ row: row({ welcomeRequired: false }), config, api: fakeApi(state), mutationScope: syntheticMutationScope })
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
		mutationScope: syntheticMutationScope,
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
		mutationScope: syntheticMutationScope,
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

	await assert.doesNotReject(() => reconcileAccess({ row: row({ welcomeRequired: false }), config, api, mutationScope: syntheticMutationScope }))
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

	await assert.rejects(() => reconcileAccess({ row: row({ welcomeRequired: false }), config, api, mutationScope: syntheticMutationScope }), /mighty_api_error_422/)
})

test('production mutation scope rejects an identity outside the explicit test allowlist', async () => {
	const scope = getMightyMutationScope({
		MIGHTY_PROVIDER_ENV: 'production',
		MIGHTY_PRODUCTION_ALLOW_API_MUTATIONS: 'true',
		MIGHTY_PRODUCTION_TEST_EMAIL: 'westhoek@hotmail.com',
		MIGHTY_ACCESS_SYNC_MUTATION_ALLOWLIST: 'westhoek@hotmail.com',
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

test('Stripe-projected entitlement for an unauthorized identity cannot reach a Mighty mutation', async () => {
	const projection = projectMightyAccessFromStripeEvent({
		id: 'evt_synthetic_unauthorized',
		created: 1_757_000_000,
		livemode: true,
		type: 'checkout.session.completed',
		data: {
			object: {
				mode: 'subscription',
				payment_status: 'paid',
				customer_email: 'unauthorized@example.com',
				customer: 'cus_synthetic_unauthorized',
				subscription: 'sub_synthetic_unauthorized',
			},
		},
	} as never)
	assert.equal(projection?.desiredAccess, 'ALLOWED')
	assert.equal(projection?.email, 'unauthorized@example.com')

	const scope = getMightyMutationScope({
		MIGHTY_PROVIDER_ENV: 'production',
		MIGHTY_PRODUCTION_ALLOW_API_MUTATIONS: 'true',
		MIGHTY_PRODUCTION_TEST_EMAIL: 'westhoek@hotmail.com',
	})
	const state: FakeState = {
		member: { id: 22, email: 'unauthorized@example.com', role: 'contributor' },
		purchases: [],
		memberPlanAccess: false,
		findMemberCalls: 0,
		createMemberCalls: 0,
		grantCalls: 0,
		revokeCalls: [],
		revokePlanCalls: [],
	}
	await assert.rejects(
		() => reconcileAccess({ row: row({ email: projection!.email!, normalizedEmail: projection!.email!, welcomeRequired: false }), config, api: fakeApi(state), mutationScope: scope }),
		(error: unknown) => error instanceof Error && 'code' in error && (error as { code?: string }).code === 'mighty_mutation_scope_denied',
	)
	assert.equal(state.createMemberCalls, 0)
	assert.equal(state.grantCalls, 0)
	assert.equal(state.revokeCalls.length, 0)
	assert.equal(state.revokePlanCalls.length, 0)
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
