import { strict as assert } from 'node:assert'
import {
	signPartnersHandoffToken,
	verifyPartnersHandoffToken,
	type PartnersHandoffPayload,
} from '@/lib/partners-handoff-token'
import {
	sanitizePartnersToken,
	PARTNERS_MAX_TOKEN_LENGTH,
} from '@/lib/partners-token-sanitize'

function basePayload(now: number): PartnersHandoffPayload {
	return {
		account_id: 123,
		account_email: 'member@example.com',
		account_name: 'Member Example',
		iat: now,
		exp: now + 300,
		nonce: 'nonce123',
	}
}

function testTokenVerification() {
	const now = Math.floor(Date.now() / 1000)
	const payload = basePayload(now)
	const secret = 'test_secret'
	const token = signPartnersHandoffToken(payload, secret)
	const ok = verifyPartnersHandoffToken(token, secret, now)
	assert.equal(ok.ok, true)

	const expired = verifyPartnersHandoffToken(token, secret, now + 600)
	assert.equal(expired.ok, false)

	const wrongSecret = verifyPartnersHandoffToken(token, 'wrong', now)
	assert.equal(wrongSecret.ok, false)
}

function testExtraKeysRejected() {
	const now = Math.floor(Date.now() / 1000)
	const payload = {
		...basePayload(now),
		extra: 'nope',
	} as unknown as PartnersHandoffPayload
	const secret = 'test_secret'
	const token = signPartnersHandoffToken(payload, secret)
	const result = verifyPartnersHandoffToken(token, secret, now)
	assert.equal(result.ok, false)
}

function testLengthEnforcement() {
	const oversized = 'a'.repeat(PARTNERS_MAX_TOKEN_LENGTH + 10)
	const sanitized = sanitizePartnersToken(oversized)
	assert.equal(sanitized, null)
}

async function run() {
	testTokenVerification()
	testExtraKeysRejected()
	testLengthEnforcement()
	console.log('partners_handoff_helpers: ok')
}

run().catch((error) => {
	console.error('partners_handoff_helpers failed', error instanceof Error ? error.message : error)
	process.exit(1)
})
