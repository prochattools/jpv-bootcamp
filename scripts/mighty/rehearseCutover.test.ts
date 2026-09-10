import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

test('production cutover rehearsal is read-only and does not import mutation operations', () => {
	const source = readFileSync('scripts/mighty/rehearseCutover.mts', 'utf8')
	assert.match(source, /subscriptions\.list/)
	assert.match(source, /api\.listMembers/)
	assert.match(source, /api\.findAllPurchases/)
	assert.match(source, /mutationPerformed: false/)
	assert.doesNotMatch(source, /api\.(createMember|grantAccess|restoreAccess|revokeAccess|revokePlanAccess)\s*\(/)
	assert.doesNotMatch(source, /stripe\.[A-Za-z]+\.(create|update|del)\s*\(/)
})
