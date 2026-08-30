import type { PayloadCourseWriteAPI, PayloadDocument } from '@/lib/payloadCourse/accessService'
import {
  assertLiveSessionStatusTransition,
  liveSessionRelationshipId,
  prepareLiveSessionMutation,
  type LiveSessionStatus,
} from '@/lib/liveSessions/sessionLifecycle'
import { PortalAdminActionError } from '@/lib/portalAdmin/actionResult'
import { buildPlainTextRichText } from '@/lib/payloadCourse/plainTextRichText'
import { normalizeRoomAudience } from '@/lib/rooms/audience'
import { synchronizeRoomAccess } from '@/lib/rooms/roomAccess'
import { notifyRoomCreator, notifyRoomMember } from '@/lib/rooms/roomNotifications'

export type RoomCommandContext = {
  payload: PayloadCourseWriteAPI
  adminId: string
  adminEmail?: string | null
}

export type RoomInput = {
  title: string
  scheduledAt?: string | null
  startNow?: boolean
  capacity?: number | string | null
  audience?: 'all' | 'selected' | 'groups' | 'enrolled'
  targetMemberIds?: string[]
  targetGroupIds?: string[]
  categoryIds?: string[]
  courseId?: string | null
  spaceId?: string | null
  description?: string | null
}

export type RoomUpdateInput = Partial<RoomInput> & {
  expectedUpdatedAt?: string | null
}

export type RoomCommandResult = {
  room: PayloadDocument
  addedMembers: number
  removedMembers: number
  warnings: string[]
}

function text(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number') return String(value)
  return null
}

function ids(value: unknown): string[] {
  return [...new Set((Array.isArray(value) ? value : []).map(String).map((item) => item.trim()).filter(Boolean))]
}

function parseCapacity(value: unknown): number {
  if (value === undefined || value === null || value === '') return 50
  const capacity = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500) {
    throw new PortalAdminActionError('invalid_input', 'Capacity must be a whole number from 1 to 500.', { capacity: 'Enter a number from 1 to 500.' })
  }
  return capacity
}

function parseScheduledAt(value: unknown, startNow: boolean): string {
  if (startNow) return new Date().toISOString()
  const normalized = text(value)
  if (!normalized) throw new PortalAdminActionError('invalid_input', 'Choose a scheduled start time.', { scheduledAt: 'A scheduled start time is required.' })
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) throw new PortalAdminActionError('invalid_input', 'Choose a valid scheduled start time.', { scheduledAt: 'The scheduled time is invalid.' })
  return date.toISOString()
}

function validateAudience(input: {
  audience: unknown
  targetMemberIds?: unknown
  targetGroupIds?: unknown
  courseId?: unknown
  spaceId?: unknown
}): { audience: ReturnType<typeof normalizeRoomAudience>; targetMemberIds: string[]; targetGroupIds: string[] } {
  const audience = normalizeRoomAudience(input.audience)
  const targetMemberIds = ids(input.targetMemberIds)
  const targetGroupIds = ids(input.targetGroupIds)
  if (audience === 'selected' && targetMemberIds.length === 0) {
    throw new PortalAdminActionError('invalid_input', 'Select at least one member for this audience.', { audience: 'At least one member is required.' })
  }
  if (audience === 'groups' && targetGroupIds.length === 0) {
    throw new PortalAdminActionError('invalid_input', 'Select at least one member group for this audience.', { audience: 'At least one group is required.' })
  }
  if (audience === 'enrolled' && !text(input.courseId) && !text(input.spaceId)) {
    throw new PortalAdminActionError('invalid_input', 'Link a course or community space for an enrolled audience.', { audience: 'A course or community space is required.' })
  }
  return { audience, targetMemberIds, targetGroupIds }
}

function asRelation(value: string | null | undefined): string | null {
  return text(value)
}

function changedAtMatches(expected: string | null | undefined, actual: unknown): boolean {
  if (!expected) return true
  return String(actual ?? '') === expected || new Date(String(actual)).getTime() === new Date(expected).getTime()
}

