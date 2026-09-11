import assert from 'node:assert/strict'
import test from 'node:test'

import { buildCutoverManifestRow, type CutoverManifestRow } from './cutoverManifest'
import { createMemoryCutoverCheckpointStore, runCutoverBatch } from './cutoverRunner'
import { getMightyMutationScope } from './mutationPolicy'

const syntheticScope = {
	enforce: true,
	liveTestOnly: false,
	allowedEmails: new Set(['student@example.com', 'second@example.com', 'unknown@example.com', 'overlap@example.com', 'new@example.com']),
	allowNewMemberCreation: true,
	roleOverrides: new Map([
		['student@example.com', 'ordinary'],
		['second@example.com', 'ordinary'],
		['new@example.com', 'ordinary'],
	]),
} as const

function row(email = 'student@example.com'): CutoverManifestRow {
	return buildCutoverManifestRow({
		email,
		stripeEntitled: true,
		member: { id: 41, email, role: 'contributor' },
		plans: [],
		purchases: [],
		spaces: [],
		targetPlanId: 2000039,
	})
}

test('runner dry-run creates checkpoints without calling a provider', async () => {
	const store = createMemoryCutoverCheckpointStore()
	const result = await runCutoverBatch({ rows: [row()], batchSize: 1, dryRun: true, store, planId: '2000039', mutationScope: syntheticScope })
	assert.equal(result.mutationPerformed, false)
	assert.equal(result.processed[0]?.status, 'PENDING')
})

test('runner is bounded, idempotent, and stops on the first provider error', async () => {
	const store = createMemoryCutoverCheckpointStore()
	const calls: string[] = []
	let fail = true
	const adapter = {
		createMember: async (email: string) => ({ id: email === 'student@example.com' ? '41' : '42' }),
		grantPlan: async (memberId: string) => { calls.push(`grant:${memberId}`); if (fail) throw new Error('provider_timeout') },
		verifyPlan: async () => true,
		rollbackPlan: async (memberId: string) => { calls.push(`rollback:${memberId}`) },
	}
	const first = await runCutoverBatch({ rows: [row(), row('second@example.com')], batchSize: 2, dryRun: false, store, adapter, planId: '2000039', mutationScope: syntheticScope })
	assert.equal(first.stoppedOnError, true)
	assert.deepEqual(calls, ['grant:41', 'rollback:41'])
	assert.equal(store.get('student@example.com')?.status, 'FAILED_RESTORED')
	assert.equal(store.get('second@example.com'), null)

	fail = false
	const second = await runCutoverBatch({ rows: [row(), row('second@example.com')], batchSize: 2, dryRun: false, store, adapter, planId: '2000039', mutationScope: syntheticScope })
	assert.equal(second.stoppedOnError, false)
	assert.equal(store.get('student@example.com')?.status, 'COMPLETE')
	assert.equal(store.get('second@example.com')?.status, 'COMPLETE')
	const third = await runCutoverBatch({ rows: [row(), row('second@example.com')], batchSize: 2, dryRun: false, store, adapter, planId: '2000039', mutationScope: syntheticScope })
	assert.equal(third.mutationPerformed, false)
})

test('runner skips identity, overlap, and privileged actions', async () => {
	const store = createMemoryCutoverCheckpointStore()
	const skipped = [
		buildCutoverManifestRow({ email: 'unknown@example.com', stripeEntitled: true, member: { id: 1, email: 'unknown@example.com', role: null }, plans: [], purchases: [], spaces: [], targetPlanId: 2000039 }),
		buildCutoverManifestRow({ email: 'overlap@example.com', stripeEntitled: true, member: { id: 2, email: 'overlap@example.com', role: 'contributor' }, plans: [], purchases: [], spaces: [{ id: 1, name: 'FIRST FOUNDATION' }], targetPlanId: 2000039 }),
	]
	const result = await runCutoverBatch({ rows: skipped, batchSize: 10, dryRun: false, store, adapter: { createMember: async () => ({ id: 'nope' }), grantPlan: async () => { throw new Error('must_not_call') }, verifyPlan: async () => false, rollbackPlan: async () => undefined }, planId: '2000039', mutationScope: syntheticScope })
	assert.equal(result.mutationPerformed, false)
	assert.equal(result.processed.length, 0)
})

