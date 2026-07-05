import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const formSource = readFileSync('src/components/member/PasswordWorkflowForms.tsx', 'utf8')
const resetFormStart = formSource.indexOf('export function ResetPasswordForm')
const setPasswordFormStart = formSource.indexOf('export function SetPasswordForm')
assert(resetFormStart > -1, 'ResetPasswordForm must exist')
assert(setPasswordFormStart > resetFormStart, 'SetPasswordForm must follow ResetPasswordForm')

const resetFormSource = formSource.slice(resetFormStart, setPasswordFormStart)

assert(
  resetFormSource.includes("fetch('/api/member-password/reset'"),
  'ResetPasswordForm must submit through the JSON reset API',
)
assert(
  resetFormSource.includes("'Content-Type': 'application/json'"),
  'ResetPasswordForm must send JSON to the reset API',
)
assert(
  !resetFormSource.includes('completePasswordResetAction'),
  'ResetPasswordForm must not use the server action transport',
)
assert(
  resetFormSource.includes('response.headers.get'),
  'ResetPasswordForm must guard non-JSON responses',
)

console.log('payload_member_password_forms.test.ts passed')
