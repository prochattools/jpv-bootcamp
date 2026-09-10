import assert from 'node:assert/strict'
import test from 'node:test'

import { classifyMightyReconciliation, summarizeMightyReconciliation } from './reconciliation'
import { getMightyMutationScope } from './mutationPolicy'

const scope = getMightyMutationScope({})
const standardSpaces = ['Activity Feed', 'Chat', 'Course', 'Events', 'JPV Resource Library'].map((name, index) => ({ id: index + 1, name }))
const member = { id: 22, email: 'student@example.com', member_type: 'full', role: 'contributor' }

function row(overrides: Partial<Parameters<typeof classifyMightyReconciliation>[0]> = {}) {
	return {
		email: 'student@example.com',
		desiredAccess: 'ALLOWED' as const,
		member,
		plans: [],
		spaces: standardSpaces,
		targetPurchaseCount: 0,
		targetPlanId: 678,
		...overrides,
	}
}

test('dry-run classifies ordinary allowed rows that need a Plan grant', () => {
	assert.deepEqual(classifyMightyReconciliation(row(), scope), {
		classification: 'NEEDS_PLAN_GRANT',
		action: 'grant_plan',
		identityClass: 'ordinary',
		reason: 'target_plan_missing',
	})
})

test('dry-run classifies allowed and denied rows already in sync', () => {
	assert.equal(classifyMightyReconciliation(row({ plans: [{ id: 678 }] }), scope).classification, 'IN_SYNC_ALLOWED')
	assert.equal(classifyMightyReconciliation(row({ desiredAccess: 'DENIED' }), scope).classification, 'IN_SYNC_DENIED')
	assert.equal(classifyMightyReconciliation(row({ desiredAccess: 'DENIED', plans: [{ id: 678 }] }), scope).classification, 'NEEDS_PLAN_REVOKE')
})

test('dry-run excludes unknown roles, exceptional Spaces, and other Plans', () => {
	assert.equal(classifyMightyReconciliation(row({ member: { ...member, role: null } }), scope).classification, 'PRIVILEGED_EXCLUDED')
	assert.equal(classifyMightyReconciliation(row({ spaces: [...standardSpaces, { id: 9, name: 'FIRST FOUNDATION' }] }), scope).classification, 'OVERLAPPING_ACCESS_REVIEW')
	assert.equal(classifyMightyReconciliation(row({ plans: [{ id: 777 }] }), scope).classification, 'OVERLAPPING_ACCESS_REVIEW')
})

test('dry-run never proposes a mutation for a missing identity or provider error', () => {
	assert.equal(classifyMightyReconciliation(row({ member: null }), scope).action, 'review')
	assert.equal(classifyMightyReconciliation(row({ providerError: 'provider_error_500' }), scope).classification, 'PROVIDER_ERROR')
})

test('dry-run summary is sanitized and explicitly read-only', () => {
	assert.deepEqual(summarizeMightyReconciliation([
		classifyMightyReconciliation(row(), scope),
		classifyMightyReconciliation(row({ desiredAccess: 'DENIED' }), scope),
	]), {
		readOnly: true,
		mutationPerformed: false,
		totalRows: 2,
		counts: { IN_SYNC_DENIED: 1, NEEDS_PLAN_GRANT: 1 },
		proposedActions: 1,
	})
})
