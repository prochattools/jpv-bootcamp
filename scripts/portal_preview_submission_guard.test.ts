import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const SUPPORT_PAGE = 'src/app/(frontend)/portal/support/page.tsx'
const REFERRAL_PAGE = 'src/app/(frontend)/portal/partner-referral/page.tsx'

function assertPreviewOnly(path: string): void {
  const content = readFileSync(path, 'utf8')

  assert.ok(content.includes('Preview only'), `${path} must label the form as preview-only`)
  assert.ok(content.includes('Submission unavailable in preview'), `${path} must disable submission`)
  assert.ok(content.includes('disabled'), `${path} must render disabled controls`)
  assert.equal(content.includes('Math.random'), false, `${path} must not generate random references`)
  assert.equal(content.includes('Date.now'), false, `${path} must not generate timestamp references`)
  assert.equal(content.includes('setResult'), false, `${path} must not simulate success state`)
  assert.equal(content.includes('setSponsorResult'), false, `${path} must not simulate sponsor success`)
  assert.equal(content.includes('setRecipientResult'), false, `${path} must not simulate recipient success`)
  assert.equal(content.includes('handleSubmit'), false, `${path} must not expose a submit handler`)
  assert.equal(content.includes('handleSponsorSubmit'), false, `${path} must not expose sponsor submission`)
  assert.equal(content.includes('handleRecipientSubmit'), false, `${path} must not expose recipient submission`)
  assert.equal(content.includes('validateApplication'), false, `${path} must not treat validation as persistence`)
  assert.equal(content.includes('validateSponsorIntent'), false, `${path} must not treat validation as persistence`)
  assert.equal(content.includes('validateRecipientApplication'), false, `${path} must not treat validation as persistence`)
  assert.equal(content.includes('has been submitted'), false, `${path} must not claim submission`)
  assert.equal(content.includes('has been recorded'), false, `${path} must not claim recording`)
  assert.equal(content.includes('Reference:'), false, `${path} must not display a generated reference`)
  assert.equal(content.includes('payItForwardService'), false, `${path} must not import support persistence helpers`)
  assert.equal(content.includes('referralService'), false, `${path} must not import referral persistence helpers`)
}

function testSupportPreview(): void {
  assertPreviewOnly(SUPPORT_PAGE)
  const content = readFileSync(SUPPORT_PAGE, 'utf8')
  assert.ok(content.includes('do not submit, create records, send notifications, or generate references'))
}

function testPartnerReferralPreview(): void {
  assertPreviewOnly(REFERRAL_PAGE)
  const content = readFileSync(REFERRAL_PAGE, 'utf8')
  assert.ok(content.includes('does not submit, create a record, send a notification, or generate a reference'))
}

try {
  testSupportPreview()
  testPartnerReferralPreview()
  console.log('portal_preview_submission_guard.test.ts passed')
} catch (error) {
  console.error(
    'portal_preview_submission_guard.test.ts failed',
    error instanceof Error ? error.message : error,
  )
  process.exitCode = 1
}
