import { createHmac, timingSafeEqual } from 'crypto'
import { sanitizePartnersToken, PARTNERS_MAX_TOKEN_LENGTH } from '@/lib/partners-token-sanitize'

export type PartnersHandoffPayload = {
	account_id: number
	account_email: string
	account_name: string
	iat: number
	exp: number
	nonce: string
}

export type PartnersHandoffResult =
	| { ok: true; payload: PartnersHandoffPayload }
	| {
			ok: false
			reason:
				| 'malformed'
				| 'invalid_signature'
				| 'invalid_payload'
				| 'expired'
				| 'iat_too_old'
				| 'iat_in_future'
				| 'too_long'
	  }

const MAX_TOKEN_AGE_SECONDS = 60 * 5
const MAX_IAT_SKEW_SECONDS = 60
const ALLOWED_KEYS = new Set([
	'account_id',
	'account_email',
	'account_name',
	'iat',
	'exp',
	'nonce',
])

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

export function signPartnersHandoffToken(
	payload: PartnersHandoffPayload,
	secret: string
): string {
	const payloadJson = JSON.stringify(payload)
	const payloadB64 = base64UrlEncode(payloadJson)
	const signature = createHmac('sha256', secret).update(payloadB64).digest()
	const signatureB64 = base64UrlEncode(signature)
	return `${payloadB64}.${signatureB64}`
}

export function verifyPartnersHandoffToken(
	rawToken: string,
	secret: string,
	nowEpochSeconds: number = Math.floor(Date.now() / 1000)
): PartnersHandoffResult {
	const token = sanitizePartnersToken(rawToken)
	if (!token) return { ok: false, reason: 'malformed' }
	if (token.length > PARTNERS_MAX_TOKEN_LENGTH) {
		return { ok: false, reason: 'too_long' }
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

	const payload = parsed as Record<string, unknown>
	const keys = Object.keys(payload)
	if (keys.length !== ALLOWED_KEYS.size) {
		return { ok: false, reason: 'invalid_payload' }
	}
	for (const key of keys) {
		if (!ALLOWED_KEYS.has(key)) {
			return { ok: false, reason: 'invalid_payload' }
		}
	}

	const accountId = Number(payload.account_id)
	if (!Number.isInteger(accountId) || accountId <= 0) {
		return { ok: false, reason: 'invalid_payload' }
	}

	const emailRaw = typeof payload.account_email === 'string' ? payload.account_email : ''
	const email = emailRaw.trim().toLowerCase()
	if (!email || !email.includes('@')) {
		return { ok: false, reason: 'invalid_payload' }
	}

	const nameRaw = typeof payload.account_name === 'string' ? payload.account_name : ''
	const name = nameRaw.trim()
	if (!name) {
		return { ok: false, reason: 'invalid_payload' }
	}

	const iat = Number(payload.iat)
	const exp = Number(payload.exp)
	if (!Number.isFinite(iat) || !Number.isFinite(exp) || exp < iat) {
		return { ok: false, reason: 'invalid_payload' }
	}

	if (exp - iat > MAX_TOKEN_AGE_SECONDS) {
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

	const nonce =
		typeof payload.nonce === 'string' ? payload.nonce.trim() : ''
	if (!nonce) {
		return { ok: false, reason: 'invalid_payload' }
	}

	return {
		ok: true,
		payload: {
			account_id: accountId,
			account_email: email,
			account_name: name,
			iat,
			exp,
			nonce,
		},
	}
}
