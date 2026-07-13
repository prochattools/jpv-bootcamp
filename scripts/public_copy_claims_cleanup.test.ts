import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const landing = readFileSync('src/app/(frontend)/page.tsx', 'utf8')
const terms = readFileSync('src/app/(frontend)/terms/page.tsx', 'utf8')
const privacy = readFileSync('src/app/(frontend)/privacy/page.tsx', 'utf8')
const config = readFileSync('src/config.ts', 'utf8')

function assertAbsent(source: string, phrases: string[], label: string): void {
  for (const phrase of phrases) {
    assert.equal(source.includes(phrase), false, `${label} must not contain: ${phrase}`)
  }
}

function testLandingClaimsAreApprovalSafe(): void {
  assertAbsent(
    landing,
    [
      'Friday, 24 April',
      '27 March 2026',
      'Subscriptions renew monthly',
      'cancel any time from your account',
      'completion certificate',
      'weekly newcomer clinic',
      'pro-rate instantly',
      'remaining balance is credited automatically',
      'proven deal-making framework',
      '14-day money-back guarantee',
      'Cancel anytime',
      'Choose a plan, cancel anytime',
      'A practical pathway from first deal to scaling a portfolio',
      'Accountability squads',
      'Monthly deal review live call',
      'Local meetups calendar',
      'ROI 17.8%',
      'Monthly commitment or annual upfront with one month free',
      'group pricing',
      'get back to you shortly',
      'reply shortly',
      'Property mastery starts here',
      'Train for Property Success with JPV',
      'unlock the member dashboard',
      'starter plan tailored to your goals',
    ],
    'landing page',
  )

  assert.ok(landing.includes('£80/month'), 'approved monthly price must remain visible')
  assert.ok(landing.includes('Initial 12-month commitment'), 'approved commitment wording must remain visible')
  assert.ok(landing.includes('£880 annual option paid upfront'), 'approved annual price must remain visible')
  assert.ok(
    landing.includes('ctaHref: "/portal/billing"'),
    'the authenticated Pro billing entry point must remain available',
  )
  assert.ok(landing.includes('href="/terms"'), 'landing page must link to canonical terms')
  assert.ok(landing.includes('href="/privacy"'), 'landing page must link to canonical privacy')
  assert.ok(
    landing.includes('Final module titles and learning-outcome wording are pending client approval.'),
    'unapproved programme wording must be reported as pending',
  )
}

function testTermsDoNotInventCommercialBehavior(): void {
  assertAbsent(
    terms,
    [
      'renew automatically',
      'cancel at any time',
      'refunds are available',
      'money-back guarantee',
      '14 days of purchase',
      'standard processing times',
      'decline refunds',
      'eligible plans',
    ],
    'terms page',
  )

  assert.ok(terms.includes('JPV Bootcamp'), 'terms must retain JPV branding')
  assert.ok(
    terms.includes('pending client and legal approval'),
    'terms must disclose the unresolved legal wording without inventing behavior',
  )
  assert.ok(terms.includes('processed through Stripe'), 'verified payment processor wording must remain')
}

function testPrivacyDoesNotInventPolicyPromises(): void {
  assertAbsent(
    privacy,
    [
      'We collect information you provide',
      'We use cookies and similar tracking technologies',
      'We do not sell your personal data',
      'We implement reasonable security measures',
      'You may request access, correction, or deletion',
      'You may opt out of marketing communications',
      'Hosting and analytics providers',
      'Legal authorities if required',
    ],
    'privacy page',
  )

  assert.ok(privacy.includes('JPV Bootcamp'), 'privacy must retain JPV branding')
  assert.ok(
    privacy.includes('pending client and legal approval'),
    'privacy must disclose the unresolved policy wording without inventing behavior',
  )
  assert.ok(privacy.includes('Checkout is handled'), 'verified checkout handling must remain')
}

function testPublicMetadataIsNeutral(): void {
  assertAbsent(
    config,
    [
      'proven deal-making framework',
      'Join thousands',
      'profitable property deals',
      'Master property investing',
      'Train for Property Success',
      'live coaching',
    ],
    'public metadata config',
  )

  assert.ok(config.includes('Property Training and Community'), 'neutral JPV metadata must remain')
}

try {
  testLandingClaimsAreApprovalSafe()
  testTermsDoNotInventCommercialBehavior()
  testPrivacyDoesNotInventPolicyPromises()
  testPublicMetadataIsNeutral()
  console.log('public_copy_claims_cleanup.test.ts passed')
} catch (error) {
  console.error(
    'public_copy_claims_cleanup.test.ts failed',
    error instanceof Error ? error.message : error,
  )
  process.exitCode = 1
}
