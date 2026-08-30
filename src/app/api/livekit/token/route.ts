/**
 * LiveKit token endpoints.
 *
 * POST is the canonical member-portal Room boundary and derives every
 * entitlement and role from the authenticated Payload identity.
 *
 * GET is retained for the existing billing-token integration. New portal
 * callers must use POST so Room/member ledger rules are applied.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

import { issueRoomLiveKitToken } from '@/lib/rooms/livekitAuthorization'
import { getLiveKitConfig, buildLiveKitToken } from '@/lib/livekit-config'
import { verifyBillingPortalToken } from '@/lib/billing-portal-token'
import { normalizePlan } from '@/lib/plans'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type TokenErrorResponse = { ok: false; reason: string }
const TOKEN_COOKIE = 'livekit_room_token'

function extractBearerToken(req: NextRequest): string | null {
  const match = (req.headers.get('authorization') ?? '').match(/Bearer\s+(.*)$/i)
  return match?.[1]?.trim() || null
}

async function verifyActiveSubscription(billingToken: string): Promise<boolean> {
  const secret = (process.env.BILLING_PORTAL_HMAC_SECRET ?? '').trim()
  if (!secret) return false
  const verification = verifyBillingPortalToken(billingToken, secret)
  if (!verification.ok || !verification.payload.email) return false
  const baseUrl = (process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000').replace(/\/$/, '')
  try {
    const response = await fetch(baseUrl + '/api/entitlements', {
      headers: { Authorization: 'Bearer ' + billingToken },
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) return false
    const body = await response.json() as { plan?: string }
    return normalizePlan(body.plan ?? null) === 'jpv_bootcamp_membership'
  } catch {
    return false
  }
}

/** Legacy billing-token integration retained for existing non-portal callers. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const roomName = req.nextUrl.searchParams.get('roomName')?.trim()
  if (!roomName) return NextResponse.json({ ok: false, reason: 'missing_room_name' } satisfies TokenErrorResponse, { status: 400 })
  const billingToken = extractBearerToken(req)
  if (!billingToken) return NextResponse.json({ ok: false, reason: 'unauthorized' } satisfies TokenErrorResponse, { status: 401 })
  const secret = (process.env.BILLING_PORTAL_HMAC_SECRET ?? '').trim()
  const verification = secret ? verifyBillingPortalToken(billingToken, secret) : { ok: false as const }
  if (!verification.ok || !verification.payload.email) return NextResponse.json({ ok: false, reason: 'unauthorized' } satisfies TokenErrorResponse, { status: 401 })
  if (!(await verifyActiveSubscription(billingToken))) return NextResponse.json({ ok: false, reason: 'subscription_required' } satisfies TokenErrorResponse, { status: 403 })

  let livekitConfig
  try { livekitConfig = getLiveKitConfig() } catch { return NextResponse.json({ ok: false, reason: 'server_misconfigured' } satisfies TokenErrorResponse, { status: 500 }) }
  try {
    const payload = await getPayload({ config })
    const result = await payload.find({ collection: 'live_sessions', where: { roomName: { equals: roomName } }, limit: 1, depth: 1 })
    const session = result.docs[0] as { status?: string; hostUser?: { email?: string } | null } | undefined
    if (!session) return NextResponse.json({ ok: false, reason: 'session_not_found' } satisfies TokenErrorResponse, { status: 404 })
    if (session.status === 'completed' || session.status === 'cancelled' || session.status === 'ended') return NextResponse.json({ ok: false, reason: 'session_closed' } satisfies TokenErrorResponse, { status: 403 })
    const isHost = session.hostUser?.email?.trim().toLowerCase() === verification.payload.email.trim().toLowerCase()
    const token = buildLiveKitToken({ identity: verification.payload.email, name: verification.payload.email, grant: { room: roomName, roomJoin: true, canPublish: isHost, canSubscribe: true } }, livekitConfig)
    const response = NextResponse.json({ ok: true, roomName, wsUrl: livekitConfig.wsUrl, token })
    response.cookies.set(TOKEN_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 3600 })
    return response
  } catch (error) {
    console.error('legacy_livekit_token_failed', { roomName, error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ ok: false, reason: 'server_error' } satisfies TokenErrorResponse, { status: 500 })
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return issueRoomLiveKitToken(req)
}
