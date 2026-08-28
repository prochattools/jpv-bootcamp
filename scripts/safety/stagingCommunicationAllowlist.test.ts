import assert from 'node:assert/strict'

// Set env vars BEFORE importing the module (fail-closed requires them)
const TEST_RECIPIENT = 'test-staging@example.invalid'
const TEST_MEMBER = 'test-member@example.invalid'
process.env.STAGING_TEST_RECIPIENT_EMAIL = TEST_RECIPIENT
process.env.STAGING_TEST_MEMBER_EMAIL = TEST_MEMBER

import {
  normaliseEmail,
  assertAllowlistedRecipient,
  assertAllowlistedBatch,
  assertCrmApplyAllowlisted,
  assertInvitationApplyAllowlisted,
  assertNotProductionApp,
  assertStagingAppOnly,
  assertStagingOrigin,
  getStagingTestRecipientEmail,
  getStagingTestMemberEmail,
  StagingAllowlistViolation,
} from './stagingCommunicationAllowlist'

// ─── normaliseEmail ──────────────────────────────────────────────────────────

function testNormaliseEmailTrimsAndLowercases() {
  assert.equal(normaliseEmail('  Foo@Bar.Com  '), 'foo@bar.com')
  assert.equal(normaliseEmail('FOO@BAR.COM'), 'foo@bar.com')
  assert.equal(normaliseEmail('foo@bar.com'), 'foo@bar.com')
}
testNormaliseEmailTrimsAndLowercases()
console.log('PASS testNormaliseEmailTrimsAndLowercases')

// ─── getStagingTestRecipientEmail / getStagingTestMemberEmail ─────────────────

function testEnvAccessorsReturnNormalisedValues() {
  assert.equal(getStagingTestRecipientEmail(), TEST_RECIPIENT)
  assert.equal(getStagingTestMemberEmail(), TEST_MEMBER)
}
testEnvAccessorsReturnNormalisedValues()
console.log('PASS testEnvAccessorsReturnNormalisedValues')

// ─── assertAllowlistedRecipient ──────────────────────────────────────────────

function testAllowlistedRecipientPassesForAllowed() {
  assert.doesNotThrow(() => assertAllowlistedRecipient(TEST_RECIPIENT))
  assert.doesNotThrow(() => assertAllowlistedRecipient(TEST_RECIPIENT.toUpperCase()))
  assert.doesNotThrow(() => assertAllowlistedRecipient(`  ${TEST_RECIPIENT}  `))
}
testAllowlistedRecipientPassesForAllowed()
console.log('PASS testAllowlistedRecipientPassesForAllowed')

function testAllowlistedRecipientRejectsOtherEmails() {
  assert.throws(
    () => assertAllowlistedRecipient('alice@example.com'),
    StagingAllowlistViolation,
  )
  assert.throws(
    () => assertAllowlistedRecipient('steve@jpvbootcamp.com'),
    StagingAllowlistViolation,
  )
  assert.throws(
    () => assertAllowlistedRecipient(''),
    (e: unknown) => e instanceof Error,
  )
}
testAllowlistedRecipientRejectsOtherEmails()
console.log('PASS testAllowlistedRecipientRejectsOtherEmails')

// ─── assertAllowlistedBatch ──────────────────────────────────────────────────

function testBatchRejectsEmpty() {
  assert.throws(() => assertAllowlistedBatch([]), StagingAllowlistViolation)
}
testBatchRejectsEmpty()
console.log('PASS testBatchRejectsEmpty')

function testBatchRejectsMultipleRecipients() {
  assert.throws(
    () => assertAllowlistedBatch([TEST_RECIPIENT, TEST_RECIPIENT]),
    StagingAllowlistViolation,
  )
}
testBatchRejectsMultipleRecipients()
console.log('PASS testBatchRejectsMultipleRecipients')

function testBatchRejectsMixedRecipients() {
  assert.throws(
    () => assertAllowlistedBatch([TEST_RECIPIENT, 'alice@example.com']),
    StagingAllowlistViolation,
  )
}
testBatchRejectsMixedRecipients()
console.log('PASS testBatchRejectsMixedRecipients')

function testBatchAcceptsSingleAllowlisted() {
  assert.doesNotThrow(() => assertAllowlistedBatch([TEST_RECIPIENT]))
  assert.doesNotThrow(() => assertAllowlistedBatch([TEST_RECIPIENT.toUpperCase()]))
}
testBatchAcceptsSingleAllowlisted()
console.log('PASS testBatchAcceptsSingleAllowlisted')

