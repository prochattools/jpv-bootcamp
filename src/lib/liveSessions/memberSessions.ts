import type { PayloadCourseAccessAPI, PayloadDocument } from '@/lib/payloadCourse/accessService'
import {
  isValidLiveSessionRoomName,
  liveSessionRelationshipId,
  type LiveSessionStatus,
} from '@/lib/liveSessions/sessionLifecycle'

export type MemberLiveSessionSummary = {
  id: string
  title: string
  status: LiveSessionStatus
  scheduledAt: string
  courseId: string | null
  courseTitle: string
  spaceId: string | null
  spaceTitle: string | null
  spaceSlug: string | null
  moduleId: string | null
  lessonId: string | null
  roomReady: boolean
  canJoin: boolean
}

export type SpaceLiveCallSummary = {
  id: string
  title: string
  description: null
  status: LiveSessionStatus
  scheduledAt: string
  spaceId: string
  roomReady: boolean
  canJoin: boolean
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized || null
}

function relationshipTitle(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  return text(record.title) ?? text(record.name)
}

function relationshipSlug(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  return text((value as Record<string, unknown>).slug)
}

function isLiveSessionStatus(value: unknown): value is LiveSessionStatus {
  return value === 'scheduled' || value === 'live' || value === 'completed' || value === 'cancelled'
}

function targetIds(value: unknown): Set<string> {
  return new Set(Array.isArray(value) ? value.map((entry) => String(entry)) : [])
}

export function isLiveSessionAudienceAllowed(
  document: PayloadDocument,
  memberId: string,
  enrolledCourseIds: ReadonlySet<string>,
  memberSpaceIds: ReadonlySet<string>,
): boolean {
  if (document.audience === 'all') return true
  if (document.audience === 'selected') return targetIds(document.targetMemberIds).has(String(memberId))
  const courseId = liveSessionRelationshipId(document.course)
  const spaceId = liveSessionRelationshipId(document.space)
  return Boolean((courseId && enrolledCourseIds.has(courseId)) || (spaceId && memberSpaceIds.has(spaceId)))
}

export async function listMemberLiveSessions(
  payload: PayloadCourseAccessAPI,
  memberId: string,
): Promise<MemberLiveSessionSummary[]> {
  const enrollments = await payload.find({
    collection: 'payload_course_enrollments',
    where: {
      and: [
        { member: { equals: memberId } },
        { status: { equals: 'active' } },
      ],
    },
    limit: 200,
    depth: 0,
    overrideAccess: true,
  })
  const courseIds = [...new Set(
    enrollments.docs
      .map((enrollment) => liveSessionRelationshipId(enrollment.course))
      .filter((id): id is string => Boolean(id)),
  )]
  const memberships = await payload.find({
    collection: 'payload_space_memberships',
    where: {
      and: [
        { member: { equals: memberId } },
        { status: { equals: 'active' } },
      ],
    },
    limit: 500,
    depth: 0,
    overrideAccess: true,
  })
  const spaceIds = new Set(memberships.docs.map((membership) => liveSessionRelationshipId(membership.space)).filter((id): id is string => Boolean(id)))

  const result = await payload.find({
    collection: 'live_sessions',
    where: { status: { in: ['scheduled', 'live'] } },
    limit: 200,
    depth: 1,
    sort: 'scheduledAt',
    overrideAccess: true,
  })

  return result.docs.flatMap((document: PayloadDocument) => {
    const courseId = liveSessionRelationshipId(document.course)
    const spaceId = liveSessionRelationshipId(document.space)
    const status = document.status
    const scheduledAt = text(document.scheduledAt)
    if ((!courseId && !spaceId) || !isLiveSessionStatus(status) || !scheduledAt) return []
    if (!isLiveSessionAudienceAllowed(document, memberId, new Set(courseIds), spaceIds)) return []

    const roomReady = isValidLiveSessionRoomName(document.roomName)
    return [{
      id: String(document.id),
      title: text(document.title) ?? 'Live session',
      status,
      scheduledAt,
      courseId,
      courseTitle: relationshipTitle(document.course) ?? 'Live session',
      spaceId,
      spaceTitle: relationshipTitle(document.space),
      spaceSlug: relationshipSlug(document.space),
      moduleId: liveSessionRelationshipId(document.module),
      lessonId: liveSessionRelationshipId(document.lesson),
      roomReady,
      canJoin: status === 'live' && roomReady,
    }]
  })
}

export async function listSpaceLiveCalls(
  payload: PayloadCourseAccessAPI,
  spaceId: string | number,
): Promise<SpaceLiveCallSummary[]> {
  const result = await payload.find({
    collection: 'live_sessions',
    where: {
      and: [
        { space: { equals: String(spaceId) } },
        { status: { not_equals: 'completed' } },
      ],
    },
    limit: 50,
    depth: 0,
    sort: 'scheduledAt',
    overrideAccess: true,
  })

  return result.docs.flatMap((document: PayloadDocument): SpaceLiveCallSummary[] => {
    const docSpaceId = liveSessionRelationshipId(document.space)
    const status = document.status
    const scheduledAt = text(document.scheduledAt)
    if (!docSpaceId || !isLiveSessionStatus(status) || !scheduledAt) return []

    const roomReady = isValidLiveSessionRoomName(document.roomName)
    return [{
      id: String(document.id),
      title: text(document.title) ?? 'Group call',
      description: null,
      status,
      scheduledAt,
      spaceId: docSpaceId,
      roomReady,
      canJoin: status === 'live' && roomReady,
    }]
  })
}
