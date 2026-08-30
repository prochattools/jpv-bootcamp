import { NextRequest, NextResponse } from 'next/server'

import { requirePortalAdmin } from '@/lib/auth/requirePortalAdmin'
import { normalizePortalAdminError } from '@/lib/portalAdmin/actionResult'
import { createRoomCommand } from '@/lib/rooms/roomCommands'
import { listAdminRooms } from '@/lib/rooms/roomQueries'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function responseForError(error: unknown, action: string): NextResponse {
  const result = normalizePortalAdminError(error, action)
  const status = result.code === 'unauthorized' ? 401 : result.code === 'forbidden' ? 403 : result.code === 'not_found' ? 404 : result.code === 'conflict' ? 409 : result.code === 'invalid_input' ? 400 : 500
  return NextResponse.json(result, { status })
}

/** Compatibility adapter for clients that still use the legacy live-sessions API. */
export async function GET(): Promise<NextResponse> {
  try {
    const { payload } = await requirePortalAdmin('/portal/live-sessions')
    return NextResponse.json({ ok: true, sessions: await listAdminRooms(payload) })
  } catch (error) {
    return responseForError(error, 'getLegacyLiveSessionsRoute')
  }
}

/** Compatibility adapter; new callers should use /api/portal/rooms. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as Record<string, unknown>
    const { actor, payload } = await requirePortalAdmin('/portal/live-sessions')
    const result = await createRoomCommand(
      { payload, adminId: actor.administratorId, adminEmail: actor.email },
      {
        title: typeof body.title === 'string' && body.title.trim() ? body.title : 'JPV Live Session',
        scheduledAt: typeof body.scheduledAt === 'string' ? body.scheduledAt : null,
        startNow: body.startNow === true || body.startNow === 'true' || body.startNow === '1',
        capacity: body.capacity as number | string | null | undefined,
        audience: body.audience === 'all' || body.audience === 'enrolled' || body.audience === 'selected' || body.audience === 'groups'
          ? body.audience
          : 'selected',
        targetMemberIds: Array.isArray(body.targetMemberIds) ? body.targetMemberIds.map(String) : [],
        targetGroupIds: Array.isArray(body.targetGroupIds) ? body.targetGroupIds.map(String) : [],
        courseId: typeof body.course === 'string' || typeof body.course === 'number' ? String(body.course) : null,
        spaceId: typeof body.space === 'string' || typeof body.space === 'number' ? String(body.space) : null,
      },
    )
    return NextResponse.json({
      ok: true,
      session: result.room,
      emailEventsCreated: result.addedMembers,
      invitationWarning: result.warnings.length ? 'The session was created, but invitations could not be fully queued. Review the email queue.' : undefined,
    }, { status: 201 })
  } catch (error) {
    return responseForError(error, 'createLegacyLiveSessionRoute')
  }
}
