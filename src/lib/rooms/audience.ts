import type { PayloadCourseAccessAPI, PayloadDocument } from '@/lib/payloadCourse/accessService'
import { liveSessionRelationshipId } from '@/lib/liveSessions/sessionLifecycle'

export type RoomAudience = 'all' | 'selected' | 'groups' | 'enrolled'
export type RoomGrantSource = 'all_active' | 'selected' | 'member_group' | 'enrolled'

export type RoomAudienceMember = {
  memberId: string
  email: string
  displayName: string
  sources: RoomGrantSource[]
}

function text(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number') return String(value)
  return null
}

export function uniqueRelationshipIds(values: unknown): string[] {
  const list = Array.isArray(values) ? values : []
  return [...new Set(list.map(liveSessionRelationshipId).filter((id): id is string => Boolean(id)))]
}

export function normalizeRoomAudience(value: unknown): RoomAudience {
  return value === 'all' || value === 'selected' || value === 'groups' || value === 'enrolled'
    ? value
    : 'all'
}

export function mergeAudienceSources(
  entries: Array<{ memberId: string; source: RoomGrantSource }>,
): Map<string, RoomGrantSource[]> {
  const result = new Map<string, RoomGrantSource[]>()
  for (const entry of entries) {
    const memberId = String(entry.memberId)
    const sources = result.get(memberId) ?? []
    if (!sources.includes(entry.source)) sources.push(entry.source)
    result.set(memberId, sources)
  }
  return result
}

function isEligibleMember(member: PayloadDocument): boolean {
  return member.accountStatus === 'active' && Boolean(member.emailVerifiedAt) && Boolean(text(member.email))
}

async function loadMember(
  payload: PayloadCourseAccessAPI,
  memberId: string,
): Promise<PayloadDocument | null> {
  return await payload.findByID({
    collection: 'payload_members',
    id: memberId,
    depth: 0,
    overrideAccess: true,
  }).catch((): null => null) as PayloadDocument | null
}

async function buildRecipients(
  payload: PayloadCourseAccessAPI,
  memberSources: Map<string, RoomGrantSource[]>,
): Promise<RoomAudienceMember[]> {
  const recipients: RoomAudienceMember[] = []
  for (const [memberId, sources] of memberSources) {
    const member = await loadMember(payload, memberId)
    if (!member || !isEligibleMember(member)) continue
    const profiles = await payload.find({
      collection: 'payload_member_profiles',
      where: { member: { equals: memberId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    }).catch(() => ({ docs: [] as PayloadDocument[] }))
    recipients.push({
      memberId,
      email: text(member.email)!,
      displayName: text(profiles.docs[0]?.displayName) ?? 'Member',
      sources,
    })
  }
  return recipients
}

async function groupMemberSources(
  payload: PayloadCourseAccessAPI,
  groupIds: string[],
): Promise<Array<{ memberId: string; source: RoomGrantSource }>> {
  const entries: Array<{ memberId: string; source: RoomGrantSource }> = []
  for (const groupId of groupIds) {
    const group = await payload.findByID({
      collection: 'payload_member_groups',
      id: groupId,
      depth: 0,
      overrideAccess: true,
    }).catch((): null => null) as PayloadDocument | null
    if (!group || group.status !== 'active') continue
    for (const member of Array.isArray(group.members) ? group.members : []) {
      const memberId = liveSessionRelationshipId(member)
      if (memberId) entries.push({ memberId, source: 'member_group' })
    }
  }
  return entries
}

async function enrolledMemberSources(
  payload: PayloadCourseAccessAPI,
  room: PayloadDocument,
): Promise<Array<{ memberId: string; source: RoomGrantSource }>> {
  const entries: Array<{ memberId: string; source: RoomGrantSource }> = []
  const courseId = liveSessionRelationshipId(room.course)
  const spaceId = liveSessionRelationshipId(room.space)
  if (courseId) {
    const enrollments = await payload.find({
      collection: 'payload_course_enrollments',
      where: { and: [{ course: { equals: courseId } }, { status: { equals: 'active' } }] },
      limit: 2000,
      depth: 0,
      overrideAccess: true,
    })
    for (const enrollment of enrollments.docs) {
      const memberId = liveSessionRelationshipId(enrollment.member)
      if (memberId) entries.push({ memberId, source: 'enrolled' })
    }
  }
  if (spaceId) {
    const memberships = await payload.find({
      collection: 'payload_space_memberships',
      where: { and: [{ space: { equals: spaceId } }, { status: { equals: 'active' } }] },
      limit: 2000,
      depth: 0,
      overrideAccess: true,
    })
    for (const membership of memberships.docs) {
      const memberId = liveSessionRelationshipId(membership.member)
      if (memberId) entries.push({ memberId, source: 'enrolled' })
    }
  }
  return entries
}

/** Resolve the trusted, deduplicated, eligible recipient set for a Room. */
export async function resolveRoomAudience(
  payload: PayloadCourseAccessAPI,
  room: PayloadDocument,
): Promise<RoomAudienceMember[]> {
  const audience = normalizeRoomAudience(room.audience)
  if (audience === 'all') {
    const members = await payload.find({
      collection: 'payload_members',
      where: { accountStatus: { equals: 'active' } },
      limit: 2000,
      depth: 0,
      overrideAccess: true,
    })
    return buildRecipients(payload, mergeAudienceSources(
      members.docs.map((member) => ({ memberId: String(member.id), source: 'all_active' as const })),
    ))
  }

  if (audience === 'selected') {
    return buildRecipients(payload, mergeAudienceSources(
      uniqueRelationshipIds(room.targetMemberIds).map((memberId) => ({ memberId, source: 'selected' as const })),
    ))
  }

  if (audience === 'groups') {
    return buildRecipients(payload, mergeAudienceSources(
      await groupMemberSources(payload, uniqueRelationshipIds(room.targetGroupIds)),
    ))
  }

  return buildRecipients(payload, mergeAudienceSources(await enrolledMemberSources(payload, room)))
}

export function roomAudienceMemberIds(members: RoomAudienceMember[]): string[] {
  return members.map((member) => member.memberId)
}
