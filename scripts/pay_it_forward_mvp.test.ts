import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import {
  validateSponsorIntent,
  validateRecipientApplication,
  parseSupportCode,
} from '../src/lib/support/payItForwardService'

function testValidSponsorIntentAccepted(): void {
  const result = validateSponsorIntent({ name: 'Alice Donor', email: 'alice@example.com' })
  assert.equal(result.status, 'manual_follow_up')
  if (result.status === 'manual_follow_up') {
    assert.match(result.reference, /^SPN-/)
  }
}

function testValidSponsorIntentWithMessage(): void {
  const result = validateSponsorIntent({
    name: 'Bob Donor',
    email: 'bob@example.com',
    message: 'Happy to support',
  })
  assert.equal(result.status, 'manual_follow_up')
  if (result.status === 'manual_follow_up') {
    assert.match(result.reference, /^SPN-/)
  }
}

function testInvalidSponsorEmailRejected(): void {
  const result = validateSponsorIntent({ name: 'Alice', email: 'notanemail' })
  assert.equal(result.status, 'validation_failed')
  assert.ok(result.errors.some((error) => error.includes('Email')))
}

function testEmptySponsorNameRejected(): void {
  const result = validateSponsorIntent({ name: '', email: 'alice@example.com' })
  assert.equal(result.status, 'validation_failed')
  assert.ok(result.errors.some((error) => error.includes('Name')))
}

function testValidRecipientApplicationAccepted(): void {
  const result = validateRecipientApplication({
    name: 'Charlie Recipient',
    email: 'charlie@example.com',
    reason: 'I cannot afford Pro membership right now.',
    consentAccepted: true,
  })
  assert.equal(result.status, 'pending_review')
  if (result.status === 'pending_review') {
    assert.match(result.reference, /^PIF-/)
  }
}

function testMissingRecipientReasonRejected(): void {
  const result = validateRecipientApplication({
    name: 'Charlie',
    email: 'charlie@example.com',
    reason: '',
    consentAccepted: true,
  })
  assert.equal(result.status, 'validation_failed')
  assert.ok(result.errors.some((error) => error.includes('Reason')))
}

function testMissingConsentRejected(): void {
  const result = validateRecipientApplication({
    name: 'Charlie',
    email: 'charlie@example.com',
    reason: 'I need help.',
    consentAccepted: false,
  })
  assert.equal(result.status, 'validation_failed')
  assert.ok(result.errors.some((error) => error.includes('Consent')))
}

function testUnsafeSupportCodeRejected(): void {
  assert.equal(parseSupportCode(null), null)
  assert.equal(parseSupportCode(''), null)
  assert.equal(parseSupportCode('<script>'), null)
  assert.equal(parseSupportCode('javascript:alert(1)'), null)
  assert.equal(parseSupportCode('../etc'), null)
  assert.equal(parseSupportCode(' '.repeat(61)), null)
}

function testValidSupportCodeAccepted(): void {
  assert.equal(parseSupportCode('ABC123'), 'ABC123')
  assert.equal(parseSupportCode('support.code_v2'), 'support.code_v2')
  assert.equal(parseSupportCode('   VALID   '), 'VALID')
}

function testMultipleErrorsReturned(): void {
  const result = validateRecipientApplication({
    name: '',
    email: '',
    reason: '',
    consentAccepted: false,
  })
  assert.equal(result.status, 'validation_failed')
  assert.ok(result.errors.length >= 3)
}

function testReferenceIsUnique(): void {
  const r1 = validateSponsorIntent({ name: 'A', email: 'a@example.com' })
  const r2 = validateSponsorIntent({ name: 'A', email: 'a@example.com' })
  if (r1.status === 'manual_follow_up' && r2.status === 'manual_follow_up') {
    assert.notEqual(r1.reference, r2.reference)
  }
}

function testSupportRedirectExists(): void {
  const path = 'src/app/(frontend)/support/page.tsx'
  assert.ok(existsSync(path), `support redirect should exist at ${path}`)
  const content = readFileSync(path, 'utf8')
  assert.ok(content.includes("redirect("), 'support page must use redirect()')
}

function testPortalSupportPageCopyIsCorrect(): void {
  const content = readFileSync('src/app/(frontend)/portal/support/page.tsx', 'utf8')
  assert.match(content, /same membership lifecycle/i)
  assert.match(content, /manual follow-up|manual review/i)
  assert.match(content, /funded membership/i)
  assert.match(content, /View JPV Bootcamp Membership/i)
}

