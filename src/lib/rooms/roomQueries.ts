import type { PayloadCourseAccessAPI, PayloadDocument } from '@/lib/payloadCourse/accessService'
import { isValidLiveSessionRoomName, type LiveSessionStatus } from '@/lib/liveSessions/sessionLifecycle'
import { isRoomMemberEntitled } from '@/lib/rooms/roomAccess'

export type RoomSummary = {
  id: string
  title: string
  status: LiveSessionStatus
  scheduledAt: string
  capacity: number
  audience: string
  courseTitle: string | null
  spaceTitle: string | null
  categories: string[]
  roomReady: boolean
  canJoin: boolean
  archived: boolean
  updatedAt: string | null
  participantCount: number | null
}

function text(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number') return String(value)
  return null
}

function relationshipText(value: unknown, key: 'title' | 'name'): string | null {
  if (!value || typeof value !== 'object') return null
  return text((value as Record<string, unknown>)[key])
}

function status(value: unknown): LiveSessionStatus | null {
  return value === 'scheduled' || value === 'live' || value === 'completed' || value === 'cancelled' ? value : null
}

function categoryNames(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    if (item && typeof item === 'object') return text((item as Record<string, unknown>).name)
    return null
  }).filter((item): item is string => Boolean(item))
}

export function roomSummary(document: PayloadDocument, participantCount: number | null = null): RoomSummary | null {
  const roomStatus = status(document.status)
  const scheduledAt = text(document.scheduledAt)
  if (!roomStatus || !scheduledAt) return null
  const roomReady = isValidLiveSessionRoomName(document.roomName)
  return {
    id: String(document.id),
    title: text(document.title) ?? 'Room',
    status: roomStatus,
    scheduledAt,
    capacity: typeof document.capacity === 'number' ? document.capacity : Number(document.capacity) || 50,
    audience: text(document.audience) ?? 'enrolled',
    courseTitle: relationshipText(document.course, 'title'),
    spaceTitle: relationshipText(document.space, 'name') ?? relationshipText(document.space, 'title'),
    categories: categoryNames(document.categories),
    roomReady,
    canJoin: roomStatus === 'live' && roomReady,
    archived: document.archived === true,
    updatedAt: text(document.updatedAt),
    participantCount,
  }
}

export async function listMemberRooms(
  payload: PayloadCourseAccessAPI,
  memberId: string,
): Promise<RoomSummary[]> {
  const result = await payload.find({
    collection: 'live_sessions',
    where: { archived: { not_equals: true } },
    limit: 500,
    sort: '-scheduledAt',
    depth: 1,
    overrideAccess: true,
  })
  const rooms: RoomSummary[] = []
  for (const document of result.docs as PayloadDocument[]) {
    if (document.status !== 'scheduled' && document.status !== 'live' && document.status !== 'completed' && document.status !== 'cancelled') continue
    if (!(await isRoomMemberEntitled(payload, document, memberId))) continue
    const summary = roomSummary(document)
    if (summary) rooms.push(summary)
  }
  return rooms
}

export async function findMemberRoom(
  payload: PayloadCourseAccessAPI,
  roomId: string,
  memberId: string,
): Promise<{ document: PayloadDocument; summary: RoomSummary } | null> {
  const document = await payload.findByID({ collection: 'live_sessions', id: roomId, depth: 1, overrideAccess: true }).catch((): null => null) as PayloadDocument | null
  if (!document || document.archived === true || (document.status !== 'scheduled' && document.status !== 'live')) return null
  if (!(await isRoomMemberEntitled(payload, document, memberId))) return null
  const summary = roomSummary(document)
  return summary ? { document, summary } : null
}

export async function listAdminRooms(payload: PayloadCourseAccessAPI): Promise<PayloadDocument[]> {
  const result = await payload.find({
    collection: 'live_sessions',
    limit: 500,
    sort: '-scheduledAt',
    depth: 1,
    overrideAccess: true,
  })
  return result.docs as PayloadDocument[]
}
