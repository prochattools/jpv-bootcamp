import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { buildCutoverManifestRow, type CutoverManifestRow } from './cutoverManifest'
import {
	findSilentExistingMemberGrantAuthorization,
	runSilentExistingMemberGrant,
	SILENT_EXISTING_MEMBER_GRANT_AUTHORIZATIONS,
	SILENT_MIGRATION_ACTION,
	SILENT_MIGRATION_AUTHORIZATION_VERSION,
	SILENT_MIGRATION_TARGET_PLAN_ID,
	validateSilentExistingMemberGrantAuthorization,
	type SilentExistingMemberGrantAuthorization,
	type SilentExistingMemberState,
} from './silentMigrationAuthorizations'

const manifestSha256 = 'a'.repeat(64)
const roleAttestationSha256 = 'b'.repeat(64)
const email = 'ordinary@example.test'
const memberId = 'member-ordinary'

const authorization: SilentExistingMemberGrantAuthorization = {
	version: SILENT_MIGRATION_AUTHORIZATION_VERSION,
	email,
	mightyMemberId: memberId,
	manifestSha256,
	roleAttestationSha256,
	roleClass: 'ORDINARY',
	targetPlanId: SILENT_MIGRATION_TARGET_PLAN_ID,
	action: SILENT_MIGRATION_ACTION,
	batchSize: 1,
	emailAllowed: false,
	memberCreationAllowed: false,
	revokeAllowed: false,
}

function row(overrides: Partial<CutoverManifestRow> = {}): CutoverManifestRow {
	return {
		...buildCutoverManifestRow({
			email,
			stripeEntitled: true,
			member: { id: memberId, email, role: 'contributor', member_type: 'full' },
			plans: [],
			purchases: [],
			spaces: [],
			targetPlanId: SILENT_MIGRATION_TARGET_PLAN_ID,
			operatorRoleClass: 'ORDINARY',
		}),
		...overrides,
	}
}

function state(planIds: string[] = [], role: string | null = 'contributor'): SilentExistingMemberState {
	return {
		member: { id: memberId, email, role, member_type: 'full' },
		planIds,
		purchasePlanIds: [],
		extraSpaceNames: [],
		profileFingerprint: 'profile-before',
		contentFingerprint: 'content-before',
		loginFingerprint: 'login-before',
	}
}

function adapter(options: { onGrant?: () => void; states?: SilentExistingMemberState[]; role?: string | null } = {}) {
	let reads = 0
	let grants = 0
	const states = options.states ?? [state()]
	const role = options.role ?? 'contributor'
	return {
		get grants() { return grants },
		findMemberByEmail: async () => state([], role).member,
		readState: async () => states[Math.min(reads++, states.length - 1)],
		grantPlan: async (_memberId: string, planId: string) => {
			assert.equal(planId, SILENT_MIGRATION_TARGET_PLAN_ID)
			grants += 1
			options.onGrant?.()
		},
	}
}

test('production authorization registry is empty and has no environment fallback', async () => {
	assert.equal(SILENT_EXISTING_MEMBER_GRANT_AUTHORIZATIONS.length, 0)
	await assert.rejects(
		() => runSilentExistingMemberGrant({ row: row(), manifestSha256, roleAttestationSha256, currentEntitlement: async () => 'ALLOWED', adapter: adapter() }),
		(error: unknown) => error instanceof Error && error.message === 'silent_migration_authorization_not_found',
	)
})

test('exact binding rejects identity, hash, plan, action, batch, and capability drift', () => {
	const fields: Array<[keyof SilentExistingMemberGrantAuthorization, unknown]> = [
		['targetPlanId', '2000040'],
		['action', 'REVOKE_PLAN'],
		['batchSize', 2],
		['emailAllowed', true],
		['memberCreationAllowed', true],
		['revokeAllowed', true],
		['roleClass', 'PRIVILEGED'],
	]
	for (const [field, value] of fields) {
		assert.throws(() => validateSilentExistingMemberGrantAuthorization({ ...authorization, [field]: value } as SilentExistingMemberGrantAuthorization))
	}
	assert.throws(() => findSilentExistingMemberGrantAuthorization('other@example.test', manifestSha256, roleAttestationSha256, [authorization]))
	assert.throws(() => findSilentExistingMemberGrantAuthorization(email, 'c'.repeat(64), roleAttestationSha256, [authorization]))
	assert.throws(() => findSilentExistingMemberGrantAuthorization(email, manifestSha256, 'd'.repeat(64), [authorization]))
	assert.equal(findSilentExistingMemberGrantAuthorization(email, manifestSha256, roleAttestationSha256, [authorization]), authorization)
})

