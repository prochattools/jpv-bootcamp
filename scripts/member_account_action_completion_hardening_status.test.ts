import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const collection = readFileSync('src/collections/members/MemberEmailVerificationRecords.ts', 'utf8')
const service = readFileSync('src/lib/auth/memberAccountActions.ts', 'utf8')
const sql = readFileSync('src/lib/auth/memberAccountActionSql.ts', 'utf8')
const invitation = readFileSync('src/lib/members/completeMemberSetup.ts', 'utf8')
const passwordReset = readFileSync('src/lib/members/completePasswordReset.ts', 'utf8')
const emailChange = readFileSync('src/lib/members/changeMemberEmail.ts', 'utf8')
const registry = readFileSync('src/lib/payloadMigrationRegistry.ts', 'utf8')
const readiness = readFileSync('docs/PREVIEW_RELEASE_READINESS.md', 'utf8')
const hardening = readFileSync('docs/ADVERSARIAL_REVIEW_HARDENING_2026_07_22.md', 'utf8')
const design = readFileSync('docs/security/MEMBER_ACCOUNT_ACTION_RESERVATION_FINALIZATION_DESIGN.md', 'utf8')

const migrationPath = 'src/migrations/20260804_050000_member_account_action_reservations.ts'
const migrationSqlPath = 'src/lib/auth/memberAccountActionReservationMigrationSql.ts'

function position(source: string, value: string): number {
  const index = source.indexOf(value)
  assert(index >= 0, `expected source marker: ${value}`)
  return index
}

for (const field of ['reservationNonce', 'reservedAt', 'leaseExpiresAt', 'resultFingerprint']) {
  assert.match(collection, new RegExp(`name: '${field}'`), `collection field ${field} must exist`)
}
assert.ok(existsSync(migrationPath), 'reservation/finalization migration must exist')
assert.ok(existsSync(migrationSqlPath), 'reservation/finalization migration SQL contract must exist')
assert.match(registry, /20260804_050000_member_account_action_reservations/)

for (const api of ['reserveAction', 'markMutationStarted', 'finalizeAction', 'releaseAction', 'findCompletedAction']) {
  assert.match(service, new RegExp(`${api}\\(`), `service API ${api} must exist`)
}
for (const builder of [
  'buildReserveMemberAccountActionSql',
  'buildMarkMemberAccountActionMutationStartedSql',
  'buildFinalizeMemberAccountActionSql',
  'buildReleaseMemberAccountActionSql',
  'buildFindCompletedMemberAccountActionSql',
]) {
  assert.match(sql, new RegExp(`${builder}\\(`), `SQL builder ${builder} must exist`)
}

const invitationReserve = position(invitation, "actions.reserveAction(token, 'member_invitation')")
const invitationMutation = position(invitation, 'updated = await payload.update({')
const invitationFinalize = position(invitation, "actions.finalizeAction(\n    token,\n    'member_invitation'")
assert(invitationReserve < invitationMutation && invitationMutation < invitationFinalize)

const resetReserve = position(passwordReset, "actions.reserveAction(token, 'password_reset')")
const resetMutation = position(passwordReset, 'await payload.resetPassword({')
const resetFinalize = position(passwordReset, "actions.finalizeAction(\n    token,\n    'password_reset'")
assert(resetReserve < resetMutation && resetMutation < resetFinalize)

const emailReserve = position(emailChange, "actions.reserveAction(normalizedToken, 'email_change_confirmation')")
const emailMutation = position(emailChange, 'await payload.update({')
const emailFinalize = position(emailChange, "actions.finalizeAction(\n    normalizedToken,\n    'email_change_confirmation'")
assert(emailReserve < emailMutation && emailMutation < emailFinalize)

for (const source of [invitation, passwordReset, emailChange]) {
  assert.doesNotMatch(source, /findCompletableAction\(/)
  assert.doesNotMatch(source, /completeAction\(/)
}

for (const behavioralTest of [
  'scripts/payload_member_account_actions.test.ts',
  'scripts/payload_member_invitation.test.ts',
  'scripts/payload_member_password_reset_completion.test.ts',
  'scripts/payload_member_email_change.test.ts',
]) {
  assert.ok(existsSync(behavioralTest), `behavioral test must exist: ${behavioralTest}`)
}

assert.match(design, /pending[\s\S]*reserved[\s\S]*consumed/i)
assert.match(design, /reservation_nonce|reservation nonce/i)
assert.match(design, /lease_expires_at|lease expires/i)
assert.match(design, /behavioral.*concurrency|concurrency.*behavioral/i)
assert.match(design, /migration.*authorization|staging.*authorization/i)
assert.match(hardening, /IMPLEMENTED IN SOURCE|SOURCE IMPLEMENTATION COMPLETE/i)
assert.match(hardening, /STAGING MIGRATION AUTHORIZATION REQUIRED|shared staging.*pending/i)
assert.match(readiness, /ACCOUNT-ACTION HARDENING IMPLEMENTED LOCALLY|reservation\/finalization.*implemented in source/i)
assert.match(readiness, /STAGING MIGRATION AUTHORIZATION REQUIRED|shared staging.*pending/i)

console.log('member_account_action_completion_hardening_status.test.ts passed')
