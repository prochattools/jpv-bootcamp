import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/lib/members/completePasswordReset.ts', 'utf8')

const validationIndex = source.indexOf("actions.findCompletableAction(token, 'password_reset')")
const prepareIndex = source.indexOf('preparePayloadPasswordResetToken(payload, member.id, token)')
const resetIndex = source.indexOf('payload.resetPassword({')
const consumeIndex = source.indexOf("actions.completeAction(token, 'password_reset')")
const lockClearIndex = source.indexOf('loginAttempts: 0')
const cleanupFallbackIndex = source.indexOf('Password reset has already succeeded; cleanup failures must not consume the link with an error.')
const securityEventDefinitionIndex = source.indexOf("eventType: 'password_changed'")
const securityEventIndex = source.indexOf('createPasswordChangedSecurityEvent(payload, member.id)')
const auditIndex = source.indexOf("action: 'member.password.reset.completed'")
const emailDefinitionIndex = source.indexOf("templateKey: 'member-password-changed'")
const emailIndex = source.indexOf('queuePasswordChangedConfirmation(payload,')
const confirmationFailureIndex = source.indexOf("action: 'member.password.reset.confirmation_failed'")
const securityFallbackIndex = source.indexOf("INSERT INTO ${table} (")
const emailFallbackIndex = source.indexOf("'member-password-changed', 'queued'")

assert(validationIndex > -1, 'password reset should validate custom action before changing password')
assert(prepareIndex > validationIndex, 'Payload reset token should be prepared after custom action validation')
assert(resetIndex > prepareIndex, 'password reset should use Payload resetPassword after preparation')
assert(consumeIndex > resetIndex, 'custom action should be consumed only after Payload resetPassword succeeds')
assert(lockClearIndex > resetIndex, 'lockout should be cleared after successful reset')
assert(cleanupFallbackIndex > lockClearIndex, 'lockout cleanup failures must not make a consumed reset action look invalid')
assert(securityEventDefinitionIndex > -1, 'password_changed security event helper should persist the event type')
assert(securityEventIndex > lockClearIndex, 'password_changed security event should be recorded after successful reset cleanup')
assert(auditIndex > securityEventIndex, 'reset completion audit should follow the password_changed security event')
assert(emailDefinitionIndex > -1, 'password-changed confirmation helper should use the confirmation template')
assert(emailIndex > securityEventIndex, 'password-changed confirmation should queue after the security event exists')
assert(confirmationFailureIndex > emailIndex, 'confirmation queue failures should be audited after queue attempt')
assert(securityFallbackIndex > -1, 'password_changed security event should have a DB fallback for auth-collection access failures')
assert(emailFallbackIndex > -1, 'password-changed confirmation should have a DB fallback for queue persistence failures')
assert(
  source.includes('let securityEvent: PayloadDocument | null = null'),
  'password reset side effects should preserve the security event for independent audit/email handling',
)
assert(
  source.includes('resolveQueryClient(payload)'),
  'password reset side-effect fallbacks should use the Payload database client',
)
assert(
  source.includes('getMemberEmailVerificationSchema()'),
  'password reset side-effect fallbacks should resolve the configured Payload schema',
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
