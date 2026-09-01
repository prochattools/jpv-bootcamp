import type { PayloadCourseAccessAPI, PayloadCourseWriteAPI, PayloadDocument } from '@/lib/payloadCourse/accessService'
import { normalizeRelationshipId } from '@/lib/domain/relationships'
import { liveSessionRelationshipId } from '@/lib/liveSessions/sessionLifecycle'
import {
  normalizeRoomAudience,
  resolveRoomAudience,
  resolveRoomCreatorMemberId,
  type RoomAudienceMember,
  type RoomGrantSource,
} from '@/lib/rooms/audience'

export type RoomAccessStatus = 'active' | 'revoked'

export function roomAccessEventKey(roomId: string | number, memberId: string | number): string {
  return `room-invitation:${String(roomId)}:${String(memberId)}`
}

function text(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number') return String(value)
  return null
}

async function memberIsAdministrator(
  payload: PayloadCourseAccessAPI,
  member: PayloadDocument,
): Promise<boolean> {
  if (member.isAdministrator === true) return true
  const email = text(member.email)
  const result = await payload.find({
    collection: 'payload_users',
    where: {
      or: [
        { portalMember: { equals: String(member.id) } },
        ...(email ? [{ email: { equals: email } }] : []),
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  }).catch(() => ({ docs: [] as PayloadDocument[] }))
  return result.docs.length > 0
}

async function memberIsEligible(payload: PayloadCourseAccessAPI, memberId: string): Promise<boolean> {
  const member = await payload.findByID({
    collection: 'payload_members',
    id: memberId,
    depth: 0,
    overrideAccess: true,
  }).catch((): null => null) as PayloadDocument | null
  if (!member || !text(member.email) || member.accountStatus === 'deleted') return false
  if (member.accountStatus === 'active' && Boolean(member.emailVerifiedAt)) return true
  return memberIsAdministrator(payload, member)
}

async function findRoomGrants(
  payload: PayloadCourseAccessAPI,
  roomId: string,
): Promise<PayloadDocument[]> {
  const result = await payload.find({
    collection: 'payload_room_access',
    where: { room: { equals: normalizeRelationshipId(roomId) } },
    limit: 5000,
    depth: 0,
    overrideAccess: true,
  })
  return result.docs as PayloadDocument[]
}

function grantMemberId(grant: PayloadDocument): string | null {
  return liveSessionRelationshipId(grant.member)
}

async function legacyAudienceAllows(
  payload: PayloadCourseAccessAPI,
  room: PayloadDocument,
  memberId: string,
): Promise<boolean> {
  const audience = normalizeRoomAudience(room.audience)
  if (audience === 'all') return true
  if (audience === 'selected') {
    return (Array.isArray(room.targetMemberIds) ? room.targetMemberIds : [])
      .some((value) => liveSessionRelationshipId(value) === memberId)
  }
  if (audience === 'groups') return false

  const courseId = liveSessionRelationshipId(room.course)
  const spaceId = liveSessionRelationshipId(room.space)
  const checks: Promise<boolean>[] = []
  if (courseId) {
    checks.push(payload.find({
      collection: 'payload_course_enrollments',
      where: {
        and: [
          { member: { equals: memberId } },
          { course: { equals: courseId } },
          { status: { equals: 'active' } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    }).then((result) => result.docs.length > 0))
  }
  if (spaceId) {
    checks.push(payload.find({
      collection: 'payload_space_memberships',
      where: {
        and: [
          { member: { equals: memberId } },
          { space: { equals: spaceId } },
          { status: { equals: 'active' } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    }).then((result) => result.docs.length > 0))
  }
  return (await Promise.all(checks)).some(Boolean)
}

/**
 * The single trusted member authorization decision for Room visibility and
 * LiveKit token issuance. Revoked ledger rows always win over legacy rules.
 */
export async function isRoomMemberEntitled(
  payload: PayloadCourseAccessAPI,
  room: PayloadDocument,
  memberId: string | number,
): Promise<boolean> {
  const normalizedMemberId = String(memberId)
  if (!(await memberIsEligible(payload, normalizedMemberId))) return false

  const grants = await findRoomGrants(payload, String(room.id))
  const memberGrant = grants.find((grant) => grantMemberId(grant) === normalizedMemberId)
  if (memberGrant) return memberGrant.status === 'active'

  // Keep existing Rooms usable for their creator even when they were created
  // before creator grants were reconciled. A persisted revoked grant above
  // still wins and denies access.
  if (await resolveRoomCreatorMemberId(payload, room) === normalizedMemberId) return true

  return legacyAudienceAllows(payload, room, normalizedMemberId)
}

function sourceForMember(member: RoomAudienceMember): RoomGrantSource {
  return member.sources[0] ?? 'selected'
}

export type RoomAccessSyncResult = {
  added: string[]
  reactivated: string[]
  removed: string[]
  recipients: RoomAudienceMember[]
}

/** Reconcile the durable ledger to the current audience, retaining revokes. */
export async function synchronizeRoomAccess(
  payload: PayloadCourseWriteAPI,
  room: PayloadDocument,
  options: {
    onAdded?: (member: RoomAudienceMember) => Promise<void>
    now?: Date
  } = {},
): Promise<RoomAccessSyncResult> {
  const recipients = await resolveRoomAudience(payload, room)
  const desired = new Map(recipients.map((member) => [member.memberId, member]))
  const existing = await findRoomGrants(payload, String(room.id))
  const byMember = new Map<string, PayloadDocument>()
  for (const grant of existing) {
    const memberId = grantMemberId(grant)
    if (memberId) byMember.set(memberId, grant)
  }

  const added: string[] = []
  const reactivated: string[] = []
  const removed: string[] = []
  const timestamp = (options.now ?? new Date()).toISOString()

  for (const member of recipients) {
    const previous = byMember.get(member.memberId)
    if (!previous) {
      let created = true
      try {
        await payload.create({
          collection: 'payload_room_access',
          data: {
            room: normalizeRelationshipId(room.id),
            member: normalizeRelationshipId(member.memberId),
            grantSource: sourceForMember(member),
            status: 'active',
            eventKey: roomAccessEventKey(String(room.id), member.memberId),
            grantedAt: timestamp,
            metadata: { sources: member.sources },
          },
          overrideAccess: true,
        })
      } catch {
        // A concurrent reconciliation may have won the unique room/member or
        // event-key race. Re-read before deciding whether a side effect is new.
        const raced = await payload.find({
          collection: 'payload_room_access',
          where: { eventKey: { equals: roomAccessEventKey(String(room.id), member.memberId) } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        if (raced.docs.length === 0) throw new Error('Room access grant could not be persisted.')
        created = false
      }
      if (created) {
        added.push(member.memberId)
        await options.onAdded?.(member)
      }
      continue
    }

    if (previous.status !== 'active') {
      await payload.update({
        collection: 'payload_room_access',
        id: previous.id,
        data: {
          status: 'active',
          revokedAt: null,
          grantSource: sourceForMember(member),
          metadata: { sources: member.sources },
        },
        overrideAccess: true,
      })
      reactivated.push(member.memberId)
    }
  }

  for (const grant of existing) {
    const memberId = grantMemberId(grant)
    if (!memberId || desired.has(memberId) || grant.status !== 'active') continue
    await payload.update({
      collection: 'payload_room_access',
      id: grant.id,
      data: { status: 'revoked', revokedAt: timestamp },
      overrideAccess: true,
    })
    removed.push(memberId)
  }

  return { added, reactivated, removed, recipients }
}

export async function listActiveRoomGrantMemberIds(
  payload: PayloadCourseAccessAPI,
  roomId: string | number,
): Promise<string[]> {
  const grants = await payload.find({
    collection: 'payload_room_access',
    where: { and: [{ room: { equals: normalizeRelationshipId(roomId) } }, { status: { equals: 'active' } }] },
    limit: 5000,
    depth: 0,
    overrideAccess: true,
  })
  return grants.docs.map(grantMemberId).filter((id): id is string => Boolean(id))
}