test('new-subscriber failure preserves the created ID for review and never deletes it', async () => {
	const store = createMemoryCutoverCheckpointStore()
	const calls: string[] = []
	const result = await runCutoverBatch({
		rows: [buildCutoverManifestRow({ email: 'new@example.com', stripeEntitled: true, member: null, plans: [], purchases: [], spaces: [], targetPlanId: 2000039 })],
		batchSize: 1,
		dryRun: false,
		store,
		adapter: {
			createMember: async () => { calls.push('create'); return { id: '99' } },
			grantPlan: async () => { calls.push('grant'); throw new Error('provider_timeout') },
			verifyPlan: async () => false,
			rollbackPlan: async () => { calls.push('rollback') },
		},
		planId: '2000039',
		mutationScope: syntheticScope,
	})
	assert.equal(result.stoppedOnError, true)
	assert.equal(result.mutationPerformed, true)
	assert.equal(store.get('new@example.com')?.status, 'REVIEW_REQUIRED')
	assert.equal(store.get('new@example.com')?.memberId, '99')
	assert.deepEqual(calls, ['create', 'grant'])
})

test('runner rejects an empty manifest and unauthorized identities before provider mutation', async () => {
	const store = createMemoryCutoverCheckpointStore()
	await assert.rejects(
		() => runCutoverBatch({ rows: [], batchSize: 1, dryRun: true, store, planId: '2000039', mutationScope: syntheticScope }),
		/cutover_manifest_required/,
	)

	let providerCalls = 0
	const productionScope = getMightyMutationScope({
		MIGHTY_PROVIDER_ENV: 'production',
		MIGHTY_PRODUCTION_ALLOW_API_MUTATIONS: 'true',
		MIGHTY_PRODUCTION_TEST_EMAIL: 'westhoek@hotmail.com',
	})
	await assert.rejects(
		() => runCutoverBatch({
			rows: [row('unauthorized@example.com')],
			batchSize: 1,
			dryRun: false,
			store,
			adapter: {
				createMember: async () => { providerCalls += 1; return { id: '1' } },
				grantPlan: async () => { providerCalls += 1 },
				verifyPlan: async () => false,
				rollbackPlan: async () => { providerCalls += 1 },
			},
			planId: '2000039',
			mutationScope: productionScope,
		}),
		(error: unknown) => error instanceof Error && 'code' in error && ['mighty_mutation_scope_denied', 'mighty_live_test_scope_denied'].includes(String((error as { code?: unknown }).code)),
	)
	assert.equal(providerCalls, 0)
})

test('runner rejects malformed and duplicate manifest identities before provider mutation', async () => {
	const store = createMemoryCutoverCheckpointStore()
	await assert.rejects(
		() => runCutoverBatch({ rows: [{ ...row(), email: '' }], batchSize: 1, dryRun: true, store, planId: '2000039', mutationScope: syntheticScope }),
		/cutover_manifest_identity_required/,
	)
	await assert.rejects(
		() => runCutoverBatch({ rows: [row(), row('STUDENT@example.com')], batchSize: 2, dryRun: true, store, planId: '2000039', mutationScope: syntheticScope }),
		/cutover_manifest_duplicate_identity/,
	)
})

test('runner stops without mutation when a checkpoint identity changes', async () => {
	const store = createMemoryCutoverCheckpointStore()
	store.put({ email: 'student@example.com', status: 'IN_PROGRESS', memberId: 'old-id', lastError: null, updatedAt: new Date().toISOString() })
	let providerCalls = 0
	const result = await runCutoverBatch({
		rows: [row()],
		batchSize: 1,
		dryRun: false,
		store,
		adapter: {
			createMember: async () => { providerCalls += 1; return { id: 'new-id' } },
			grantPlan: async () => { providerCalls += 1 },
			verifyPlan: async () => false,
			rollbackPlan: async () => { providerCalls += 1 },
		},
		planId: '2000039',
		mutationScope: syntheticScope,
	})
	assert.equal(result.stoppedOnError, true)
	assert.equal(result.mutationPerformed, false)
	assert.equal(providerCalls, 0)
	assert.equal(store.get('student@example.com')?.lastError, 'cutover_identity_changed_since_checkpoint')
})
