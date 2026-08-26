import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const provisioning = readFileSync(resolve(process.cwd(), 'src/lib/provisioning.ts'), 'utf8')
const webhookHandler = readFileSync(resolve(process.cwd(), 'src/lib/stripe-webhook-handler.ts'), 'utf8')
const emailGate = readFileSync(resolve(process.cwd(), 'src/lib/stripe-membership-email-gate.ts'), 'utf8')
const stagingGuard = readFileSync(resolve(process.cwd(), 'src/lib/staging-email-guard.ts'), 'utf8')
const emailRenderer = readFileSync(resolve(process.cwd(), 'src/lib/email.ts'), 'utf8')

assert.match(
  webhookHandler,
  /provisionFromCheckoutSession\(session, event\.id, event\.type, \{[\s\S]*allowEmail: allowMembershipEmail/,
  'checkout webhook must pass the membership-email decision into provisioning',
)
assert.match(
  emailGate,
  /eventType === 'checkout\.session\.completed'/,
  'checkout.session.completed must be an allowed membership-email event',
)
assert.match(
  provisioning,
  /const planChanged = storedPlanName !== incomingPlan[\s\S]*eventType === 'checkout\.session\.completed'[\s\S]*eventType === 'customer\.subscription\.updated'[\s\S]*eventType === 'manual_sync'/,
  'checkout provisioning must treat successful checkout as canonical for the first onboarding email',
)
assert.match(
	provisioning,
	/const emailVariant = memberWasCreated \|\| !existing \? 'welcome' : 'upgrade'[\s\S]*await sendWelcomeEmail\(\{[\s\S]*to: email,[\s\S]*buildMemberForgotPasswordUrl\(portalUrl\)/,
	'canonical checkout provisioning must send the welcome email through the existing Resend-backed sender',
)
assert.match(
	provisioning,
	/const memberResult = await provisionMemberFromCheckout\([\s\S]*memberWasCreated = memberResult\.created/,
	'new Payload member creation must select the onboarding email variant even when a Stripe projection already exists',
)
assert.match(emailRenderer, /heading: isUpgrade \? 'Your membership has been updated' : 'Your account is activated'/)
assert.equal(emailRenderer.includes('Your plan has been upgraded'), false)
assert.equal(provisioning.includes('/portal/forgot-password'), false)
assert.equal(emailRenderer.includes('/portal/forgot-password'), false)
assert.match(
  provisioning,
  /lastNotifiedEventId[\s\S]*recent_duplicate[\s\S]*already_notified_plan/,
  'existing dedupe protections must remain present',
)
assert.match(
  stagingGuard,
  /STAGING_TEST_RECIPIENT_EMAIL/,
  'staging delivery must remain restricted to the configured test recipient',
)

console.log('Stripe onboarding email delivery contract passed')
