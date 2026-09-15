import assert from 'node:assert/strict'
import test from 'node:test'

import { buildCutoverManifestRow, summarizeCutoverManifest } from './cutoverManifest'

const spaces = ['Activity Feed', 'Chat', 'Course', 'Events', 'JPV Resource Library'].map((name, index) => ({ id: index + 1, name }))

function input(overrides: Partial<Parameters<typeof buildCutoverManifestRow>[0]> = {}) {
	return {
		email: 'student@example.com',
		stripeEntitled: true,
		member: { id: 41, email: 'student@example.com', member_type: 'full', role: 'contributor' },
		plans: [],
		purchases: [],
		spaces,
		targetPlanId: 2000039,
		...overrides,
	}
}

test('manifest distinguishes migration, already controlled, and privilege review', () => {
	assert.equal(buildCutoverManifestRow(input()).proposedCutoverAction, 'MIGRATE_EXISTING')
	assert.equal(buildCutoverManifestRow(input({ plans: [{ id: 2000039, name: 'JPV Member Access' }] })).proposedCutoverAction, 'ALREADY_PLAN_CONTROLLED')
	assert.equal(buildCutoverManifestRow(input({ member: { id: 41, email: 'student@example.com', role: null } })).proposedCutoverAction, 'IDENTITY_REVIEW_REQUIRED')
	assert.equal(buildCutoverManifestRow(input({ member: { id: 41, email: 'student@example.com', role: 'admin' } })).proposedCutoverAction, 'PRIVILEGED_EXCLUDED')
	assert.equal(buildCutoverManifestRow(input({ member: null, operatorRoleClass: 'PRIVILEGED' })).proposedCutoverAction, 'PRIVILEGED_EXCLUDED')
})

test('manifest fails closed for missing identities, overlaps, and provider uncertainty', () => {
	assert.equal(buildCutoverManifestRow(input({ member: null })).proposedCutoverAction, 'CREATE_NEW_AT_CUTOVER')
	assert.equal(buildCutoverManifestRow(input({ spaces: [...spaces, { id: 9, name: 'FIRST FOUNDATION' }] })).proposedCutoverAction, 'OVERLAP_REVIEW_REQUIRED')
	assert.equal(buildCutoverManifestRow(input({ providerError: 'provider_timeout' })).proposedCutoverAction, 'BLOCKED')
})

test('manifest rejects a provider member whose email does not bind to the manifest identity', () => {
	assert.throws(
		() => buildCutoverManifestRow(input({ member: { id: 41, email: 'other@example.com', role: 'contributor' } })),
		/mighty_member_email_conflict/,
	)
	assert.throws(
		() => buildCutoverManifestRow(input({ member: { id: 41, email: '', role: 'contributor' } })),
		/mighty_member_email_conflict/,
	)
})

test('manifest accepts a masked member only with exact by_email evidence and locks the ID', () => {
	const row = buildCutoverManifestRow(input({
		email: 'westhoek@hotmail.com',
		member: {
			id: 41580317,
			email: '',
			role: 'contributor',
			identityEvidence: { source: 'exact_by_email_lookup', requestedEmail: 'westhoek@hotmail.com' },
		},
	}))
	assert.equal(row.proposedCutoverAction, 'MIGRATE_EXISTING')
	assert.equal(row.mightyMemberId, '41580317')
	assert.deepEqual(row.identityEvidence, {
		source: 'exact_by_email_lookup',
		requestedEmail: 'westhoek@hotmail.com',
	})
	assert.throws(
		() => buildCutoverManifestRow(input({ email: 'westhoek@hotmail.com', member: { id: 41580317, email: '', role: 'contributor' } })),
		/mighty_member_email_conflict/,
	)
})

test('manifest summary is deterministic and explicitly read-only', () => {
	const summary = summarizeCutoverManifest([
		buildCutoverManifestRow(input()),
		buildCutoverManifestRow(input({ email: 'missing@example.com', member: null })),
	])
	assert.deepEqual(summary, {
		totalRows: 2,
		allowed: 2,
		denied: 0,
		readyToMigrate: 2,
		reviewRequired: 0,
		actionCounts: {
			MIGRATE_EXISTING: 1,
			ALREADY_PLAN_CONTROLLED: 0,
			CREATE_NEW_AT_CUTOVER: 1,
			PRIVILEGED_EXCLUDED: 0,
			OVERLAP_REVIEW_REQUIRED: 0,
			IDENTITY_REVIEW_REQUIRED: 0,
			NO_ACTION: 0,
			BLOCKED: 0,
		},
		mutationPerformed: false,
	})
})
