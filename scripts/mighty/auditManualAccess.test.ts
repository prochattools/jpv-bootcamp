import assert from 'node:assert/strict'
import test from 'node:test'

import { readFileSync } from 'node:fs'

const source = readFileSync('scripts/mighty/auditManualAccess.mts', 'utf8')

test('manual access audit is production-scoped, exact-three-only, read-only, and aggregate-only', () => {
	assert.match(source, /requires_production_provider_env/)
	assert.match(source, /AUTHORIZED_MIGHTY_LIVE_TEST_EMAILS/)
	assert.match(source, /findMemberByEmail\(email\)/)
	assert.doesNotMatch(source, /listMembers\(\)|findAllPurchases\(\)/)
	assert.match(source, /readOnly: true/)
	assert.match(source, /mutationPerformed: false/)
	assert.match(source, /otherPlanOverlapCount/)
	assert.match(source, /directAccessWithoutTargetPlanCount/)
	assert.doesNotMatch(source, /createMember|grantAccess|restoreAccess|revokeAccess|\.create\(|\.update\(|\.delete\(/)
})
