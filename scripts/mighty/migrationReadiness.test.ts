import assert from 'node:assert/strict'
import test from 'node:test'

import { buildCutoverManifestRow } from '../../src/lib/mighty/cutoverManifest'
import {
	assertMigrationExecutionAllowed,
	buildMigrationAuditRecord,
	createMigrationManifest,
	planMigrationRow,
	type MigrationAuthorization,
	type MigrationExecutionRequest,
	type MigrationManifestRow,
} from '../../src/lib/mighty/migrationOperations'
import { createMemoryCutoverCheckpointStore, runCutoverBatch } from '../../src/lib/mighty/cutoverRunner'

const TARGET_PLAN_ID = '2000039'

function manifestRow(overrides: Partial<MigrationManifestRow> = {}): MigrationManifestRow {
	return {
		canonicalIdentity: 'member-a@example.test',
		email: 'member-a@example.test',
		stripe: { entitlement: 'ALLOWED', inputReference: 'synthetic-stripe-subscription-a' },
		mighty: { expectedMemberId: 'mighty-a', currentAccess: 'ABSENT', desiredAccess: 'ALLOWED' },
		targetPlanId: TARGET_PLAN_ID,
		privilege: 'ORDINARY',
		overlap: 'NONE',
		sourceMetadata: { kind: 'synthetic_fixture', reference: 'migration-readiness-test', capturedAt: '2026-09-13T00:00:00.000Z' },
		...overrides,
	}
}

function makeManifest(rows: MigrationManifestRow[] = [manifestRow()]): ReturnType<typeof createMigrationManifest> {
	return createMigrationManifest({ version: 'mighty-jpv-v1', targetPlanId: TARGET_PLAN_ID, batchSize: rows.length, rows })
}

function authorization(manifest: ReturnType<typeof makeManifest>, overrides: Partial<MigrationAuthorization> = {}): MigrationAuthorization {
	return {
		authorizationId: 'owner-auth-synthetic-001',
		ownerApproved: true,
		manifestHash: manifest.manifestHash,
		targetPlanId: TARGET_PLAN_ID,
		batchSize: manifest.batchSize,
		productionExecution: false,
		workerAuthenticated: true,
		...overrides,
	}
}

function request(manifest: ReturnType<typeof makeManifest>, overrides: Partial<MigrationExecutionRequest> = {}): MigrationExecutionRequest {
	return {
		manifest,
		authorization: authorization(manifest),
		requestedManifestHash: manifest.manifestHash,
		requestedTargetPlanId: TARGET_PLAN_ID,
		requestedBatchSize: manifest.batchSize,
		dryRun: true,
		productionExecution: false,
		workerAuthenticated: true,
		populationDiscovery: false,
		...overrides,
	}
}

test('manifest contract is canonical, bounded, unique, and hashable', () => {
	const manifest = makeManifest([
		manifestRow(),
		manifestRow({ canonicalIdentity: 'member-b@example.test', email: 'member-b@example.test', mighty: { expectedMemberId: null, currentAccess: 'ABSENT', desiredAccess: 'ALLOWED' } }),
	])
	assert.equal(manifest.manifestHash.length, 64)
	assert.equal(manifest.batchSize, 2)
	assert.throws(() => makeManifest([manifestRow(), manifestRow()]), /migration_manifest_duplicate_identity/)
	assert.throws(() => makeManifest([manifestRow({ mighty: { expectedMemberId: 'mighty-a', currentAccess: 'ABSENT', desiredAccess: 'ALLOWED' } }), manifestRow({ canonicalIdentity: 'member-b@example.test', email: 'member-b@example.test', mighty: { expectedMemberId: 'mighty-a', currentAccess: 'ABSENT', desiredAccess: 'ALLOWED' } })]), /migration_manifest_duplicate_member_id/)
	assert.throws(() => makeManifest([manifestRow({ targetPlanId: '3000040' })]), /migration_manifest_row_plan_mismatch/)
	assert.throws(() => createMigrationManifest({ version: 'mighty-jpv-v1', targetPlanId: '3000040', batchSize: 1, rows: [manifestRow({ targetPlanId: '3000040' })] }), /migration_manifest_target_plan_mismatch/)
	assert.throws(() => createMigrationManifest({ version: 'mighty-jpv-v1', targetPlanId: TARGET_PLAN_ID, batchSize: 0, rows: [manifestRow()] }), /migration_manifest_batch_size_invalid/)
	assert.throws(() => createMigrationManifest({ version: 'mighty-jpv-v1', targetPlanId: TARGET_PLAN_ID, batchSize: 51, rows: [manifestRow()] }), /migration_manifest_batch_size_exceeds_approved_maximum/)
	assert.throws(() => createMigrationManifest({ version: 'mighty-jpv-v1', targetPlanId: TARGET_PLAN_ID, batchSize: 1, rows: undefined as unknown as MigrationManifestRow[] }), /migration_manifest_rows_invalid/)
	assert.throws(() => createMigrationManifest({ version: 'mighty-jpv-v1', targetPlanId: TARGET_PLAN_ID, batchSize: 1, rows: [manifestRow({ stripe: { entitlement: 'UNKNOWN' as 'ALLOWED', inputReference: 'synthetic' } })] }), /migration_manifest_entitlement_invalid/)
})

