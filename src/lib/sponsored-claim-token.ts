import { createHmac, timingSafeEqual } from 'crypto'

export type SponsoredClaimPayload = {
	applicationId: string
	email: string
	tier: 'pro' | 'vip'
	iat: number
	exp: number
	nonce: string
}

export type SponsoredClaimResult =
	| { ok: true; payload: SponsoredClaimPayload }
	| {
			ok: false
			reason:
				| 'missing'
				| 'malformed'
				| 'invalid_signature'
				| 'invalid_payload'
				| 'expired'
				| 'iat_too_old'
				| 'iat_in_future'
				| 'too_long'
				| 'decode_error'
			iat?: number
			exp?: number
	  }

const MAX_TOKEN_AGE_SECONDS = 60 * 60 * 24 * 7
const MAX_IAT_SKEW_SECONDS = 60 * 5
const MAX_TOKEN_LENGTH = 4096
const UUID_REGEX = /^[0-9a-fA-F-]{36}$/

function sanitizeToken(raw: string | null | undefined): string | null {
	if (!raw) return null
	let token = raw.trim().replace(/[\r\n]/g, '')
	if (!token) return null
	if (token.length > MAX_TOKEN_LENGTH) return null
	if (!/^[A-Za-z0-9._-]+$/.test(token)) return null
	return token
}

function base64UrlEncode(data: Buffer | string): string {
	const buffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data
	return buffer
		.toString('base64')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/g, '')
}

function base64UrlDecodeToBuffer(value: string): Buffer | null {
	if (!value) return null
	const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
	const padLength = base64.length % 4
	const padded = padLength === 0 ? base64 : base64 + '='.repeat(4 - padLength)
	try {
		return Buffer.from(padded, 'base64')
	} catch {
		return null
	}
}

function safeJsonParse(value: string): unknown | null {
	try {
		return JSON.parse(value)
	} catch {
		return null
	}
}

export function signSponsoredClaimToken(
	payload: SponsoredClaimPayload,
	secret: string
): string {
	const payloadJson = JSON.stringify(payload)
	const payloadB64 = base64UrlEncode(payloadJson)
	const signature = createHmac('sha256', secret).update(payloadB64).digest()
	const signatureB64 = base64UrlEncode(signature)
	return `${payloadB64}.${signatureB64}`
}

export function verifySponsoredClaimToken(
	rawToken: string,
	secret: string,
	nowEpochSeconds: number = Math.floor(Date.now() / 1000)
): SponsoredClaimResult {
	const token = sanitizeToken(rawToken)
	if (!token) return { ok: false, reason: 'missing' }
	if (token.length > MAX_TOKEN_LENGTH) {
		return { ok: false, reason: 'too_long' }
	}

	const parts = token.split('.')
	if (parts.length !== 2 || !parts[0] || !parts[1]) {
		return { ok: false, reason: 'malformed' }
	}

	const payloadBuffer = base64UrlDecodeToBuffer(parts[0])
	const signatureBuffer = base64UrlDecodeToBuffer(parts[1])
	if (!payloadBuffer || !signatureBuffer || signatureBuffer.length === 0) {
		return { ok: false, reason: 'decode_error' }
	}

	const expectedSignature = createHmac('sha256', secret).update(parts[0]).digest()
	if (
		signatureBuffer.length !== expectedSignature.length ||
		!timingSafeEqual(signatureBuffer, expectedSignature)
	) {
		return { ok: false, reason: 'invalid_signature' }
	}

	const parsed = safeJsonParse(payloadBuffer.toString('utf8'))
	if (!parsed || typeof parsed !== 'object') {
		return { ok: false, reason: 'invalid_payload' }
	}

	const payload = parsed as Record<string, unknown>
	const applicationId =
		typeof payload.applicationId === 'string' ? payload.applicationId.trim() : ''
	if (!applicationId || !UUID_REGEX.test(applicationId)) {
		return { ok: false, reason: 'invalid_payload' }
	}

	const emailRaw = typeof payload.email === 'string' ? payload.email : ''
	const email = emailRaw.trim().toLowerCase()
	if (!email || !email.includes('@')) {
		return { ok: false, reason: 'invalid_payload' }
	}

	const tierRaw = typeof payload.tier === 'string' ? payload.tier : ''
	const tier = tierRaw.trim().toLowerCase()
	if (tier !== 'pro' && tier !== 'vip') {
		return { ok: false, reason: 'invalid_payload' }
	}

	const iat = Number(payload.iat)
	const exp = Number(payload.exp)
	if (!Number.isFinite(iat) || !Number.isFinite(exp) || exp < iat) {
		return { ok: false, reason: 'invalid_payload', iat, exp }
	}

	if (exp - iat > MAX_TOKEN_AGE_SECONDS) {
		return { ok: false, reason: 'invalid_payload', iat, exp }
	}

	if (exp < nowEpochSeconds - MAX_IAT_SKEW_SECONDS) {
		return { ok: false, reason: 'expired', iat, exp }
	}

	if (iat > nowEpochSeconds + MAX_IAT_SKEW_SECONDS) {
		return { ok: false, reason: 'iat_in_future', iat, exp }
	}

	if (nowEpochSeconds - iat > MAX_TOKEN_AGE_SECONDS + MAX_IAT_SKEW_SECONDS) {
		return { ok: false, reason: 'iat_too_old', iat, exp }
	}

	const nonce =
		typeof payload.nonce === 'string' ? payload.nonce.trim() : ''
	if (!nonce) {
		return { ok: false, reason: 'invalid_payload' }
	}

	return {
		ok: true,
		payload: {
			applicationId,
			email,
			tier: tier as 'pro' | 'vip',
			iat,
			exp,
			nonce,
		},
	}
}
