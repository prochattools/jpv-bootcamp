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
  canPublishData?: boolean
  canSubscribe: boolean
  roomAdmin?: boolean
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
 * The route delivers this short-lived token to the joining client and also
 * stores it in an httpOnly cookie for compatibility with existing integrations.
 * Keep the signing secret server-side; never expose it to the browser.
 */
export function buildLiveKitToken(opts: LiveKitTokenOptions, cfg: LiveKitConfig): string {
  const now = Math.floor(Date.now() / 1000)
  const ttl = opts.ttlSeconds ?? 3600
  const exp = now + ttl

  const header = { alg: 'HS256', typ: 'JWT' }
  const video: Record<string, unknown> = {
    room: opts.grant.room,
    roomJoin: opts.grant.roomJoin,
    canPublish: opts.grant.canPublish,
    ...(opts.grant.canPublishData === undefined ? {} : { canPublishData: opts.grant.canPublishData }),
    canSubscribe: opts.grant.canSubscribe,
  }
  if (opts.grant.roomAdmin) video.roomAdmin = true

  const payload = {
    iss: cfg.apiKey,
    sub: opts.identity,
    iat: now,
    exp,
    jti: `${opts.identity}-${now}`,
    name: opts.name ?? opts.identity,
    video,
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