function testBatchRejectsSingleDisallowed() {
  assert.throws(
    () => assertAllowlistedBatch(['other@example.com']),
    StagingAllowlistViolation,
  )
}
testBatchRejectsSingleDisallowed()
console.log('PASS testBatchRejectsSingleDisallowed')

// ─── assertCrmApplyAllowlisted ──────────────────────────────────────────────

function testCrmValidateDryRunPassThrough() {
  assert.doesNotThrow(() => assertCrmApplyAllowlisted('validate', ['anyone@example.com']))
  assert.doesNotThrow(() => assertCrmApplyAllowlisted('dry-run', ['anyone@example.com']))
  assert.doesNotThrow(() => assertCrmApplyAllowlisted('rollback', ['anyone@example.com']))
}
testCrmValidateDryRunPassThrough()
console.log('PASS testCrmValidateDryRunPassThrough')

function testCrmApplyBlocksDisallowedEmails() {
  assert.throws(
    () => assertCrmApplyAllowlisted('apply', ['alice@example.com']),
    StagingAllowlistViolation,
  )
  assert.throws(
    () => assertCrmApplyAllowlisted('apply', [TEST_RECIPIENT, 'alice@example.com']),
    StagingAllowlistViolation,
  )
}
testCrmApplyBlocksDisallowedEmails()
console.log('PASS testCrmApplyBlocksDisallowedEmails')

function testCrmApplyAcceptsOnlyAllowlisted() {
  assert.doesNotThrow(() => assertCrmApplyAllowlisted('apply', [TEST_RECIPIENT]))
}
testCrmApplyAcceptsOnlyAllowlisted()
console.log('PASS testCrmApplyAcceptsOnlyAllowlisted')

function testCrmApplyRejectsEmptyList() {
  assert.throws(
    () => assertCrmApplyAllowlisted('apply', []),
    StagingAllowlistViolation,
  )
}
testCrmApplyRejectsEmptyList()
console.log('PASS testCrmApplyRejectsEmptyList')

function testCrmRejectsUnknownMode() {
  assert.throws(
    () => assertCrmApplyAllowlisted('unknown-mode', [TEST_RECIPIENT]),
    StagingAllowlistViolation,
  )
}
testCrmRejectsUnknownMode()
console.log('PASS testCrmRejectsUnknownMode')

// ─── assertInvitationApplyAllowlisted ────────────────────────────────────────

function testInvitationRejectsMissingFlag() {
  assert.throws(
    () => assertInvitationApplyAllowlisted(undefined, [TEST_MEMBER]),
    StagingAllowlistViolation,
  )
}
testInvitationRejectsMissingFlag()
console.log('PASS testInvitationRejectsMissingFlag')

function testInvitationRejectsDisallowedFlag() {
  assert.throws(
    () => assertInvitationApplyAllowlisted('alice@example.com', ['alice@example.com']),
    StagingAllowlistViolation,
  )
}
testInvitationRejectsDisallowedFlag()
console.log('PASS testInvitationRejectsDisallowedFlag')

function testInvitationRejectsMultipleRows() {
  assert.throws(
    () => assertInvitationApplyAllowlisted(TEST_MEMBER, [
      TEST_MEMBER,
      'alice@example.com',
    ]),
    StagingAllowlistViolation,
  )
}
testInvitationRejectsMultipleRows()
console.log('PASS testInvitationRejectsMultipleRows')

function testInvitationRejectsMismatchedCohort() {
  assert.throws(
    () => assertInvitationApplyAllowlisted(TEST_MEMBER, ['different@example.com']),
    StagingAllowlistViolation,
  )
}
testInvitationRejectsMismatchedCohort()
console.log('PASS testInvitationRejectsMismatchedCohort')

function testInvitationRejectsEmptyCohort() {
  assert.throws(
    () => assertInvitationApplyAllowlisted(TEST_MEMBER, []),
    StagingAllowlistViolation,
  )
}
testInvitationRejectsEmptyCohort()
console.log('PASS testInvitationRejectsEmptyCohort')

function testInvitationPassesValidSingle() {
  assert.doesNotThrow(
    () => assertInvitationApplyAllowlisted(TEST_MEMBER, [TEST_MEMBER]),
  )
  assert.doesNotThrow(
    () => assertInvitationApplyAllowlisted(TEST_MEMBER.toUpperCase(), [TEST_MEMBER]),
  )
}
testInvitationPassesValidSingle()
console.log('PASS testInvitationPassesValidSingle')

// ─── Env validation rejects invalid values ──────────────────────────────────