function testLegacyTermsNotPresent(): void {
  const filesToCheck = [
    'src/lib/support/payItForwardService.ts',
    'src/app/(frontend)/support/page.tsx',
    'src/app/(frontend)/portal/support/page.tsx',
  ]
  const legacyTerms = ['WordPress', 'Fluent', 'VIP', 'exhibitor', 'old portal', 'plan=vip']
  for (const file of filesToCheck) {
    if (!existsSync(file)) continue
    const content = readFileSync(file, 'utf8')
    for (const term of legacyTerms) {
      assert.doesNotMatch(
        content,
        new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
        `${file} must not contain legacy term: ${term}`,
      )
    }
  }
}

function testNoDbNetworkOrMigrationCommands(): void {
  const filesToCheck = [
    'src/lib/support/payItForwardService.ts',
    'src/app/(frontend)/support/page.tsx',
    'src/app/(frontend)/portal/support/page.tsx',
  ]
  const forbidden = ['prisma.', 'payload.', 'fetch(', 'axios', 'https.request', '.env', 'DATABASE_URL']
  for (const file of filesToCheck) {
    const content = readFileSync(file, 'utf8')
    for (const pattern of forbidden) {
      assert.doesNotMatch(
        content,
        new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
        `${file} must not contain: ${pattern}`,
      )
    }
  }
}

function testStripeSponsoredLifecycleContracts(): void {
	const seats = readFileSync('src/lib/sponsored-seats.ts', 'utf8')
	assert.match(seats, /checkout_session:/)
	assert.match(seats, /thank-you\/sponsor/)

	const recipient = readFileSync('src/lib/sponsored-recipient.ts', 'utf8')
	assert.match(recipient, /sponsored_recipient/)
	assert.match(recipient, /trial_period_days: SPONSORED_TRIAL_DAYS/)
	assert.match(recipient, /payment_method_collection: 'always'/)
	assert.match(recipient, /finalizeSponsoredRecipientCheckout/)

	const webhook = readFileSync('src/lib/stripe-webhook-handler.ts', 'utf8')
	assert.match(webhook, /isSponsoredRecipientSession/)
	assert.match(webhook, /finalizeSponsoredRecipientCheckout/)
	assert.match(webhook, /checkout\.session\.expired/)
}

function testProductionMigrationContracts(): void {
	const migration = readFileSync(
		'prisma/migrations/20260827090000_align_sponsored_seat_lifecycle/migration.sql',
		'utf8',
	)
	assert.match(migration, /tier = 'free'/)
	assert.match(migration, /status IN \('pending', 'processing', 'approved', 'claimed', 'rejected'\)/)
	assert.doesNotMatch(migration, /tier IN \('pro'\)/)

	const runner = readFileSync('scripts/release/run-production-prisma-migrations.sh', 'utf8')
	assert.match(runner, /DEPLOYMENT_ENV.*production/)
	assert.match(runner, /DATABASE_URL schema does not match the production boundary/)
	assert.match(runner, /prisma migrate deploy --schema=prisma\/system\.prisma/)

	const workflow = readFileSync('.github/workflows/production-prisma-migrations.yml', 'utf8')
	assert.match(workflow, /apply-prisma-migrations-production/)
	assert.match(workflow, /I_2Vukga3cc3ZhaG-mUzU/)
	assert.match(workflow, /clients-jpv-bootcamp-app-tp9xrk/)
	assert.match(workflow, /runProductionPrismaMigration\.mts/)
}

try {
  testValidSponsorIntentAccepted()
  testValidSponsorIntentWithMessage()
  testInvalidSponsorEmailRejected()
  testEmptySponsorNameRejected()
  testValidRecipientApplicationAccepted()
  testMissingRecipientReasonRejected()
  testMissingConsentRejected()
  testUnsafeSupportCodeRejected()
  testValidSupportCodeAccepted()
  testMultipleErrorsReturned()
  testReferenceIsUnique()
  testSupportRedirectExists()
  testPortalSupportPageCopyIsCorrect()
  testLegacyTermsNotPresent()
  testNoDbNetworkOrMigrationCommands()
  testStripeSponsoredLifecycleContracts()
  testProductionMigrationContracts()
  console.log('pay_it_forward_mvp.test.ts passed')
} catch (error) {
  console.error('pay_it_forward_mvp.test.ts failed', error instanceof Error ? error.message : error)
  process.exitCode = 1
}
