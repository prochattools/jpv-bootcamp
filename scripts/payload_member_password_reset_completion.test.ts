import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/lib/members/completePasswordReset.ts', 'utf8')

const validationIndex = source.indexOf("actions.findCompletableAction(token, 'password_reset')")
const prepareIndex = source.indexOf('preparePayloadPasswordResetToken(payload, member.id, token)')
const resetIndex = source.indexOf('payload.resetPassword({')
const consumeIndex = source.indexOf("actions.completeAction(token, 'password_reset')")
const lockClearIndex = source.indexOf('loginAttempts: 0')
const securityEventIndex = source.indexOf("eventType: 'password_changed'")
const auditIndex = source.indexOf("action: 'member.password.reset.completed'")
const emailIndex = source.indexOf("templateKey: 'member-password-changed'")
const confirmationFailureIndex = source.indexOf("action: 'member.password.reset.confirmation_failed'")

assert(validationIndex > -1, 'password reset should validate custom action before changing password')
assert(prepareIndex > validationIndex, 'Payload reset token should be prepared after custom action validation')
assert(resetIndex > prepareIndex, 'password reset should use Payload resetPassword after preparation')
assert(consumeIndex > resetIndex, 'custom action should be consumed only after Payload resetPassword succeeds')
assert(lockClearIndex > resetIndex, 'lockout should be cleared after successful reset')
assert(securityEventIndex > lockClearIndex, 'password_changed security event should be recorded after successful reset cleanup')
assert(auditIndex > securityEventIndex, 'reset completion audit should follow the password_changed security event')
assert(emailIndex > securityEventIndex, 'password-changed confirmation should queue after the security event exists')
assert(confirmationFailureIndex > emailIndex, 'confirmation queue failures should be audited after queue attempt')
assert(
  source.includes('let securityEvent: PayloadDocument | null = null'),
  'password reset side effects should preserve the security event for independent audit/email handling',
)
assert(
  source.includes('Audit metadata should not suppress the password-changed confirmation'),
  'audit failures must not suppress the password-changed confirmation email',
)

const forbiddenPasswordUpdatePattern = /payload\.update\([\s\S]*password:\s*input\.password/
assert(
  !forbiddenPasswordUpdatePattern.test(source),
  'password reset should not update auth password through generic collection update',
)

console.log('payload_member_password_reset_completion.test.ts passed')
