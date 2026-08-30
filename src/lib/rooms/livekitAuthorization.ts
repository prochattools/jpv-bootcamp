import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { getPayload } from 'payload'
import config from '@payload-config'

import { getLiveKitConfig, buildLiveKitToken } from '@/lib/livekit-config'
import { liveSessionRelationshipId, isValidLiveSessionRoomName } from '@/lib/liveSessions/sessionLifecycle'
import { isRoomMemberEntitled } from '@/lib/rooms/roomAccess'
import type { PayloadDocument } from '@/lib/payloadCourse/accessService'
import { roomLiveKitPermissions } from '@/lib/rooms/livekitPermissions'

type TokenErrorResponse = { ok: false; reason: string }

const TOKEN_COOKIE = 'livekit_room_token'

/**
 * Canonical Room token boundary. Every role and entitlement is resolved from
 * the authenticated Payload identity and the trusted Room record; the browser
 * supplies only the Room ID and never a role, identity, or permission grant.
 */
export async function issueRoomLiveKitToken(req: NextRequest): Promise<NextResponse> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, reason: 'invalid_json' } satisfies TokenErrorResponse, { status: 400 })
  }

  const roomId = body && typeof body === 'object' && 'sessionId' in body && typeof body.sessionId === 'string'
    ? body.sessionId.trim()
    : ''
  if (!roomId) return NextResponse.json({ ok: false, reason: 'missing_session_id' } satisfies TokenErrorResponse, { status: 400 })

  const payload = await getPayload({ config })
  const auth = await payload.auth({ headers: await headers() })
  const user = auth.user as { id?: string | number; collection?: string } | null
  if (!user?.id || (user.collection !== 'payload_users' && user.collection !== 'payload_members')) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' } satisfies TokenErrorResponse, { status: 401 })
  }

  const room = await payload.findByID({
    collection: 'live_sessions',
    id: roomId,
    depth: 1,
    overrideAccess: true,
  }).catch((): null => null) as unknown as PayloadDocument | null
  if (!room) return NextResponse.json({ ok: false, reason: 'session_not_found' } satisfies TokenErrorResponse, { status: 404 })
  if (room.archived === true) {
    return NextResponse.json({ ok: false, reason: 'room_archived' } satisfies TokenErrorResponse, { status: 403 })
  }
  if (room.status === 'completed' || room.status === 'cancelled' || room.status === 'ended') {
    return NextResponse.json({ ok: false, reason: 'session_closed' } satisfies TokenErrorResponse, { status: 403 })
  }
  if (!isValidLiveSessionRoomName(room.roomName)) {
    return NextResponse.json({ ok: false, reason: 'invalid_room_name' } satisfies TokenErrorResponse, { status: 403 })
  }

  const isAdmin = user.collection === 'payload_users'
  const isHost = liveSessionRelationshipId(room.hostUser) === String(user.id)
  if (isAdmin && !isHost) return NextResponse.json({ ok: false, reason: 'host_required' } satisfies TokenErrorResponse, { status: 403 })
  if (!isAdmin) {
    if (room.status !== 'live') return NextResponse.json({ ok: false, reason: 'session_not_live' } satisfies TokenErrorResponse, { status: 403 })
    if (!(await isRoomMemberEntitled(payload, room, String(user.id)))) {
      return NextResponse.json({ ok: false, reason: 'not_entitled' } satisfies TokenErrorResponse, { status: 403 })
    }
  }

  let livekitConfig
  try {
    livekitConfig = getLiveKitConfig()
  } catch {
    return NextResponse.json({ ok: false, reason: 'server_misconfigured' } satisfies TokenErrorResponse, { status: 500 })
  }

  const audience = room.audience === 'all' || room.audience === 'selected' || room.audience === 'groups'
    ? room.audience
    : 'enrolled'
  const courseSession = liveSessionRelationshipId(room.course) !== null
  const spaceSession = liveSessionRelationshipId(room.space) !== null
  const permissions = roomLiveKitPermissions({ isHost, audience, courseSession, spaceSession })
  const identity = `${user.collection}:${String(user.id)}:${randomUUID()}`
  const jwt = buildLiveKitToken({
    identity,
    // Keep account email and IDs out of the realtime identity/name payload.
    name: isHost ? 'Host' : 'Member',
    grant: {
      room: room.roomName,
      roomJoin: true,
      canPublish: permissions.canPublish,
      canPublishData: permissions.canPublishData,
      canSubscribe: permissions.canSubscribe,
      roomAdmin: permissions.roomAdmin,
    },
  }, livekitConfig)

  const response = NextResponse.json({ ok: true, roomName: room.roomName, wsUrl: livekitConfig.wsUrl, token: jwt })
  response.cookies.set(TOKEN_COOKIE, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 3600,
  })
  return response
}
