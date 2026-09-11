import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

test('production integration validation is exact-three-only and read-only', () => {
	const source = readFileSync('scripts/mighty/rehearseCutover.mts', 'utf8')
	assert.match(source, /westhoek@hotmail\.com/)
	assert.match(source, /steve@yeshua\.academy/)
	assert.match(source, /info@prochat\.tools/)
	assert.match(source, /customers\.list\(\{ email, limit: 10 \}\)/)
	assert.match(source, /subscriptions\.list\(\{ customer: customer\.id, status: 'all', limit: 100 \}\)/)
	assert.match(source, /api\.findMemberByEmail/)
	assert.doesNotMatch(source, /listActiveSubscriptions|api\.listMembers|api\.findAllPurchases/)
	assert.match(source, /mutationPerformed: false/)
	assert.doesNotMatch(source, /api\.(createMember|grantAccess|restoreAccess|revokeAccess|revokePlanAccess)\s*\(/)
	assert.doesNotMatch(source, /stripe\.[A-Za-z]+\.(create|update|del)\s*\(/)
	assert.doesNotMatch(source, /rows\.length\s*===\s*17/)
})
