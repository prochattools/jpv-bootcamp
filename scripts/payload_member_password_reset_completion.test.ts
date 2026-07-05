import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/lib/members/completePasswordReset.ts', 'utf8')

const validationIndex = source.indexOf("actions.findCompletableAction(token, 'password_reset')")
const prepareIndex = source.indexOf('preparePayloadPasswordResetToken(payload, member.id, token)')
const resetIndex = source.indexOf('payload.resetPassword({')
const consumeIndex = source.indexOf("actions.completeAction(token, 'password_reset')")
const lockClearIndex = source.indexOf('loginAttempts: 0')

assert(validationIndex > -1, 'password reset should validate custom action before changing password')
assert(prepareIndex > validationIndex, 'Payload reset token should be prepared after custom action validation')
assert(resetIndex > prepareIndex, 'password reset should use Payload resetPassword after preparation')
assert(consumeIndex > resetIndex, 'custom action should be consumed only after Payload resetPassword succeeds')
assert(lockClearIndex > resetIndex, 'lockout should be cleared after successful reset')

const forbiddenPasswordUpdatePattern = /payload\.update\([\s\S]*password:\s*input\.password/
assert(
  !forbiddenPasswordUpdatePattern.test(source),
  'password reset should not update auth password through generic collection update',
)

console.log('payload_member_password_reset_completion.test.ts passed')