test('approval gate requires owner authorization, exact hash, target Plan, bounded batch, worker auth, and no discovery', () => {
	const manifest = makeManifest()
	assert.equal(assertMigrationExecutionAllowed(request(manifest)).mutationPerformed, false)
	assert.throws(() => assertMigrationExecutionAllowed(request(manifest, { authorization: authorization(manifest, { ownerApproved: false }) })), /migration_owner_authorization_required/)
	assert.throws(() => assertMigrationExecutionAllowed(request(manifest, { requestedManifestHash: '0'.repeat(64) })), /migration_manifest_approval_mismatch/)
	assert.throws(() => assertMigrationExecutionAllowed(request(manifest, { requestedTargetPlanId: '3000040' })), /migration_target_plan_mismatch/)
	assert.throws(() => assertMigrationExecutionAllowed(request(manifest, { workerAuthenticated: false })), /migration_worker_authentication_required/)
	assert.throws(() => assertMigrationExecutionAllowed(request(manifest, { populationDiscovery: true })), /migration_population_discovery_forbidden/)
	assert.throws(() => assertMigrationExecutionAllowed(request(manifest, { authorization: authorization(manifest, { batchSize: 2 }) })), /migration_batch_approval_mismatch/)
})

test('manifest changes invalidate approval and cannot retain the old hash', () => {
	const manifest = makeManifest()
	const modified = { ...manifest, rows: [manifestRow({ email: 'changed@example.test', canonicalIdentity: 'changed@example.test' })] }
	assert.throws(() => assertMigrationExecutionAllowed(request(manifest, { manifest: modified })), /migration_manifest_hash_invalid/)
})

test('ambiguous privilege and access overlap fail closed before execution', () => {
	const privileged = makeManifest([manifestRow({ privilege: 'HOST' })])
	const overlapping = makeManifest([manifestRow({ overlap: 'OTHER_PLAN' })])
	assert.throws(() => assertMigrationExecutionAllowed(request(privileged)), /migration_privilege_review_required/)
	assert.throws(() => assertMigrationExecutionAllowed(request(overlapping)), /migration_overlap_review_required/)
	assert.equal(planMigrationRow({ row: privileged.rows[0], currentEntitlement: 'ALLOWED' }).action, 'REVIEW_REQUIRED')
	assert.equal(planMigrationRow({ row: overlapping.rows[0], currentEntitlement: 'ALLOWED' }).action, 'REVIEW_REQUIRED')
})

test('authoritative entitlement re-check blocks stale grants and stale revokes', () => {
	const allowed = manifestRow({ mighty: { expectedMemberId: null, currentAccess: 'ABSENT', desiredAccess: 'ALLOWED' } })
	const denied = manifestRow({
		canonicalIdentity: 'member-denied@example.test',
		email: 'member-denied@example.test',
		stripe: { entitlement: 'DENIED', inputReference: 'synthetic-stripe-subscription-denied' },
		mighty: { expectedMemberId: 'mighty-denied', currentAccess: 'PRESENT', desiredAccess: 'DENIED' },
	})
	assert.deepEqual(planMigrationRow({ row: allowed, currentEntitlement: 'DENIED' }), { action: 'REVIEW_REQUIRED', reason: 'current_entitlement_mismatch' })
	assert.deepEqual(planMigrationRow({ row: denied, currentEntitlement: 'ALLOWED' }), { action: 'REVIEW_REQUIRED', reason: 'current_entitlement_mismatch' })
	assert.deepEqual(planMigrationRow({ row: allowed, currentEntitlement: 'ALLOWED' }), { action: 'GRANT_PLAN', reason: 'target_plan_missing' })
	assert.deepEqual(planMigrationRow({ row: denied, currentEntitlement: 'DENIED' }), { action: 'REVOKE_PLAN', reason: 'target_plan_present_for_denied_entitlement' })
})

test('non-dry-run execution requires an entitlement re-check callback', async () => {
	const row = buildCutoverManifestRow({ email: 'member-a@example.test', stripeEntitled: true, member: { id: 'a', email: 'member-a@example.test', role: 'member' }, plans: [], purchases: [], spaces: [], targetPlanId: TARGET_PLAN_ID })
	await assert.rejects(
		() => runCutoverBatch({
			rows: [row],
			batchSize: 1,
			dryRun: false,
			store: createMemoryCutoverCheckpointStore(),
			planId: TARGET_PLAN_ID,
			mutationScope: {
				enforce: true,
				liveTestOnly: false,
				allowedEmails: new Set(['member-a@example.test']),
				allowNewMemberCreation: true,
				roleOverrides: new Map(),
			},
			adapter: { createMember: async () => ({ id: 'a' }), grantPlan: async () => undefined, verifyPlan: async () => true },
		}),
		/cutover_current_entitlement_recheck_required/,
	)
})