test('runtime gate has no email, member-creation, or revoke capability', () => {
	const source = readFileSync(fileURLToPath(new URL('./silentMigrationAuthorizations.ts', import.meta.url)), 'utf8')
	assert.doesNotMatch(source, /queueEmail|sendEmail|createMember\(|revoke(?:Plan|Access)\(/)
})

test('wrong manifest actions and CREATE_NEW rows are denied before provider work', async () => {
	const calls: string[] = []
	const createNew = row({ proposedCutoverAction: 'CREATE_NEW_AT_CUTOVER', mightyMemberId: null, roleClass: 'NOT_YET_PROVISIONED' })
	await assert.rejects(
		() => runSilentExistingMemberGrant({ row: createNew, manifestSha256, roleAttestationSha256, authorizations: [authorization], currentEntitlement: async () => 'ALLOWED', adapter: { ...adapter(), findMemberByEmail: async () => { calls.push('find'); return null } } }),
		/error|silent_migration_manifest_action_not_allowed/,
	)
	assert.deepEqual(calls, [])
})

test('synthetic exact success grants only Plan 2000039, sends no email, and exposes no create or revoke capability', async () => {
	const calls: string[] = []
	let entitlementChecks = 0
	const stateAfterGrant = state([SILENT_MIGRATION_TARGET_PLAN_ID])
	const grantAdapter = {
		findMemberByEmail: async () => state().member,
		readState: async (_id: string, planId: string) => { assert.equal(planId, SILENT_MIGRATION_TARGET_PLAN_ID); return calls.length > 0 ? stateAfterGrant : state() },
		grantPlan: async (id: string, planId: string) => { calls.push(`grant:${id}:${planId}`) },
	}
	const result = await runSilentExistingMemberGrant({ row: row(), manifestSha256, roleAttestationSha256, authorizations: [authorization], currentEntitlement: async () => { entitlementChecks += 1; return 'ALLOWED' }, adapter: grantAdapter })
	assert.deepEqual(result, { status: 'GRANTED_AND_VERIFIED', memberId, planId: SILENT_MIGRATION_TARGET_PLAN_ID, mutationPerformed: true, communicationPerformed: false })
	assert.deepEqual(calls, [`grant:${memberId}:${SILENT_MIGRATION_TARGET_PLAN_ID}`])
	assert.equal(entitlementChecks, 2)
})

test('null provider role is accepted only through exact owner attestation', async () => {
	const calls: string[] = []
	const nullRoleAdapter = adapter({
		role: null,
		states: [state([], null), state([SILENT_MIGRATION_TARGET_PLAN_ID], null)],
		onGrant: () => calls.push('grant'),
	})
	const result = await runSilentExistingMemberGrant({ row: row(), manifestSha256, roleAttestationSha256, authorizations: [authorization], currentEntitlement: async () => 'ALLOWED', adapter: nullRoleAdapter })
	assert.equal(result.status, 'GRANTED_AND_VERIFIED')
	assert.deepEqual(calls, ['grant'])
	assert.equal(nullRoleAdapter.grants, 1)
	await assert.rejects(
		() => runSilentExistingMemberGrant({ row: row(), manifestSha256, roleAttestationSha256, currentEntitlement: async () => 'ALLOWED', adapter: nullRoleAdapter }),
		/silent_migration_authorization_not_found/,
	)
})

test('explicit ordinary provider roles remain accepted', async () => {
	for (const role of ['member', 'contributor', 'student']) {
		const calls: string[] = []
		const roleAdapter = adapter({ role, states: [state([], role), state([SILENT_MIGRATION_TARGET_PLAN_ID], role)], onGrant: () => calls.push(role) })
		const result = await runSilentExistingMemberGrant({ row: row(), manifestSha256, roleAttestationSha256, authorizations: [authorization], currentEntitlement: async () => 'ALLOWED', adapter: roleAdapter })
		assert.equal(result.status, 'GRANTED_AND_VERIFIED')
		assert.deepEqual(calls, [role])
	}
})

test('explicit privileged and unknown provider roles cannot be overridden', async () => {
	for (const role of ['host', 'owner', 'admin', 'administrator', 'staff', 'custom-role']) {
		let grants = 0
		const roleAdapter = adapter({ role, states: [state([], role)], onGrant: () => { grants += 1 } })
		await assert.rejects(
			() => runSilentExistingMemberGrant({ row: row(), manifestSha256, roleAttestationSha256, authorizations: [authorization], currentEntitlement: async () => 'ALLOWED', adapter: roleAdapter }),
			role === 'custom-role' ? /silent_migration_current_role_unknown/ : /silent_migration_current_role_privileged/,
		)
		assert.equal(grants, 0)
	}
})

test('replay is already converged and performs no second grant', async () => {
	const grantAdapter = adapter({ states: [state(), state([SILENT_MIGRATION_TARGET_PLAN_ID])] })
	const first = await runSilentExistingMemberGrant({ row: row(), manifestSha256, roleAttestationSha256, authorizations: [authorization], currentEntitlement: async () => 'ALLOWED', adapter: grantAdapter })
	assert.equal(first.status, 'GRANTED_AND_VERIFIED')
	const second = await runSilentExistingMemberGrant({ row: row(), manifestSha256, roleAttestationSha256, authorizations: [authorization], currentEntitlement: async () => 'ALLOWED', adapter: { ...grantAdapter, readState: async () => state([SILENT_MIGRATION_TARGET_PLAN_ID]) } })
	assert.equal(second.status, 'ALREADY_CONVERGED')
	assert.equal(grantAdapter.grants, 1)
})

test('entitlement, identity, overlap, and post-grant drift fail closed without rollback', async () => {
	await assert.rejects(() => runSilentExistingMemberGrant({ row: row(), manifestSha256, roleAttestationSha256, authorizations: [authorization], currentEntitlement: async () => 'DENIED', adapter: adapter() }), /current_entitlement_not_allowed/)
	await assert.rejects(() => runSilentExistingMemberGrant({ row: row(), manifestSha256, roleAttestationSha256, authorizations: [authorization], currentEntitlement: async () => 'ALLOWED', adapter: { ...adapter(), findMemberByEmail: async () => ({ id: 'other', email }) } }), /current_member_id_mismatch/)
	await assert.rejects(() => runSilentExistingMemberGrant({ row: row(), manifestSha256, roleAttestationSha256, authorizations: [authorization], currentEntitlement: async () => 'ALLOWED', adapter: { ...adapter(), readState: async () => ({ ...state(), planIds: ['3000040'] }) } }), /current_overlap_detected/)
	const drift = { ...state([SILENT_MIGRATION_TARGET_PLAN_ID]), profileFingerprint: 'changed' }
	const driftAdapter = adapter({ states: [state(), drift] })
	await assert.rejects(() => runSilentExistingMemberGrant({ row: row(), manifestSha256, roleAttestationSha256, authorizations: [authorization], currentEntitlement: async () => 'ALLOWED', adapter: driftAdapter }), /post_grant_profile_changed/)
	let uncertainGrantCalls = 0
	await assert.rejects(() => runSilentExistingMemberGrant({ row: row(), manifestSha256, roleAttestationSha256, authorizations: [authorization], currentEntitlement: async () => 'ALLOWED', adapter: { ...adapter(), grantPlan: async () => { uncertainGrantCalls += 1; throw new Error('uncertain provider result') } } }), /uncertain provider result/)
	assert.equal(uncertainGrantCalls, 1)
})

test('null-role authorization rejects privileged or unknown post-grant role drift without rollback', async () => {
	for (const role of ['admin', 'host', 'administrator', 'owner', 'staff', 'custom-role']) {
		const driftAdapter = adapter({ states: [state([], null), state([SILENT_MIGRATION_TARGET_PLAN_ID], role)] })
		await assert.rejects(
			() => runSilentExistingMemberGrant({ row: row(), manifestSha256, roleAttestationSha256, authorizations: [authorization], currentEntitlement: async () => 'ALLOWED', adapter: driftAdapter }),
			/post_grant_role_changed/,
		)
		assert.equal(driftAdapter.grants, 1)
	}
})

console.log('silentMigrationAuthorizations.test.ts passed')
