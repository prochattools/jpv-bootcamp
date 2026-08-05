import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/lib/members/completePasswordReset.ts', 'utf8')

const reserveIndex = source.indexOf("actions.reserveAction(token, 'password_reset')")
const prepareIndex = source.indexOf('preparePayloadPasswordResetToken(payload, member.id, token)')
const resetIndex = source.indexOf('payload.resetPassword({')
const finalizeIndex = source.indexOf("actions.finalizeAction(\n    token,\n    'password_reset'")
const releaseIndex = source.indexOf('async function releasePasswordReset(')
const recoveredStateCheckIndex = source.indexOf('readPreparedResetTokenState(payload, member.id, token)')
const stateCheckIndex = source.lastIndexOf('readPreparedResetTokenState(payload, member.id, token)')
const mutationMarkerIndex = source.indexOf('actions.markMutationStarted(')
const lockClearIndex = source.indexOf('loginAttempts: 0')
const securityEventDefinitionIndex = source.indexOf("eventType: 'password_changed'")
const securityEventIndex = source.indexOf('createPasswordChangedSecurityEvent(payload, member.id)')
const auditIndex = source.indexOf("action: 'member.password.reset.completed'")
const emailDefinitionIndex = source.indexOf("templateKey: 'member-password-changed'")
const emailIndex = source.indexOf('queuePasswordChangedConfirmation(payload,')
const confirmationFailureIndex = source.indexOf("action: 'member.password.reset.confirmation_failed'")
const securityFallbackIndex = source.indexOf("INSERT INTO ${table} (")
const emailFallbackIndex = source.indexOf("'member-password-changed', 'queued'")

assert(reserveIndex > -1, 'password reset should reserve the action before changing the password')
assert(prepareIndex > reserveIndex, 'Payload reset token should be prepared after reservation')
assert(recoveredStateCheckIndex > reserveIndex, 'reclaimed reservations should inspect persisted reset-token state before repeating mutation')
assert(mutationMarkerIndex > reserveIndex, 'the intended result should be persisted after reservation')
assert(prepareIndex > mutationMarkerIndex, 'Payload reset token preparation should happen only after the nonce-owned mutation marker')
assert(resetIndex > prepareIndex, 'password reset should run only after token preparation')
assert(stateCheckIndex > resetIndex, 'thrown reset calls should be classified using persisted reset-token state')
assert(finalizeIndex > resetIndex, 'account action should finalize only after password mutation succeeds or is recovered')
assert(releaseIndex > -1, 'safe pre-mutation failures should use the dedicated release helper')
assert(source.includes('await releasePasswordReset(actions, token, reservation.reservationNonce)'))
assert(lockClearIndex > resetIndex, 'lockout should be cleared after successful reset')
assert(securityEventDefinitionIndex > -1, 'password_changed security event helper should persist the event type')
assert(securityEventIndex > finalizeIndex, 'password_changed security event should be recorded after durable finalization')
assert(auditIndex > securityEventIndex, 'reset completion audit should follow the password_changed security event')
assert(emailDefinitionIndex > -1, 'password-changed confirmation helper should use the confirmation template')
assert(emailIndex > securityEventIndex, 'password-changed confirmation should queue after the security event exists')
assert(confirmationFailureIndex > emailIndex, 'confirmation queue failures should be audited after queue attempt')
assert(securityFallbackIndex > -1, 'password_changed security event should have a DB fallback for auth-collection access failures')
assert(emailFallbackIndex > -1, 'password-changed confirmation should have a DB fallback for queue persistence failures')
assert(source.includes("const PASSWORD_RESET_RESULT_KEY = 'password-reset-completed'"))
assert(source.includes("reservation.reason === 'already_consumed'"))
assert(source.includes('The downstream outcome is uncertain. Keep the reservation until lease expiry.'))
assert(source.includes('Do not release after a successful password mutation.'))
assert(!source.includes('findCompletableAction('))
assert(!source.includes('completeAction('))

const forbiddenPasswordUpdatePattern = /payload\.update\([\s\S]*password:\s*input\.password/
assert(
  !forbiddenPasswordUpdatePattern.test(source),
  'password reset should not update auth password through generic collection update',
)
assert.doesNotMatch(source, /resultKey:[\s\S]*input\.password/)
assert.doesNotMatch(source, /createMemberAccountActionResultFingerprint\([\s\S]*input\.password/)

console.log('payload_member_password_reset_completion.test.ts passed')