function testEnvValidationRejectsListValues() {
  const orig = process.env.STAGING_TEST_RECIPIENT_EMAIL
  try {
    process.env.STAGING_TEST_RECIPIENT_EMAIL = 'a@b.com, c@d.com'
    assert.throws(
      () => assertAllowlistedRecipient('a@b.com'),
      (e: unknown) => e instanceof Error && e.message.includes('single email'),
    )
  } finally {
    process.env.STAGING_TEST_RECIPIENT_EMAIL = orig
  }
}
testEnvValidationRejectsListValues()
console.log('PASS testEnvValidationRejectsListValues')

function testEnvValidationRejectsEmpty() {
  const orig = process.env.STAGING_TEST_RECIPIENT_EMAIL
  try {
    process.env.STAGING_TEST_RECIPIENT_EMAIL = ''
    assert.throws(
      () => assertAllowlistedRecipient('a@b.com'),
      (e: unknown) => e instanceof Error && e.message.includes('required'),
    )
  } finally {
    process.env.STAGING_TEST_RECIPIENT_EMAIL = orig
  }
}
testEnvValidationRejectsEmpty()
console.log('PASS testEnvValidationRejectsEmpty')

// ─── assertNotProductionApp ──────────────────────────────────────────────────

function testRejectsForbiddenProductionApp() {
  assert.throws(
    () => assertNotProductionApp('web-public-jpv-bootcamp-l66egq'),
    StagingAllowlistViolation,
  )
}
testRejectsForbiddenProductionApp()
console.log('PASS testRejectsForbiddenProductionApp')

function testAcceptsStagingApp() {
  assert.doesNotThrow(() => assertNotProductionApp('clients-jpv-bootcamp-preview-wjfqfd'))
}
testAcceptsStagingApp()
console.log('PASS testAcceptsStagingApp')

// ─── assertStagingAppOnly ────────────────────────────────────────────────────

function testStagingAppOnlyRejectsProduction() {
  assert.throws(
    () => assertStagingAppOnly('web-public-jpv-bootcamp-l66egq'),
    StagingAllowlistViolation,
  )
}
testStagingAppOnlyRejectsProduction()
console.log('PASS testStagingAppOnlyRejectsProduction')

function testStagingAppOnlyRejectsUnknown() {
  assert.throws(
    () => assertStagingAppOnly('some-random-app-id'),
    StagingAllowlistViolation,
  )
}
testStagingAppOnlyRejectsUnknown()
console.log('PASS testStagingAppOnlyRejectsUnknown')

function testStagingAppOnlyAcceptsStaging() {
  assert.doesNotThrow(() => assertStagingAppOnly('clients-jpv-bootcamp-preview-wjfqfd'))
  assert.doesNotThrow(() => assertStagingAppOnly('bZllV93NqsPZAFCsqDskb'))
}
testStagingAppOnlyAcceptsStaging()
console.log('PASS testStagingAppOnlyAcceptsStaging')

// ─── assertStagingOrigin ────────────────────────────────────────────────────

function testStagingOriginAcceptsStaging() {
  assert.doesNotThrow(() => assertStagingOrigin('https://staging.jpvbootcamp.com/api/health'))
  assert.doesNotThrow(() => assertStagingOrigin('https://staging.jpvbootcamp.com'))
}
testStagingOriginAcceptsStaging()
console.log('PASS testStagingOriginAcceptsStaging')

function testStagingOriginRejectsProduction() {
  assert.throws(
    () => assertStagingOrigin('https://jpvbootcamp.com/api/health'),
    StagingAllowlistViolation,
  )
}
testStagingOriginRejectsProduction()
console.log('PASS testStagingOriginRejectsProduction')

function testStagingOriginRejectsArbitrary() {
  assert.throws(
    () => assertStagingOrigin('https://evil.example.com/api'),
    StagingAllowlistViolation,
  )
}
testStagingOriginRejectsArbitrary()
console.log('PASS testStagingOriginRejectsArbitrary')

// ─── Error shape ────────────────────────────────────────────────────────────

function testErrorContainsOffendingEmails() {
  try {
    assertAllowlistedRecipient('bad@evil.com')
    assert.fail('should have thrown')
  } catch (e) {
    assert.ok(e instanceof StagingAllowlistViolation)
    assert.deepEqual(e.offendingEmails, ['bad@evil.com'])
    assert.match(e.message, /STAGING_ALLOWLIST_VIOLATION/)
  }
}
testErrorContainsOffendingEmails()
console.log('PASS testErrorContainsOffendingEmails')

// ─── Summary ────────────────────────────────────────────────────────────────

console.log('\nstaging communication allowlist tests: 28/28 PASSED')
