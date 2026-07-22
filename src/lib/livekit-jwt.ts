/**
 * livekit-jwt.ts
 *
 * Pure, side-effect-free LiveKit JWT builder.
 * No server-only guard — safe to import in tests and server components alike.
 *
 * The calling code is responsible for keeping apiKey/apiSecret out of the browser.
 */

import { createHmac } from 'crypto'

function base64url(data: string): string {
  return Buffer.from(data, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export type LiveKitConfig = {
  apiKey: string
  apiSecret: string
  wsUrl: string
}

export type LiveKitGrant = {
  room: string
  roomJoin: boolean
  canPublish: boolean
  canSubscribe: boolean
}

export type LiveKitTokenOptions = {
  identity: string
  name?: string
  grant: LiveKitGrant
  ttlSeconds?: number
}

/**
 * Build a signed LiveKit JWT (HS256).
 *
 * IMPORTANT: The returned token is intended for server-side use only or to be
 * delivered to the client via an httpOnly cookie.  The token MUST NOT appear in
 * a plain JSON response body — the calling route enforces this.
 */
export function buildLiveKitToken(opts: LiveKitTokenOptions, cfg: LiveKitConfig): string {
  const now = Math.floor(Date.now() / 1000)
  const ttl = opts.ttlSeconds ?? 3600
  const exp = now + ttl

  const header = { alg: 'HS256', typ: 'JWT' }
  const payload = {
    iss: cfg.apiKey,
    sub: opts.identity,
    iat: now,
    exp,
    jti: `${opts.identity}-${now}`,
    name: opts.name ?? opts.identity,
    video: {
      room: opts.grant.room,
      roomJoin: opts.grant.roomJoin,
      canPublish: opts.grant.canPublish,
      canSubscribe: opts.grant.canSubscribe,
    },
  }

  const encodedHeader = base64url(JSON.stringify(header))
  const encodedPayload = base64url(JSON.stringify(payload))
  const signingInput = `${encodedHeader}.${encodedPayload}`
  const signature = createHmac('sha256', cfg.apiSecret)
    .update(signingInput)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  return `${signingInput}.${signature}`
}
