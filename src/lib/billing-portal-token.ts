import { createHmac, timingSafeEqual } from 'crypto'

export type BillingPortalTokenPayload = {
	email: string
	returnUrl?: string
	iat: number
	exp: number
	nonce: string
}

export type BillingPortalTokenResult =
	| { ok: true; payload: BillingPortalTokenPayload }
	| {
			ok: false
			reason:
				| 'malformed'
				| 'invalid_signature'
				| 'invalid_payload'
				| 'expired'
				| 'iat_too_old'
				| 'iat_in_future'
	  }

const MAX_TOKEN_AGE_SECONDS = 60 * 10
const MAX_IAT_SKEW_SECONDS = 60

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

export function signBillingPortalToken(
	payload: BillingPortalTokenPayload,
	secret: string
): string {
	const payloadJson = JSON.stringify(payload)
	const payloadB64 = base64UrlEncode(payloadJson)
	const signature = createHmac('sha256', secret).update(payloadB64).digest()
	const signatureB64 = base64UrlEncode(signature)
	return `${payloadB64}.${signatureB64}`
}

export function verifyBillingPortalToken(
	token: string,
	secret: string,
	nowEpochSeconds: number = Math.floor(Date.now() / 1000)
): BillingPortalTokenResult {
	if (!token) {
		return { ok: false, reason: 'malformed' }
	}

	const parts = token.split('.')
	if (parts.length !== 2 || !parts[0] || !parts[1]) {
		return { ok: false, reason: 'malformed' }
	}

	const payloadBuffer = base64UrlDecodeToBuffer(parts[0])
	const signatureBuffer = base64UrlDecodeToBuffer(parts[1])
	if (!payloadBuffer || !signatureBuffer || signatureBuffer.length === 0) {
		return { ok: false, reason: 'malformed' }
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

	const payload = parsed as Partial<BillingPortalTokenPayload>
	const email =
		typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : ''
	if (!email) {
		return { ok: false, reason: 'invalid_payload' }
	}

	const iat = Number(payload.iat)
	const exp = Number(payload.exp)
	if (!Number.isFinite(iat) || !Number.isFinite(exp) || exp < iat) {
		return { ok: false, reason: 'invalid_payload' }
	}

	if (exp < nowEpochSeconds) {
		return { ok: false, reason: 'expired' }
	}

	if (iat > nowEpochSeconds + MAX_IAT_SKEW_SECONDS) {
		return { ok: false, reason: 'iat_in_future' }
	}

	if (nowEpochSeconds - iat > MAX_TOKEN_AGE_SECONDS) {
		return { ok: false, reason: 'iat_too_old' }
	}

	return {
		ok: true,
		payload: {
			email,
			returnUrl:
				typeof payload.returnUrl === 'string' ? payload.returnUrl : undefined,
			iat,
			exp,
			nonce: typeof payload.nonce === 'string' ? payload.nonce : '',
		},
	}
}