test('dry-run produces a sanitized audit record and zero provider work', () => {
	const manifest = makeManifest()
	const audit = buildMigrationAuditRecord(request(manifest))
	assert.deepEqual(audit, {
		manifestVersion: 'mighty-jpv-v1',
		manifestHash: manifest.manifestHash,
		authorizationId: 'owner-auth-synthetic-001',
		targetPlanId: TARGET_PLAN_ID,
		batchSize: 1,
		rowCount: 1,
		mode: 'DRY_RUN',
		mutationPerformed: false,
	})
	assert.doesNotMatch(JSON.stringify(audit), /member-a@example\.test|Bearer|secret/i)
})

test('synthetic operator rehearsal completes ordinary access, stops on timeout, and safely resumes a new member', async () => {
	const existingRow = buildCutoverManifestRow({
		email: 'member-a@example.test',
		stripeEntitled: true,
		member: { id: 'mighty-a', email: 'member-a@example.test', role: 'member' },
		plans: [],
		purchases: [],
		spaces: [],
		targetPlanId: TARGET_PLAN_ID,
	})
	const newRow = buildCutoverManifestRow({
		email: 'member-b@example.test',
		stripeEntitled: true,
		member: null,
		plans: [],
		purchases: [],
		spaces: [],
		targetPlanId: TARGET_PLAN_ID,
	})
	const scope = {
		enforce: true,
		liveTestOnly: false,
		allowedEmails: new Set(['member-a@example.test', 'member-b@example.test']),
		allowNewMemberCreation: true,
		roleOverrides: new Map([
			['member-a@example.test', 'ordinary'],
			['member-b@example.test', 'ordinary'],
		]),
	} as const
	const store = createMemoryCutoverCheckpointStore()
	let createCalls = 0
	let firstGrant = true
	const first = await runCutoverBatch({
		rows: [existingRow, newRow],
		batchSize: 2,
		dryRun: false,
		store,
		planId: TARGET_PLAN_ID,
		mutationScope: scope,
		currentEntitlement: async (row) => row.stripeEntitlement,
		adapter: {
			createMember: async () => { createCalls += 1; return { id: 'mighty-b' } },
			grantPlan: async (memberId) => { if (memberId === 'mighty-b' && firstGrant) { firstGrant = false; throw new Error('provider_timeout') } },
			verifyPlan: async () => true,
		},
	})
	assert.equal(first.stoppedOnError, true)
	assert.equal(store.get('member-b@example.test')?.status, 'REVIEW_REQUIRED')
	assert.equal(store.get('member-b@example.test')?.memberId, 'mighty-b')
	assert.equal(createCalls, 1)

	const resumed = await runCutoverBatch({
		rows: [existingRow, newRow],
		batchSize: 2,
		dryRun: false,
		store,
		planId: TARGET_PLAN_ID,
		mutationScope: scope,
		currentEntitlement: async (row) => row.stripeEntitlement,
		adapter: {
			createMember: async () => { throw new Error('duplicate_create_forbidden') },
			grantPlan: async () => undefined,
			verifyPlan: async () => true,
		},
	})
	assert.equal(resumed.stoppedOnError, false)
	assert.equal(store.get('member-b@example.test')?.status, 'COMPLETE')
	assert.equal(store.get('member-b@example.test')?.memberId, 'mighty-b')
	assert.equal(createCalls, 1)
})

test('cutover runner stops on entitlement mismatch without touching the provider or the next row', async () => {
	const rows = [
		buildCutoverManifestRow({ email: 'member-a@example.test', stripeEntitled: true, member: { id: 'a', email: 'member-a@example.test', role: 'member' }, plans: [], purchases: [], spaces: [], targetPlanId: TARGET_PLAN_ID }),
		buildCutoverManifestRow({ email: 'member-b@example.test', stripeEntitled: true, member: { id: 'b', email: 'member-b@example.test', role: 'member' }, plans: [], purchases: [], spaces: [], targetPlanId: TARGET_PLAN_ID }),
	]
	const store = createMemoryCutoverCheckpointStore()
	let providerCalls = 0
	const result = await runCutoverBatch({
		rows,
		batchSize: 2,
		dryRun: false,
		store,
		planId: TARGET_PLAN_ID,
		mutationScope: {
			enforce: true,
			liveTestOnly: false,
			allowedEmails: new Set(['member-a@example.test', 'member-b@example.test']),
			allowNewMemberCreation: true,
			roleOverrides: new Map(),
		},
		currentEntitlement: async () => 'DENIED',
		adapter: {
			createMember: async () => { providerCalls += 1; return { id: 'unexpected' } },
			grantPlan: async () => { providerCalls += 1 },
			verifyPlan: async () => true,
		},
	})
	assert.equal(result.stoppedOnError, true)
	assert.equal(providerCalls, 0)
	assert.equal(store.get('member-a@example.test')?.lastError, 'cutover_current_entitlement_mismatch')
	assert.equal(store.get('member-b@example.test'), null)
})
