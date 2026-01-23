import { strict as assert } from 'node:assert'
import {
	BILLING_PORTAL_DEFAULT_RETURN_URL,
	describeBillingPortalReturnUrl,
} from '@/lib/billing-portal-return'
import {
	signBillingPortalToken,
	verifyBillingPortalToken,
	type BillingPortalTokenPayload,
} from '@/lib/billing-portal-token'
import { redactEmail } from '@/lib/log-redact'

function testReturnUrlValidation() {
	const validPortal = describeBillingPortalReturnUrl(
		'https://portal.jpvbootcamp.com/community/?foo=1'
	)
	assert.equal(validPortal.url.includes('portal.jpvbootcamp.com'), true)
	assert.equal(validPortal.valid, true)

	const validApp = describeBillingPortalReturnUrl('https://jpvbootcamp.com/upgrade')
	assert.equal(validApp.url.includes('jpvbootcamp.com'), true)
	assert.equal(validApp.valid, true)

	const invalid = describeBillingPortalReturnUrl('https://evil.com/phish')
	assert.equal(invalid.url, BILLING_PORTAL_DEFAULT_RETURN_URL)
	assert.equal(invalid.valid, false)

	const invalidScheme = describeBillingPortalReturnUrl('http://portal.jpvbootcamp.com/')
	assert.equal(invalidScheme.url, BILLING_PORTAL_DEFAULT_RETURN_URL)
	assert.equal(invalidScheme.valid, false)

	const empty = describeBillingPortalReturnUrl('')
	assert.equal(empty.url, BILLING_PORTAL_DEFAULT_RETURN_URL)
	assert.equal(empty.present, false)
}

function testTokenVerification() {
	const now = Math.floor(Date.now() / 1000)
	const payload: BillingPortalTokenPayload = {
		email: 'test@example.com',
		returnUrl: 'https://portal.jpvbootcamp.com/community/',
		iat: now,
		exp: now + 60,
		nonce: 'abc123',
	}
	const secret = 'test_secret'
	const token = signBillingPortalToken(payload, secret)
	const ok = verifyBillingPortalToken(token, secret, now)
	assert.equal(ok.ok, true)

	const bad = verifyBillingPortalToken(token, 'wrong_secret', now)
	assert.equal(bad.ok, false)

	const expired = verifyBillingPortalToken(token, secret, now + 120)
	assert.equal(expired.ok, false)
}

function testRedaction() {
	const redacted = redactEmail('User@example.com')
	assert.equal(typeof redacted, 'string')
	assert.equal(redacted?.includes('example.com'), false)
	assert.equal(redacted?.endsWith(':ser'), true)
}

async function testIdempotency() {
	process.env.DATABASE_URL = ''
	process.env.WEBHOOK_IDEMPOTENCY_TTL_HOURS = '24'
	const { hasProcessed, markProcessed } = await import('@/lib/idempotency')
	const eventId = `evt_test_${Date.now()}`
	const first = await hasProcessed(eventId)
	assert.equal(first, false)
	await markProcessed({ eventId, eventType: 'test', livemode: false })
	const second = await hasProcessed(eventId)
	assert.equal(second, true)
}

async function run() {
	testReturnUrlValidation()
	testTokenVerification()
	testRedaction()
	await testIdempotency()
	console.log('billing_portal_helpers: ok')
}

run().catch((error) => {
	console.error('billing_portal_helpers failed', error instanceof Error ? error.message : error)
	process.exit(1)
})
