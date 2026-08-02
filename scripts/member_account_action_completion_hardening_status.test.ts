import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const service = readFileSync('src/lib/auth/memberAccountActions.ts', 'utf8')
const invitation = readFileSync('src/lib/members/completeMemberSetup.ts', 'utf8')
const passwordReset = readFileSync('src/lib/members/completePasswordReset.ts', 'utf8')
const emailChange = readFileSync('src/lib/members/changeMemberEmail.ts', 'utf8')
const readiness = readFileSync('docs/PREVIEW_RELEASE_READINESS.md', 'utf8')
const hardening = readFileSync('docs/ADVERSARIAL_REVIEW_HARDENING_2026_07_22.md', 'utf8')
const DESIGN_DOC_PATH = 'docs/security/MEMBER_ACCOUNT_ACTION_RESERVATION_FINALIZATION_DESIGN.md'

function position(source: string, value: string): number {
  const index = source.indexOf(value)
  assert(index >= 0, `expected source marker: ${value}`)
  return index
}

function lastPosition(source: string, value: string): number {
  const index = source.lastIndexOf(value)
  assert(index >= 0, `expected source marker: ${value}`)
  return index
}

const invitationValidate = position(
  invitation,
  "actions.findCompletableAction(token, 'member_invitation')",
)
const invitationUpdate = position(invitation, 'const updated = await payload.update({')
// Use lastIndexOf because there is also an early idempotency-return consume before the
// activation path. The primary completion consume is the last occurrence, after the update.
const invitationConsume = lastPosition(
  invitation,
  "actions.completeAction(token, 'member_invitation')",
)
assert(
  invitationValidate < invitationUpdate && invitationUpdate < invitationConsume,
  'invitation completion must validate before activation and consume only after activation succeeds',
)

const resetValidate = position(
  passwordReset,
  "actions.findCompletableAction(token, 'password_reset')",
)
const resetMutation = position(passwordReset, 'await payload.resetPassword({')
const resetConsume = position(
  passwordReset,
  "actions.completeAction(token, 'password_reset')",
)
assert(
  resetValidate < resetMutation && resetMutation < resetConsume,
  'password reset must validate before reset and consume only after the reset succeeds',
)

const emailConsume = position(
  emailChange,
  "actions.completeAction(token, 'email_change_confirmation')",
)
const emailMutation = position(emailChange, 'await payload.update({')
assert(
  emailConsume < emailMutation,
  'open hardening status changed: update this guard only with a concurrency-safe reservation/finalization repair',
)

assert.doesNotMatch(
  service,
  /reserveAction|finalizeAction|completeActionWith|withLockedAction/,
  'a reservation/finalization primitive now exists; replace this open-status guard with behavioral concurrency tests',
)
assert.match(
  readiness,
  /STAGING TECHNICAL IMPLEMENTATION COMPLETE — ACCEPTANCE PENDING EXTERNAL ACTION/,
)
assert.match(readiness, /STAGING HARDENING REMEDIATION REQUIRED/)
assert.match(hardening, /OPEN — DURABLE RESERVATION\/FINALIZATION REQUIRED/)

assert.ok(
  existsSync(DESIGN_DOC_PATH),
  `design document must exist at ${DESIGN_DOC_PATH} before hardening is considered specified`,
)
const design = readFileSync(DESIGN_DOC_PATH, 'utf8')
assert.match(design, /pending|reserved|consumed/i, 'design must specify the state machine')
assert.match(design, /reserved-at|reservation.*timestamp|lease.*expiry/i, 'design must specify durable reservation fields')
assert.match(design, /behavioral.*test|concurrency.*test|test.*required/i, 'design must specify required behavioral tests')
assert.match(design, /migration.*authorization|staging.*authorization/i, 'design must require authorization before schema application')

console.log('member_account_action_completion_hardening_status.test.ts passed')
