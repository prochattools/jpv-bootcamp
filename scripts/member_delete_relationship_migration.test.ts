import assert from 'node:assert/strict'

import {
	buildMemberDeleteRelationshipDownSql,
	buildMemberDeleteRelationshipUpSql,
} from '../src/lib/memberDeleteRelationshipMigrationSql'

const upSql = buildMemberDeleteRelationshipUpSql('jpvbootcamp')
const downSql = buildMemberDeleteRelationshipDownSql('jpvbootcamp')

for (const table of [
	'payload_member_profiles',
	'payload_course_enrollments',
	'payload_lesson_progress',
	'payload_billing_accounts',
	'payload_subscriptions',
	'payload_space_memberships',
]) {
	assert.match(upSql, new RegExp(`ALTER TABLE "jpvbootcamp"\."${table}"`))
}

assert.match(upSql, /ON DELETE CASCADE/)
assert.match(upSql, /payload_subscriptions_billing_account_id_payload_billing_accounts_id_fk/)
assert.match(upSql, /payload_member_security_events.*DROP NOT NULL/s)
assert.match(downSql, /ON DELETE SET NULL/)
assert.match(downSql, /payload_member_security_events.*SET NOT NULL/s)

console.log('member delete relationship migration tests passed')
