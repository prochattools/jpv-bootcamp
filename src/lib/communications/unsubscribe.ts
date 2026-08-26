import { createHmac } from 'node:crypto'

import type { CommunicationPreferenceKey } from './preferences'

export type UnsubscribeTokenPurpose = 'communication_unsubscribe'

export type UnsubscribeTokenPayload = {
  v: 1
  purpose: UnsubscribeTokenPurpose
  preferenceKey: CommunicationPreferenceKey
  memberDigest: string
  expiresAt: string
  nonce: string
}

export type UnsubscribeValidationResult =
  | { ok: true; payload: UnsubscribeTokenPayload }
  | { ok: false; reason: string }

function base64Url(input: Buffer): string {
  return input.toString('base64url')
}

function parseJson(input: string): unknown {
  return JSON.parse(Buffer.from(input, 'base64url').toString('utf8')) as unknown
}

export function signUnsubscribeToken(payload: UnsubscribeTokenPayload, secret: string): string {
  const body = base64Url(Buffer.from(JSON.stringify(payload), 'utf8'))
  const mac = createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${mac}`
}

export function validateUnsubscribeToken(
  token: string,
  secret: string,
  expectedPreferenceKey: CommunicationPreferenceKey,
  now = new Date(),
): UnsubscribeValidationResult {
  const [body, mac] = token.split('.')
  if (!body || !mac) return { ok: false, reason: 'invalid_token' }
  const expectedMac = createHmac('sha256', secret).update(body).digest('base64url')
  if (expectedMac.length !== mac.length || !Buffer.from(expectedMac).equals(Buffer.from(mac))) {
    return { ok: false, reason: 'invalid_token' }
  }

  let payload: UnsubscribeTokenPayload
  try {
    payload = parseJson(body) as UnsubscribeTokenPayload
  } catch {
    return { ok: false, reason: 'invalid_token' }
  }

  if (payload?.v !== 1 || payload.purpose !== 'communication_unsubscribe') return { ok: false, reason: 'invalid_token' }
  if (payload.preferenceKey !== expectedPreferenceKey) return { ok: false, reason: 'purpose_mismatch' }
  if (!payload.memberDigest || !payload.nonce) return { ok: false, reason: 'invalid_token' }
  if (Number.isNaN(Date.parse(payload.expiresAt)) || Date.parse(payload.expiresAt) < now.getTime()) {
    return { ok: false, reason: 'expired_token' }
  }

  return { ok: true, payload }
}
