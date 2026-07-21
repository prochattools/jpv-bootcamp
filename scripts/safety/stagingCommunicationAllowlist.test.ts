import assert from 'node:assert/strict'
import {
  normaliseEmail,
  assertAllowlistedRecipient,
  assertAllowlistedBatch,
  assertCrmApplyAllowlisted,
  assertInvitationApplyAllowlisted,
  assertNotProductionApp,
  assertStagingAppOnly,
  assertStagingOrigin,
  StagingAllowlistViolation,
} from './stagingCommunicationAllowlist'

// ─── normaliseEmail ──────────────────────────────────────────────────────────

function testNormaliseEmailTrimsAndLowercases() {
  assert.equal(normaliseEmail('  Info@ProChat.Tools  '), 'info@prochat.tools')
  assert.equal(normaliseEmail('INFO@PROCHAT.TOOLS'), 'info@prochat.tools')
  assert.equal(normaliseEmail('info@prochat.tools'), 'info@prochat.tools')
}
testNormaliseEmailTrimsAndLowercases()
console.log('PASS testNormaliseEmailTrimsAndLowercases')

// ─── assertAllowlistedRecipient ──────────────────────────────────────────────

function testAllowlistedRecipientPassesForAllowed() {
  assert.doesNotThrow(() => assertAllowlistedRecipient('info@prochat.tools'))
  assert.doesNotThrow(() => assertAllowlistedRecipient('INFO@PROCHAT.TOOLS'))
  assert.doesNotThrow(() => assertAllowlistedRecipient('  info@prochat.tools  '))
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
    StagingAllowlistViolation,
  )
  assert.throws(
    () => assertAllowlistedRecipient('info@prochat.tools.evil.com'),
    StagingAllowlistViolation,
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
    () => assertAllowlistedBatch(['info@prochat.tools', 'info@prochat.tools']),
    StagingAllowlistViolation,
  )
}
testBatchRejectsMultipleRecipients()
console.log('PASS testBatchRejectsMultipleRecipients')

function testBatchRejectsMixedRecipients() {
  assert.throws(
    () => assertAllowlistedBatch(['info@prochat.tools', 'alice@example.com']),
    StagingAllowlistViolation,
  )
}
testBatchRejectsMixedRecipients()
console.log('PASS testBatchRejectsMixedRecipients')

function testBatchAcceptsSingleAllowlisted() {
  assert.doesNotThrow(() => assertAllowlistedBatch(['info@prochat.tools']))
  assert.doesNotThrow(() => assertAllowlistedBatch(['INFO@PROCHAT.TOOLS']))
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
    () => assertCrmApplyAllowlisted('apply', ['info@prochat.tools', 'alice@example.com']),
    StagingAllowlistViolation,
  )
}
testCrmApplyBlocksDisallowedEmails()
console.log('PASS testCrmApplyBlocksDisallowedEmails')

function testCrmApplyAcceptsOnlyAllowlisted() {
  assert.doesNotThrow(() => assertCrmApplyAllowlisted('apply', ['info@prochat.tools']))
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
    () => assertCrmApplyAllowlisted('unknown-mode', ['info@prochat.tools']),
    StagingAllowlistViolation,
  )
}
testCrmRejectsUnknownMode()
console.log('PASS testCrmRejectsUnknownMode')

// ─── assertInvitationApplyAllowlisted ────────────────────────────────────────

function testInvitationRejectsMissingFlag() {
  assert.throws(
    () => assertInvitationApplyAllowlisted(undefined, ['info@prochat.tools']),
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
    () => assertInvitationApplyAllowlisted('info@prochat.tools', [
      'info@prochat.tools',
      'alice@example.com',
    ]),
    StagingAllowlistViolation,
  )
}
testInvitationRejectsMultipleRows()
console.log('PASS testInvitationRejectsMultipleRows')

function testInvitationRejectsMismatchedCohort() {
  assert.throws(
    () => assertInvitationApplyAllowlisted('info@prochat.tools', ['different@example.com']),
    StagingAllowlistViolation,
  )
}
testInvitationRejectsMismatchedCohort()
console.log('PASS testInvitationRejectsMismatchedCohort')

function testInvitationRejectsEmptyCohort() {
  assert.throws(
    () => assertInvitationApplyAllowlisted('info@prochat.tools', []),
    StagingAllowlistViolation,
  )
}
testInvitationRejectsEmptyCohort()
console.log('PASS testInvitationRejectsEmptyCohort')

function testInvitationPassesValidSingle() {
  assert.doesNotThrow(
    () => assertInvitationApplyAllowlisted('info@prochat.tools', ['info@prochat.tools']),
  )
  assert.doesNotThrow(
    () => assertInvitationApplyAllowlisted('INFO@PROCHAT.TOOLS', ['info@prochat.tools']),
  )
}
testInvitationPassesValidSingle()
console.log('PASS testInvitationPassesValidSingle')

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
  assert.doesNotThrow(() => assertNotProductionApp('clients-jpv-bootcamp-app-tp9xrk'))
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
  assert.doesNotThrow(() => assertStagingAppOnly('clients-jpv-bootcamp-app-tp9xrk'))
}
testStagingAppOnlyAcceptsStaging()
console.log('PASS testStagingAppOnlyAcceptsStaging')

// ─── assertStagingOrigin ────────────────────────────────────────────────────

function testStagingOriginAcceptsPreview() {
  assert.doesNotThrow(() => assertStagingOrigin('https://preview.jpvbootcamp.com/api/health'))
  assert.doesNotThrow(() => assertStagingOrigin('https://preview.jpvbootcamp.com'))
}
testStagingOriginAcceptsPreview()
console.log('PASS testStagingOriginAcceptsPreview')

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

console.log('\nstaging communication allowlist tests: 26/26 PASSED')
