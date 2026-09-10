import assert from 'node:assert/strict'
import test from 'node:test'

import { buildCutoverManifestRow, type CutoverManifestRow } from './cutoverManifest'
import { createMemoryCutoverCheckpointStore, runCutoverBatch } from './cutoverRunner'

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
	const result = await runCutoverBatch({ rows: [row()], batchSize: 1, dryRun: true, store, planId: '2000039' })
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
	const first = await runCutoverBatch({ rows: [row(), row('second@example.com')], batchSize: 2, dryRun: false, store, adapter, planId: '2000039' })
	assert.equal(first.stoppedOnError, true)
	assert.deepEqual(calls, ['grant:41', 'rollback:41'])
	assert.equal(store.get('student@example.com')?.status, 'FAILED_RESTORED')
	assert.equal(store.get('second@example.com'), null)

	fail = false
	const second = await runCutoverBatch({ rows: [row(), row('second@example.com')], batchSize: 2, dryRun: false, store, adapter, planId: '2000039' })
	assert.equal(second.stoppedOnError, false)
	assert.equal(store.get('student@example.com')?.status, 'COMPLETE')
	assert.equal(store.get('second@example.com')?.status, 'COMPLETE')
	const third = await runCutoverBatch({ rows: [row(), row('second@example.com')], batchSize: 2, dryRun: false, store, adapter, planId: '2000039' })
	assert.equal(third.mutationPerformed, false)
})

test('runner skips identity, overlap, and privileged actions', async () => {
	const store = createMemoryCutoverCheckpointStore()
	const skipped = [
		buildCutoverManifestRow({ email: 'unknown@example.com', stripeEntitled: true, member: { id: 1, email: 'unknown@example.com', role: null }, plans: [], purchases: [], spaces: [], targetPlanId: 2000039 }),
		buildCutoverManifestRow({ email: 'overlap@example.com', stripeEntitled: true, member: { id: 2, email: 'overlap@example.com', role: 'contributor' }, plans: [], purchases: [], spaces: [{ id: 1, name: 'FIRST FOUNDATION' }], targetPlanId: 2000039 }),
	]
	const result = await runCutoverBatch({ rows: skipped, batchSize: 10, dryRun: false, store, adapter: { createMember: async () => ({ id: 'nope' }), grantPlan: async () => { throw new Error('must_not_call') }, verifyPlan: async () => false, rollbackPlan: async () => undefined }, planId: '2000039' })
	assert.equal(result.mutationPerformed, false)
	assert.equal(result.processed.length, 0)
})
