import assert from 'node:assert/strict'
import test from 'node:test'

import { readFileSync } from 'node:fs'

const source = readFileSync('scripts/mighty/auditManualAccess.mts', 'utf8')

test('manual access audit is production-scoped, read-only, and aggregate-only', () => {
	assert.match(source, /requires_production_provider_env/)
	assert.match(source, /listMembers\(\)/)
	assert.match(source, /findAllPurchases\(\)/)
	assert.match(source, /listMemberPlans\(member\.id\)/)
	assert.match(source, /readOnly: true/)
	assert.match(source, /mutationPerformed: false/)
	assert.match(source, /stripeEntitledWithOtherPlanOverlap/)
	assert.match(source, /directMemberWithoutAnyPlan/)
	assert.doesNotMatch(source, /createMember|grantAccess|restoreAccess|revokeAccess|\.create\(|\.update\(|\.delete\(/)
	assert.match(source, /stripeSummary\.recordsRequiringManualReview|\.\.\.stripeSummary/)
	assert.match(source, /stripeSummary\.ambiguousOrUnmatchedRecordCount|\.\.\.stripeSummary/)
})
