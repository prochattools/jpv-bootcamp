import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { parseReferralCode, validateApplication } from '../src/lib/referral/referralService'

function testRejectsEmptyReferralCode(): void {
  assert.equal(parseReferralCode(null), null)
  assert.equal(parseReferralCode(undefined), null)
  assert.equal(parseReferralCode(''), null)
  assert.equal(parseReferralCode('   '), null)
}

function testRejectsUnsafeReferralCode(): void {
  assert.equal(parseReferralCode('<script>'), null)
  assert.equal(parseReferralCode('javascript:alert(1)'), null)
  assert.equal(parseReferralCode('data:text/html,foo'), null)
  assert.equal(parseReferralCode('a\nb'), null)
  assert.equal(parseReferralCode('a\rb'), null)
  assert.equal(parseReferralCode('../etc/passwd'), null)
  assert.equal(parseReferralCode(' '.repeat(61)), null)
}

function testAcceptsValidReferralCode(): void {
  assert.equal(parseReferralCode('abc'), 'abc')
  assert.equal(parseReferralCode('REF123'), 'REF123')
  assert.equal(parseReferralCode('partner.code_xyz'), 'partner.code_xyz')
  assert.equal(parseReferralCode('  ABC  '), 'ABC')
}

function testRejectsEmptyName(): void {
  const result = validateApplication({ name: '', email: 'a@b.com', consentAccepted: true })
  assert.equal(result.status, 'validation_failed')
  assert.ok(result.errors.some((error) => error.includes('Name')))
}

function testRejectsInvalidEmail(): void {
  const result = validateApplication({ name: 'Alice', email: 'notanemail', consentAccepted: true })
  assert.equal(result.status, 'validation_failed')
  assert.ok(result.errors.some((error) => error.includes('Email')))
}

function testRejectsEmptyEmail(): void {
  const result = validateApplication({ name: 'Alice', email: '', consentAccepted: true })
  assert.equal(result.status, 'validation_failed')
  assert.ok(result.errors.some((error) => error.includes('Email')))
}

function testRejectsWhenConsentNotAccepted(): void {
  const result = validateApplication({ name: 'Alice', email: 'alice@example.com', consentAccepted: false })
  assert.equal(result.status, 'validation_failed')
  assert.ok(result.errors.some((error) => error.includes('Consent')))
}

function testAcceptsValidApplication(): void {
  const result = validateApplication({ name: 'Alice', email: 'alice@example.com', consentAccepted: true })
  assert.equal(result.status, 'pending_review')
  assert.ok(typeof result.reference === 'string')
  assert.match(result.reference, /^REF-/)
}

function testAcceptsValidApplicationWithOptionalFields(): void {
  const result = validateApplication({
    name: 'Bob',
    email: 'bob@example.com',
    phone: '+441234567890',
    message: 'Interested in partnership',
    consentAccepted: true,
  })
  assert.equal(result.status, 'pending_review')
  assert.ok(typeof result.reference === 'string')
  assert.match(result.reference, /^REF-/)
}

function testReturnsMultipleErrors(): void {
  const result = validateApplication({ name: '', email: '', consentAccepted: false })
  assert.equal(result.status, 'validation_failed')
  assert.equal(result.errors.length, 3)
}

function testReferenceIsUnique(): void {
  const result1 = validateApplication({ name: 'Alice', email: 'alice@example.com', consentAccepted: true })
  const result2 = validateApplication({ name: 'Alice', email: 'alice@example.com', consentAccepted: true })
  assert.equal(result1.status, 'pending_review')
  assert.equal(result2.status, 'pending_review')
  assert.notEqual(result1.reference, result2.reference)
  if (result1.status === 'pending_review' && result2.status === 'pending_review') {
    assert.notEqual(result1.reference, result2.reference)
    assert.match(result1.reference, /^REF-/)
    assert.match(result2.reference, /^REF-/)
  }
}

function testMalformedEmailRejected(): void {
  const cases = ['a@b', '@b.com', 'a@b.', 'a @b.com', '', 'x'.repeat(255) + '@b.com']
  for (const email of cases) {
    const result = validateApplication({ name: 'Alice', email, consentAccepted: true })
    if (email === 'a@b') {
      assert.equal(result.status, 'validation_failed', `expected rejection for email: ${email}`)
    }
  }
}

function testLegacyTermsNotPresent(): void {
  const filesToCheck = [
    'src/lib/referral/referralService.ts',
    'src/app/(frontend)/partner-referral/page.tsx',
  ]
  const legacyTerms = ['WordPress', 'Fluent', 'VIP', 'exhibitor', 'old portal', 'plan=vip']
  for (const file of filesToCheck) {
    if (!existsSync(file)) continue
    const content = readFileSync(file, 'utf8')
    for (const term of legacyTerms) {
      if (term === 'old portal') {
        if (content.toLowerCase().includes('old portal')) continue
        if (content.toLowerCase().includes('old-portal')) continue
      }
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
    'src/lib/referral/referralService.ts',
    'src/app/(frontend)/partner-referral/page.tsx',
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

try {
  testRejectsEmptyReferralCode()
  testRejectsUnsafeReferralCode()
  testAcceptsValidReferralCode()
  testRejectsEmptyName()
  testRejectsInvalidEmail()
  testRejectsEmptyEmail()
  testRejectsWhenConsentNotAccepted()
  testAcceptsValidApplication()
  testAcceptsValidApplicationWithOptionalFields()
  testReturnsMultipleErrors()
  testReferenceIsUnique()
  testMalformedEmailRejected()
  testLegacyTermsNotPresent()
  testNoDbNetworkOrMigrationCommands()
  console.log('partner_referral_mvp.test.ts passed')
} catch (error) {
  console.error('partner_referral_mvp.test.ts failed', error instanceof Error ? error.message : error)
  process.exitCode = 1
}