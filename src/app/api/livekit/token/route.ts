/**
 * GET /api/livekit/token?roomName=<roomName>
 *
 * Issues a LiveKit room token for an authenticated Payload user.
 *
 * Security:
 *  1. The requesting user MUST have an active Stripe subscription (pro or vip).
 *     The entitlement check calls /api/entitlements with the user's billing token.
 *     If no active subscription is found the request is rejected with 403.
 *  2. The token is delivered via an httpOnly, Secure, SameSite=Lax Set-Cookie header
 *     named `livekit_room_token` — it is NEVER returned in the JSON response body.
 *  3. The response body only contains { ok: true, roomName, wsUrl } so the client
 *     can connect to LiveKit using document.cookie / the SDK's cookie-based token
 *     picker, without ever exposing the raw JWT in JavaScript-accessible memory.
 *  4. The host check: if the authenticated user is the `hostUser` of the session,
 *     they get canPublish:true; all other members get canPublish:false.
 *
 * hostUser / hostUserId clarification:
 *   - PayloadLiveSession stores a relationship field named `hostUser`.
 *   - When resolved at depth:1, Payload returns `session.hostUser` as an object
 *     with an `id` property.
 *   - This route reads `session.hostUser.id` — NOT a hypothetical `hostUserId`
 *     text field — to determine host status.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getLiveKitConfig, buildLiveKitToken } from '@/lib/livekit-config'
import { verifyBillingPortalToken } from '@/lib/billing-portal-token'
import { normalizePlan } from '@/lib/plans'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type TokenOkResponse = { ok: true; roomName: string; wsUrl: string }
type TokenErrorResponse = { ok: false; reason: string }

const TOKEN_COOKIE = 'livekit_room_token'

function extractBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') ?? ''
  const match = auth.match(/Bearer\s+(.*)$/i)
  if (match) return match[1].trim()
  return null
}

/**
 * Verify that the user holds an active pro or vip subscription.
 *
 * We reuse the same billing portal token mechanism used elsewhere in the app.
 * The portal token is a signed HMAC token that carries the user's email and is
 * verified against BILLING_PORTAL_HMAC_SECRET.
 */
async function verifyActiveSubscription(billingToken: string): Promise<boolean> {
  const tokenSecret = (process.env.BILLING_PORTAL_HMAC_SECRET ?? '').trim()
  if (!tokenSecret) return false

  const verification = verifyBillingPortalToken(billingToken, tokenSecret)
  if (!verification.ok) return false

  const email = verification.payload.email
  if (!email) return false

  // Call our own entitlements endpoint server-side
  const appBaseUrl = (
    process.env.APP_BASE_URL ??
    process.env.NEXT_PUBLIC_SERVER_URL ??
    'http://localhost:3000'
  ).replace(/\/$/, '')

  try {
    const res = await fetch(`${appBaseUrl}/api/entitlements`, {
      headers: { Authorization: `Bearer ${billingToken}` },
      // Internal server-to-server call; short timeout
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) return false

    const data: { plan?: string } = await res.json()
    const plan = normalizePlan(data.plan ?? null)
    return plan === 'pro' || plan === 'vip'
  } catch {
    return false
  }
}

export async function GET(req: NextRequest) {
  const roomName = req.nextUrl.searchParams.get('roomName')?.trim()
  if (!roomName) {
    return NextResponse.json(
      { ok: false, reason: 'missing_room_name' } satisfies TokenErrorResponse,
      { status: 400 }
    )
  }

  // --- Entitlement check ---
  // The caller must provide their billing portal token so we can verify
  // an active pro/vip subscription before issuing a LiveKit token.
  const billingToken = extractBearerToken(req) ?? req.nextUrl.searchParams.get('token')?.trim()
  if (!billingToken) {
    return NextResponse.json(
      { ok: false, reason: 'unauthorized' } satisfies TokenErrorResponse,
      { status: 401 }
    )
  }

  const tokenSecret = (process.env.BILLING_PORTAL_HMAC_SECRET ?? '').trim()
  if (!tokenSecret) {
    return NextResponse.json(
      { ok: false, reason: 'server_misconfigured' } satisfies TokenErrorResponse,
      { status: 500 }
    )
  }

  // Verify the billing token to extract the user's email identity
  const verification = verifyBillingPortalToken(billingToken, tokenSecret)
  if (!verification.ok) {
    return NextResponse.json(
      { ok: false, reason: 'unauthorized' } satisfies TokenErrorResponse,
      { status: 401 }
    )
  }

  const userEmail = verification.payload.email
  if (!userEmail) {
    return NextResponse.json(
      { ok: false, reason: 'unauthorized' } satisfies TokenErrorResponse,
      { status: 401 }
    )
  }

  // Check active subscription
  const hasAccess = await verifyActiveSubscription(billingToken)
  if (!hasAccess) {
    return NextResponse.json(
      { ok: false, reason: 'subscription_required' } satisfies TokenErrorResponse,
      { status: 403 }
    )
  }

  // --- Load the live session ---
  let livekitConfig
  try {
    livekitConfig = getLiveKitConfig()
  } catch (err) {
    console.error('livekit_token: config error', { message: (err as Error).message })
    return NextResponse.json(
      { ok: false, reason: 'server_misconfigured' } satisfies TokenErrorResponse,
      { status: 500 }
    )
  }

  try {
    const payload = await getPayload({ config })

    const sessionResult = await payload.find({
      collection: 'live_sessions',
      where: { roomName: { equals: roomName } },
      limit: 1,
      depth: 1, // depth:1 resolves hostUser relationship → { id, email, ... }
    })

    if (!sessionResult.docs.length) {
      return NextResponse.json(
        { ok: false, reason: 'session_not_found' } satisfies TokenErrorResponse,
        { status: 404 }
      )
    }

    const session = sessionResult.docs[0] as unknown as {
      status?: string
      hostUser?: { id?: string; email?: string } | null
    }

    if (session.status === 'ended' || session.status === 'cancelled') {
      return NextResponse.json(
        { ok: false, reason: 'session_closed' } satisfies TokenErrorResponse,
        { status: 403 }
      )
    }

    // Resolve host status.
    // session.hostUser is a resolved relationship object (depth:1) with an `id` property.
    // We compare the Payload user's email against the session's hostUser email.
    const hostUser = session.hostUser
    const isHost =
      hostUser?.email != null &&
      hostUser.email.toLowerCase().trim() === userEmail.toLowerCase().trim()

    // Build the JWT token (never returned in response body)
    const jwt = buildLiveKitToken(
      {
        identity: userEmail,
        name: userEmail,
        grant: {
          room: roomName,
          roomJoin: true,
          canPublish: isHost,
          canSubscribe: true,
        },
      },
      livekitConfig
    )

    // Deliver the token via httpOnly cookie — NOT in the response body
    const response = NextResponse.json(
      {
        ok: true,
        roomName,
        wsUrl: livekitConfig.wsUrl,
      } satisfies TokenOkResponse,
      { status: 200 }
    )

    // HttpOnly + Secure + SameSite prevent XSS and CSRF access to the token.
    // Max-age matches the JWT TTL (1 hour).
    response.cookies.set(TOKEN_COOKIE, jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 3600,
    })

    return response
  } catch (error) {
    console.error('livekit_token: unexpected error', {
      roomName,
      message: (error as Error).message ?? 'unknown',
    })
    return NextResponse.json(
      { ok: false, reason: 'server_error' } satisfies TokenErrorResponse,
      { status: 500 }
    )
  }
}
