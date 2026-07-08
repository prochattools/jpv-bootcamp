import { strict as assert } from 'node:assert'
import {
	signSponsoredClaimToken,
	verifySponsoredClaimToken,
	type SponsoredClaimPayload,
} from '@/lib/sponsored-claim-token'

function basePayload(now: number): SponsoredClaimPayload {
	return {
		applicationId: '11111111-1111-1111-1111-111111111111',
		email: 'member@example.com',
		iat: now,
		exp: now + 60 * 60 * 24 * 7,
		nonce: 'nonce123',
	}
}

function testTokenRoundTrip() {
	const now = Math.floor(Date.now() / 1000)
	const payload = basePayload(now)
	const secret = 'test_secret'
	const token = signSponsoredClaimToken(payload, secret)
	const ok = verifySponsoredClaimToken(token, secret, now)
	assert.equal(ok.ok, true)
}

function testTamperFails() {
	const now = Math.floor(Date.now() / 1000)
	const payload = basePayload(now)
	const secret = 'test_secret'
	const token = signSponsoredClaimToken(payload, secret)
	const tampered = token.replace(/\w/, 'x')
	const result = verifySponsoredClaimToken(tampered, secret, now)
	assert.equal(result.ok, false)
}

function testUrlEncodingSurvives() {
	const now = Math.floor(Date.now() / 1000)
	const payload = basePayload(now)
	const secret = 'test_secret'
	const token = signSponsoredClaimToken(payload, secret)
	const encoded = encodeURIComponent(token)
	const decoded = decodeURIComponent(encoded)
	const result = verifySponsoredClaimToken(decoded, secret, now)
	assert.equal(result.ok, true)
}

async function run() {
	testTokenRoundTrip()
	testTamperFails()
	testUrlEncodingSurvives()
	console.log('sponsored_claim_helpers: ok')
}

run().catch((error) => {
	console.error(
		'sponsored_claim_helpers failed',
		error instanceof Error ? error.message : error
	)
	process.exit(1)
})
