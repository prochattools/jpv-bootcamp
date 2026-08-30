import { NextRequest, NextResponse } from 'next/server'

import { requirePortalAdmin } from '@/lib/auth/requirePortalAdmin'
import { normalizePortalAdminError } from '@/lib/portalAdmin/actionResult'
import { transitionRoomCommand } from '@/lib/rooms/roomCommands'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function responseForError(error: unknown, action: string): NextResponse {
  const result = normalizePortalAdminError(error, action)
  const status = result.code === 'unauthorized' ? 401 : result.code === 'forbidden' ? 403 : result.code === 'not_found' ? 404 : result.code === 'conflict' ? 409 : result.code === 'invalid_input' ? 400 : 500
  return NextResponse.json(result, { status })
}

/** Compatibility adapter for legacy live-session lifecycle controls. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    const body = await request.json() as { status?: unknown }
    if (body.status !== 'live' && body.status !== 'completed' && body.status !== 'cancelled') {
      return NextResponse.json({ ok: false, message: 'Only live, completed, or cancelled transitions are supported.' }, { status: 400 })
    }
    const { actor, payload } = await requirePortalAdmin('/portal/live-sessions')
    const { id } = await params
    const session = await transitionRoomCommand({ payload, adminId: actor.administratorId, adminEmail: actor.email }, id, body.status)
    return NextResponse.json({ ok: true, session })
  } catch (error) {
    return responseForError(error, 'updateLegacyLiveSessionRoute')
  }
}
