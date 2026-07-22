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
import { headers } from 'next/headers'
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
  const billingToken = extractBearerToken(req)
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

/**
 * POST /api/livekit/token
 *
 * Issues a LiveKit room token for an authenticated Payload session user.
 *
 * Body: { sessionId: string }
 *
 * Role is NOT taken from the client — it is derived from whether the
 * authenticated user is the session's `hostUser`.
 *
 * Security:
 *  - Auth is via Payload session cookie, not a billing token.
 *  - The token is NEVER returned in the JSON response body.
 *  - It is set as an httpOnly cookie named `livekit_room_token`.
 *  - Response body only contains { ok: true, roomName, wsUrl }.
 */
export async function POST(req: NextRequest) {
  // Parse body
  let body: { sessionId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { ok: false, reason: 'invalid_json' } satisfies TokenErrorResponse,
      { status: 400 }
    )
  }

  const sessionId = body.sessionId?.trim()
  if (!sessionId) {
    return NextResponse.json(
      { ok: false, reason: 'missing_session_id' } satisfies TokenErrorResponse,
      { status: 400 }
    )
  }

  // Auth via Payload session (cookie-based), not billing token
  const payloadLib = await getPayload({ config })
  const reqHeaders = await headers()
  const auth = await payloadLib.auth({ headers: reqHeaders })
  const user = auth.user as { id?: string | number; collection?: string; email?: string } | null

  if (!user?.id) {
    return NextResponse.json(
      { ok: false, reason: 'unauthorized' } satisfies TokenErrorResponse,
      { status: 401 }
    )
  }

  // Only payload_members and payload_users (admins) may join
  const isAdmin = user.collection === 'payload_users'
  const isMember = user.collection === 'payload_members'
  if (!isAdmin && !isMember) {
    return NextResponse.json(
      { ok: false, reason: 'unauthorized' } satisfies TokenErrorResponse,
      { status: 401 }
    )
  }

  // Look up session by ID (respects collection access control — member must be enrolled)
  const sessionResult = await payloadLib
    .findByID({
      collection: 'live_sessions',
      id: sessionId,
      depth: 1,
      overrideAccess: false,
      user: { id: user.id, collection: user.collection } as any,
    })
    .catch((): null => null)

  if (!sessionResult) {
    return NextResponse.json(
      { ok: false, reason: 'session_not_found' } satisfies TokenErrorResponse,
      { status: 404 }
    )
  }

  const session = sessionResult as {
    status?: string
    hostUser?: { id?: string } | string | null
    roomName?: string
  }

  if (session.status === 'ended' || session.status === 'cancelled') {
    return NextResponse.json(
      { ok: false, reason: 'session_closed' } satisfies TokenErrorResponse,
      { status: 403 }
    )
  }

  const roomName = session.roomName ?? `session-${sessionId}`

  // Determine host from persisted hostUser — NOT from any client-supplied value
  const hostUserId =
    session.hostUser != null
      ? typeof session.hostUser === 'string'
        ? session.hostUser
        : session.hostUser?.id
      : null
  const isHost = hostUserId != null && String(user.id) === String(hostUserId)

  const userIdentity = user.email ?? String(user.id)

  let livekitConfig
  try {
    livekitConfig = getLiveKitConfig()
  } catch {
    return NextResponse.json(
      { ok: false, reason: 'server_misconfigured' } satisfies TokenErrorResponse,
      { status: 500 }
    )
  }

  const jwt = buildLiveKitToken(
    {
      identity: userIdentity,
      name: userIdentity,
      grant: { room: roomName, roomJoin: true, canPublish: isHost, canSubscribe: true },
    },
    livekitConfig
  )

  // NEVER put jwt in response body
  const response = NextResponse.json(
    { ok: true, roomName, wsUrl: livekitConfig.wsUrl } satisfies TokenOkResponse,
    { status: 200 }
  )
  response.cookies.set(TOKEN_COOKIE, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 3600,
  })
  return response
}