async function reconcile(
  context: RoomCommandContext,
  room: PayloadDocument,
): Promise<{ addedMembers: number; removedMembers: number; warnings: string[] }> {
  const warnings: string[] = []
  const sync = await synchronizeRoomAccess(context.payload, room, {
    onAdded: async (member) => {
      try {
        await notifyRoomMember(context.payload, room, member)
      } catch (error) {
        warnings.push(`Invitation side effect failed for member ${member.memberId}.`)
        console.error('room_invitation_side_effect_failed', {
          roomId: room.id,
          memberId: member.memberId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    },
  })
  return { addedMembers: sync.added.length, removedMembers: sync.removed.length, warnings }
}

export async function createRoomCommand(
  context: RoomCommandContext,
  input: RoomInput,
): Promise<RoomCommandResult> {
  const title = text(input.title)
  if (!title) throw new PortalAdminActionError('invalid_input', 'Room title is required.', { title: 'Enter a Room title.' })
  if (title.length > 160) throw new PortalAdminActionError('invalid_input', 'Room title must be 160 characters or fewer.', { title: 'Use 160 characters or fewer.' })

  const startNow = input.startNow === true
  const audience = validateAudience({ ...input, audience: input.audience ?? 'all' })
  const categoryIds = ids(input.categoryIds)
  const data: Record<string, unknown> = {
    title,
    status: 'scheduled',
    scheduledAt: parseScheduledAt(input.scheduledAt, startNow),
    capacity: parseCapacity(input.capacity),
    audience: audience.audience,
    targetMemberIds: audience.targetMemberIds,
    targetGroupIds: audience.targetGroupIds,
    categories: categoryIds,
    hostUser: context.adminId,
    course: asRelation(input.courseId),
    space: asRelation(input.spaceId),
    description: text(input.description) ? buildPlainTextRichText(text(input.description)!) : undefined,
  }

  let room = await context.payload.create({
    collection: 'live_sessions',
    data,
    ...({ overrideAccess: true }),
    user: { id: context.adminId, collection: 'payload_users' },
  }) as PayloadDocument

  if (startNow) {
    room = await context.payload.update({
      collection: 'live_sessions',
      id: room.id,
      data: { status: 'live' },
      overrideAccess: true,
      overrideLock: true,
      user: { id: context.adminId, collection: 'payload_users' },
    }) as PayloadDocument
  }

  const reconciled = await reconcile(context, room)
  try {
    await notifyRoomCreator(context.payload, room, {
      adminId: context.adminId,
      adminEmail: context.adminEmail,
    })
  } catch (error) {
    reconciled.warnings.push('Creator acknowledgement side effect could not be queued.')
    console.error('room_creator_side_effect_failed', error)
  }

  return { room, ...reconciled }
}

export async function updateRoomCommand(
  context: RoomCommandContext,
  roomId: string,
  input: RoomUpdateInput,
): Promise<RoomCommandResult> {
  const before = await context.payload.findByID({
    collection: 'live_sessions',
    id: roomId,
    depth: 1,
    overrideAccess: true,
  }).catch((): null => null) as PayloadDocument | null
  if (!before) throw new PortalAdminActionError('not_found', 'Room not found.')
  if (!changedAtMatches(input.expectedUpdatedAt, before.updatedAt)) {
    throw new PortalAdminActionError('conflict', 'This Room changed in another window. Refresh before saving.')
  }

  const audienceInput = {
    audience: input.audience ?? before.audience ?? 'all',
    targetMemberIds: input.targetMemberIds ?? before.targetMemberIds,
    targetGroupIds: input.targetGroupIds ?? before.targetGroupIds,
    courseId: input.courseId !== undefined ? input.courseId : liveSessionRelationshipId(before.course),
    spaceId: input.spaceId !== undefined ? input.spaceId : liveSessionRelationshipId(before.space),
  }
  const audience = validateAudience(audienceInput)
  const data: Record<string, unknown> = {}
  if (input.title !== undefined) {
    const title = text(input.title)
    if (!title) throw new PortalAdminActionError('invalid_input', 'Room title is required.')
    if (title.length > 160) throw new PortalAdminActionError('invalid_input', 'Room title must be 160 characters or fewer.')
    data.title = title
  }
  if (input.scheduledAt !== undefined) data.scheduledAt = parseScheduledAt(input.scheduledAt, false)
  if (input.capacity !== undefined) data.capacity = parseCapacity(input.capacity)
  if (input.audience !== undefined || input.targetMemberIds !== undefined || input.targetGroupIds !== undefined) {
    data.audience = audience.audience
    data.targetMemberIds = audience.targetMemberIds
    data.targetGroupIds = audience.targetGroupIds
  }
  if (input.categoryIds !== undefined) data.categories = ids(input.categoryIds)
  if (input.courseId !== undefined) data.course = asRelation(input.courseId)
  if (input.spaceId !== undefined) data.space = asRelation(input.spaceId)
  if (input.description !== undefined) data.description = text(input.description) ? buildPlainTextRichText(text(input.description)!) : null

  if (Object.keys(data).length === 0) return { room: before, addedMembers: 0, removedMembers: 0, warnings: [] }
  const room = await context.payload.update({
    collection: 'live_sessions',
    id: roomId,
    data,
    overrideAccess: true,
    overrideLock: true,
    user: { id: context.adminId, collection: 'payload_users' },
  }) as PayloadDocument
  const reconciled = await reconcile(context, room)
  return { room, ...reconciled }
}

export async function transitionRoomCommand(
  context: RoomCommandContext,
  roomId: string,
  status: Extract<LiveSessionStatus, 'live' | 'completed' | 'cancelled'>,
  expectedUpdatedAt?: string | null,
): Promise<PayloadDocument> {
  const before = await context.payload.findByID({
    collection: 'live_sessions',
    id: roomId,
    depth: 0,
    overrideAccess: true,
  }).catch((): null => null) as PayloadDocument | null
  if (!before) throw new PortalAdminActionError('not_found', 'Room not found.')
  if (before.archived === true) throw new PortalAdminActionError('dependency_blocked', 'Archived Rooms cannot be started or transitioned.')
  if (!changedAtMatches(expectedUpdatedAt, before.updatedAt)) throw new PortalAdminActionError('conflict', 'This Room changed in another window. Refresh before saving.')
  const from = before.status as LiveSessionStatus | undefined
  if (!from) throw new PortalAdminActionError('conflict', 'Room lifecycle state is missing.')
  assertLiveSessionStatusTransition(from, status)
  return await context.payload.update({
    collection: 'live_sessions',
    id: roomId,
    data: { status },
    overrideAccess: true,
    overrideLock: true,
    user: { id: context.adminId, collection: 'payload_users' },
  }) as PayloadDocument
}

export async function archiveRoomCommand(
  context: RoomCommandContext,
  roomId: string,
  expectedUpdatedAt?: string | null,
): Promise<PayloadDocument> {
  const before = await context.payload.findByID({ collection: 'live_sessions', id: roomId, depth: 0, overrideAccess: true }).catch((): null => null) as PayloadDocument | null
  if (!before) throw new PortalAdminActionError('not_found', 'Room not found.')
  if (!changedAtMatches(expectedUpdatedAt, before.updatedAt)) throw new PortalAdminActionError('conflict', 'This Room changed in another window. Refresh before saving.')
  if (before.archived === true) return before
  return await context.payload.update({
    collection: 'live_sessions',
    id: roomId,
    data: { archived: true, archivedAt: new Date().toISOString() },
    overrideAccess: true,
    overrideLock: true,
    user: { id: context.adminId, collection: 'payload_users' },
  }) as PayloadDocument
}

export async function deleteRoomCommand(
  context: RoomCommandContext,
  roomId: string,
  confirmed: boolean,
): Promise<void> {
  if (!confirmed) throw new PortalAdminActionError('invalid_input', 'Deletion requires explicit confirmation.')
  const room = await context.payload.findByID({ collection: 'live_sessions', id: roomId, depth: 0, overrideAccess: true }).catch((): null => null) as PayloadDocument | null
  if (!room) throw new PortalAdminActionError('not_found', 'Room not found.')
  const grants = await context.payload.find({ collection: 'payload_room_access', where: { room: { equals: roomId } }, limit: 1, depth: 0, overrideAccess: true })
  const audit = Array.isArray(room.audit) ? room.audit : []
  const hasMeaningfulAudit = audit.some((entry) => entry && typeof entry === 'object' && (entry as Record<string, unknown>).event !== 'created')
  if (grants.docs.length > 0 || room.status !== 'scheduled' || hasMeaningfulAudit) {
    throw new PortalAdminActionError('dependency_blocked', 'Archive this Room to retain its access and audit history; hard deletion is not available after creation.')
  }
  if (!context.payload.delete) throw new PortalAdminActionError('internal_error', 'Room deletion is not available.')
  await context.payload.delete({ collection: 'live_sessions', id: roomId, overrideAccess: true, user: { id: context.adminId, collection: 'payload_users' } } as never)
}
