import { strict as assert } from 'node:assert'
import {
	signSponsoredDecisionToken,
	verifySponsoredDecisionToken,
	type SponsoredDecisionPayload,
} from '@/lib/sponsored-approval-token'

function basePayload(now: number): SponsoredDecisionPayload {
	return {
		applicationId: '11111111-1111-1111-1111-111111111111',
		action: 'approve',
		iat: now,
		exp: now + 60 * 60 * 48,
		nonce: 'nonce123',
	}
}

function testTokenRoundTrip() {
	const now = Math.floor(Date.now() / 1000)
	const payload = basePayload(now)
	const secret = 'test_secret'
	const token = signSponsoredDecisionToken(payload, secret)
	const ok = verifySponsoredDecisionToken(token, secret, now)
	assert.equal(ok.ok, true)
}

function testTamperFails() {
	const now = Math.floor(Date.now() / 1000)
	const payload = basePayload(now)
	const secret = 'test_secret'
	const token = signSponsoredDecisionToken(payload, secret)
	const tampered = token.replace(/\w/, 'x')
	const result = verifySponsoredDecisionToken(tampered, secret, now)
	assert.equal(result.ok, false)
}

function testUrlEncodingSurvives() {
	const now = Math.floor(Date.now() / 1000)
	const payload = basePayload(now)
	const secret = 'test_secret'
	const token = signSponsoredDecisionToken(payload, secret)
	const encoded = encodeURIComponent(token)
	const decoded = decodeURIComponent(encoded)
	const result = verifySponsoredDecisionToken(decoded, secret, now)
	assert.equal(result.ok, true)
}

async function run() {
	testTokenRoundTrip()
	testTamperFails()
	testUrlEncodingSurvives()
	console.log('sponsored_decision_helpers: ok')
}

run().catch((error) => {
	console.error(
		'sponsored_decision_helpers failed',
		error instanceof Error ? error.message : error
	)
	process.exit(1)
})
