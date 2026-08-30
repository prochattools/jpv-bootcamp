import { NextRequest, NextResponse } from 'next/server'

import { requirePortalAdmin } from '@/lib/auth/requirePortalAdmin'
import { normalizePortalAdminError } from '@/lib/portalAdmin/actionResult'
import { archiveRoomCommand, deleteRoomCommand, transitionRoomCommand, updateRoomCommand, type RoomUpdateInput } from '@/lib/rooms/roomCommands'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function responseForError(error: unknown, action: string): NextResponse {
  const result = normalizePortalAdminError(error, action)
  const status = result.code === 'unauthorized' ? 401 : result.code === 'forbidden' ? 403 : result.code === 'not_found' ? 404 : result.code === 'conflict' ? 409 : result.code === 'invalid_input' || result.code === 'dependency_blocked' ? 400 : 500
  return NextResponse.json(result, { status })
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    const { payload } = await requirePortalAdmin('/portal/rooms')
    const { id } = await params
    const room = await payload.findByID({ collection: 'live_sessions', id, depth: 1, overrideAccess: true }).catch((): null => null)
    if (!room) return NextResponse.json({ ok: false, code: 'not_found', message: 'Room not found.' }, { status: 404 })
    return NextResponse.json({ ok: true, room })
  } catch (error) {
    return responseForError(error, 'getRoomRoute')
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    const body = await request.json() as RoomUpdateInput & { status?: 'live' | 'completed' | 'cancelled'; archived?: boolean }
    const { actor, payload } = await requirePortalAdmin('/portal/rooms')
    const { id } = await params
    const context = { payload, adminId: actor.administratorId, adminEmail: actor.email }
    if (body.status) {
      const room = await transitionRoomCommand(context, id, body.status, body.expectedUpdatedAt)
      return NextResponse.json({ ok: true, room })
    }
    if (body.archived) {
      const room = await archiveRoomCommand(context, id, body.expectedUpdatedAt)
      return NextResponse.json({ ok: true, room })
    }
    const result = await updateRoomCommand(context, id, body)
    return NextResponse.json({ ok: true, room: result.room, addedMembers: result.addedMembers, removedMembers: result.removedMembers, warnings: result.warnings })
  } catch (error) {
    return responseForError(error, 'updateRoomRoute')
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    const { actor, payload } = await requirePortalAdmin('/portal/rooms')
    const { id } = await params
    const confirmed = request.headers.get('x-confirm-delete') === 'true'
    await deleteRoomCommand({ payload, adminId: actor.administratorId, adminEmail: actor.email }, id, confirmed)
    return NextResponse.json({ ok: true, id })
  } catch (error) {
    return responseForError(error, 'deleteRoomRoute')
  }
}
