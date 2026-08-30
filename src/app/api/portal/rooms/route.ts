import { NextRequest, NextResponse } from 'next/server'

import { requirePortalAdmin } from '@/lib/auth/requirePortalAdmin'
import { listAdminRooms } from '@/lib/rooms/roomQueries'
import { createRoomCommand, type RoomInput } from '@/lib/rooms/roomCommands'
import { normalizePortalAdminError } from '@/lib/portalAdmin/actionResult'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function responseForError(error: unknown, action: string): NextResponse {
  const result = normalizePortalAdminError(error, action)
  const status = result.code === 'unauthorized' ? 401 : result.code === 'forbidden' ? 403 : result.code === 'not_found' ? 404 : result.code === 'conflict' ? 409 : result.code === 'invalid_input' ? 400 : 500
  return NextResponse.json(result, { status })
}

export async function GET(): Promise<NextResponse> {
  try {
    const { payload } = await requirePortalAdmin('/portal/rooms', { redirectOnFailure: false })
    const [rooms, groups, categories] = await Promise.all([
      listAdminRooms(payload),
      payload.find({ collection: 'payload_member_groups', where: { status: { equals: 'active' } }, limit: 500, depth: 1, overrideAccess: true }),
      payload.find({ collection: 'payload_room_categories', where: { status: { equals: 'active' } }, limit: 500, sort: 'sortOrder', depth: 0, overrideAccess: true }),
    ])
    return NextResponse.json({ ok: true, rooms, groups: groups.docs, categories: categories.docs })
  } catch (error) {
    return responseForError(error, 'getRoomsRoute')
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as RoomInput
    const { actor, payload } = await requirePortalAdmin('/portal/rooms', { redirectOnFailure: false })
    const result = await createRoomCommand({ payload, adminId: actor.administratorId, adminEmail: actor.email }, body)
    return NextResponse.json({ ok: true, room: result.room, addedMembers: result.addedMembers, removedMembers: result.removedMembers, warnings: result.warnings }, { status: 201 })
  } catch (error) {
    return responseForError(error, 'createRoomsRoute')
  }
}
