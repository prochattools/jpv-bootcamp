import assert from 'node:assert/strict'
import {
	signBillingPortalToken,
	verifyBillingPortalToken,
} from '../src/lib/billing-portal-token'

function base64UrlEncode(value: string): string {
	return Buffer.from(value, 'utf8')
		.toString('base64')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/g, '')
}

function base64UrlDecode(value: string): string {
	const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
	const padLength = base64.length % 4
	const padded = padLength === 0 ? base64 : base64 + '='.repeat(4 - padLength)
	return Buffer.from(padded, 'base64').toString('utf8')
}

function run(name: string, fn: () => void) {
	try {
		fn()
		console.log(`ok - ${name}`)
	} catch (error) {
		console.error(`fail - ${name}`)
		console.error(error)
		process.exitCode = 1
	}
}

const now = 1_700_000_000
const secret = 'test-secret'

run('verifies a valid token', () => {
	const payload = {
		email: 'user@example.com',
		returnUrl: 'https://portal.jpvbootcamp.com/community/',
		iat: now,
		exp: now + 300,
		nonce: 'abc123',
	}
	const token = signBillingPortalToken(payload, secret)
	const result = verifyBillingPortalToken(token, secret, now)
	assert.equal(result.ok, true)
	if (result.ok) {
		assert.equal(result.payload.email, payload.email)
	}
})

run('rejects a token with a bad signature', () => {
	const payload = {
		email: 'user@example.com',
		returnUrl: 'https://portal.jpvbootcamp.com/community/',
		iat: now,
		exp: now + 300,
		nonce: 'abc123',
	}
	const token = signBillingPortalToken(payload, secret)
	const result = verifyBillingPortalToken(token, 'wrong-secret', now)
	assert.equal(result.ok, false)
	if (!result.ok) {
		assert.equal(result.reason, 'invalid_signature')
	}
})

run('rejects an expired token', () => {
	const payload = {
		email: 'user@example.com',
		returnUrl: 'https://portal.jpvbootcamp.com/community/',
		iat: now - 400,
		exp: now - 10,
		nonce: 'abc123',
	}
	const token = signBillingPortalToken(payload, secret)
	const result = verifyBillingPortalToken(token, secret, now)
	assert.equal(result.ok, false)
	if (!result.ok) {
		assert.equal(result.reason, 'expired')
	}
})

run('rejects a tampered payload', () => {
	const payload = {
		email: 'user@example.com',
		returnUrl: 'https://portal.jpvbootcamp.com/community/',
		iat: now,
		exp: now + 300,
		nonce: 'abc123',
	}
	const token = signBillingPortalToken(payload, secret)
	const parts = token.split('.')
	assert.equal(parts.length, 2)

	const decoded = JSON.parse(base64UrlDecode(parts[0]))
	decoded.email = 'tampered@example.com'
	const tamperedPayload = base64UrlEncode(JSON.stringify(decoded))
	const tamperedToken = `${tamperedPayload}.${parts[1]}`

	const result = verifyBillingPortalToken(tamperedToken, secret, now)
	assert.equal(result.ok, false)
	if (!result.ok) {
		assert.equal(result.reason, 'invalid_signature')
	}
})
