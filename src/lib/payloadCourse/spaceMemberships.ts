import type {
  PayloadCourseWriteAPI,
  PayloadDocument,
  PayloadId,
} from '@/lib/payloadCourse/accessService'
import {
  createAuditEvent,
  createEntitlementEvent,
  queueEmailEvent,
} from '@/lib/payloadCourse/events'

type ActorInput = {
  type: 'admin' | 'member' | 'system' | 'migration'
  id?: PayloadId | null
}

type SpaceMembershipRole = 'member' | 'moderator' | 'admin'
type SpaceMembershipStatus = 'pending' | 'active' | 'muted' | 'blocked' | 'removed'

type ManageSpaceMembershipInput = {
  actor: ActorInput
  memberId: PayloadId
  spaceId: PayloadId
  role?: SpaceMembershipRole
  status?: SpaceMembershipStatus
  reason?: string | null
  adminEmail?: string | null
}

type RemoveSpaceMembershipInput = ManageSpaceMembershipInput & {
  membershipId?: PayloadId | null
}

type RequestSpaceAccessInput = {
  memberId: PayloadId
  spaceId: PayloadId
  reason?: string | null
  adminEmail?: string | null
}

type SpaceMembershipServiceResult = {
  membership: PayloadDocument | null
  auditEvent: PayloadDocument
  changed: boolean
  emailEvents: PayloadDocument[]
}

function asString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value
  if (typeof value === 'number') return String(value)
  return null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null
  return value as Record<string, unknown>
}

function getDocumentId(value: unknown): string | null {
  const direct = asString(value)
  if (direct) return direct

  const record = asRecord(value)
  if (!record) return null

  return asString(record.id)
}

async function findOne(
  payload: PayloadCourseWriteAPI,
  collection: string,
  where: Record<string, unknown>
) {
  const result = await payload.find({
    collection,
    where,
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  return result.docs[0] ?? null
}

async function findByIdSafe(
  payload: PayloadCourseWriteAPI,
  collection: string,
  id: PayloadId | null | undefined
) {
  if (!id) return null

  try {
    return await payload.findByID({
      collection,
      id,
      depth: 0,
      overrideAccess: true,
    })
  } catch {
    return null
  }
}

async function findMember(payload: PayloadCourseWriteAPI, memberId: PayloadId) {
  return findByIdSafe(payload, 'payload_members', memberId)
}

async function findSpace(payload: PayloadCourseWriteAPI, spaceId: PayloadId) {
  return findByIdSafe(payload, 'payload_spaces', spaceId)
}

async function findMembership(
  payload: PayloadCourseWriteAPI,
  memberId: PayloadId,
  spaceId: PayloadId
) {
  return findOne(payload, 'payload_space_memberships', {
    and: [
      { member: { equals: String(memberId) } },
      { space: { equals: String(spaceId) } },
    ],
  })
}

async function findMembershipById(
  payload: PayloadCourseWriteAPI,
  membershipId: PayloadId | null | undefined
) {
  return findByIdSafe(payload, 'payload_space_memberships', membershipId)
}

function memberEmail(member: PayloadDocument | null): string | null {
  return typeof member?.email === 'string' ? member.email : null
}

function displayName(memberId: PayloadId, spaceId: PayloadId) {
  return `member:${memberId} -> space:${spaceId}`
}

function assertMutationActor(actor: ActorInput) {
  if (actor.type === 'member') {
    throw new Error('Member actors cannot directly mutate space memberships.')
  }
}

function assertRole(role: SpaceMembershipRole) {
  if (role !== 'member' && role !== 'moderator' && role !== 'admin') {
    throw new Error(`Unsupported space membership role: ${role}`)
  }
}

function assertStatus(status: SpaceMembershipStatus) {
  if (
    status !== 'pending' &&
    status !== 'active' &&
    status !== 'muted' &&
    status !== 'blocked' &&
    status !== 'removed'
  ) {
    throw new Error(`Unsupported space membership status: ${status}`)
  }
}

async function queueMembershipEmails(
  payload: PayloadCourseWriteAPI,
  args: {
    memberId: PayloadId
    spaceId: PayloadId
    membership: PayloadDocument
    action: 'granted' | 'removed' | 'requested' | 'updated'
    adminEmail?: string | null
    reason?: string | null
  }
) {
  const emailEvents: PayloadDocument[] = []
  const member = await findMember(payload, args.memberId)
  const toEmail = memberEmail(member)

  if (toEmail && args.action !== 'requested') {
    const { event } = await queueEmailEvent(payload, {
      toEmail,
      templateKey: `space-access-${args.action}`,
      dedupeKey: `space-access-${args.action}:${args.memberId}:${args.spaceId}:${args.membership.id}`,
      metadata: {
        spaceId: String(args.spaceId),
        membershipId: String(args.membership.id),
        reason: args.reason ?? null,
      },
    })
    emailEvents.push(event)
  }

  if (args.adminEmail) {
    const { event } = await queueEmailEvent(payload, {
      toEmail: args.adminEmail,
      templateKey: 'admin-notification',
      dedupeKey: `admin-notification:space-access-${args.action}:${args.membership.id}`,
      metadata: {
        action: `space-access-${args.action}`,
        memberId: String(args.memberId),
        spaceId: String(args.spaceId),
        membershipId: String(args.membership.id),
        reason: args.reason ?? null,
      },
    })
    emailEvents.push(event)
  }

  return emailEvents
}

export async function addSpaceMembership(
  payload: PayloadCourseWriteAPI,
  input: ManageSpaceMembershipInput
): Promise<SpaceMembershipServiceResult> {
  assertMutationActor(input.actor)

  const role = input.role ?? 'member'
  const status = input.status ?? 'active'
  assertRole(role)
  assertStatus(status)

  const [member, space, existing] = await Promise.all([
    findMember(payload, input.memberId),
    findSpace(payload, input.spaceId),
    findMembership(payload, input.memberId, input.spaceId),
  ])

  if (!member) throw new Error(`Missing member: ${input.memberId}`)
  if (!space) throw new Error(`Missing space: ${input.spaceId}`)

  const data = {
    displayName: displayName(input.memberId, input.spaceId),
    member: String(input.memberId),
    space: String(input.spaceId),
    role,
    status,
    joinedAt: existing?.joinedAt ?? new Date().toISOString(),
    metadata: {
      ...(existing && typeof existing.metadata === 'object' && existing.metadata ? existing.metadata : {}),
      reason: input.reason ?? null,
      source: input.actor.type,
    },
  }

  const membership = existing
    ? await payload.update({
        collection: 'payload_space_memberships',
        id: existing.id,
        data,
        overrideAccess: true,
      })
    : await payload.create({
        collection: 'payload_space_memberships',
        data,
        overrideAccess: true,
      })

  const auditEvent = await createAuditEvent(payload, {
    actorType: input.actor.type,
    actorId: input.actor.id,
    action: existing ? 'space_membership.updated' : 'space_membership.added',
    targetCollection: 'payload_space_memberships',
    targetId: membership.id,
    before: existing,
    after: membership,
    metadata: {
      memberId: String(input.memberId),
      spaceId: String(input.spaceId),
      role,
      status,
      reason: input.reason ?? null,
    },
  })

  if (status === 'active') {
    await createEntitlementEvent(payload, {
      member: input.memberId,
      eventType: 'access_granted',
      resourceType: 'space',
      resourceId: input.spaceId,
      result: 'changed',
      reason: input.reason,
      metadata: {
        membershipId: String(membership.id),
        auditEventId: String(auditEvent.id),
      },
    })
  }

  const emailEvents = await queueMembershipEmails(payload, {
    memberId: input.memberId,
    spaceId: input.spaceId,
    membership,
    action: existing ? 'updated' : 'granted',
    adminEmail: input.adminEmail,
    reason: input.reason,
  })

  return {
    membership,
    auditEvent,
    changed: true,
    emailEvents,
  }
}

export async function requestSpaceAccess(
  payload: PayloadCourseWriteAPI,
  input: RequestSpaceAccessInput
): Promise<SpaceMembershipServiceResult> {
  const [member, space, existing] = await Promise.all([
    findMember(payload, input.memberId),
    findSpace(payload, input.spaceId),
    findMembership(payload, input.memberId, input.spaceId),
  ])

  if (!member) throw new Error(`Missing member: ${input.memberId}`)
  if (!space) throw new Error(`Missing space: ${input.spaceId}`)

  const visibility = asString(space.visibility)
  const status = asString(space.status)
  if (status !== 'published' || visibility !== 'private') {
    throw new Error('Space access requests are only supported for published private spaces.')
  }

  if (existing?.status === 'blocked') {
    throw new Error('Member is blocked from this space.')
  }

  if (existing?.status === 'active') {
    const auditEvent = await createAuditEvent(payload, {
      actorType: 'member',
      actorId: input.memberId,
      action: 'space_membership.request.noop',
      targetCollection: 'payload_space_memberships',
      targetId: existing.id,
      severity: 'warning',
      metadata: {
        memberId: String(input.memberId),
        spaceId: String(input.spaceId),
        reason: input.reason ?? null,
      },
    })

    return {
      membership: existing,
      auditEvent,
      changed: false,
      emailEvents: [],
    }
  }

  const data = {
    displayName: displayName(input.memberId, input.spaceId),
    member: String(input.memberId),
    space: String(input.spaceId),
    role: 'member',
    status: 'pending',
    metadata: {
      ...(existing && typeof existing.metadata === 'object' && existing.metadata ? existing.metadata : {}),
      requestReason: input.reason ?? null,
      requestedAt: new Date().toISOString(),
    },
  }

  const membership = existing
    ? await payload.update({
        collection: 'payload_space_memberships',
        id: existing.id,
        data,
        overrideAccess: true,
      })
    : await payload.create({
        collection: 'payload_space_memberships',
        data,
        overrideAccess: true,
      })

  const auditEvent = await createAuditEvent(payload, {
    actorType: 'member',
    actorId: input.memberId,
    action: existing ? 'space_membership.request.updated' : 'space_membership.requested',
    targetCollection: 'payload_space_memberships',
    targetId: membership.id,
    before: existing,
    after: membership,
    metadata: {
      memberId: String(input.memberId),
      spaceId: String(input.spaceId),
      reason: input.reason ?? null,
    },
  })

  const emailEvents = await queueMembershipEmails(payload, {
    memberId: input.memberId,
    spaceId: input.spaceId,
    membership,
    action: 'requested',
    adminEmail: input.adminEmail,
    reason: input.reason,
  })

  return {
    membership,
    auditEvent,
    changed: true,
    emailEvents,
  }
}

export async function removeSpaceMembership(
  payload: PayloadCourseWriteAPI,
  input: RemoveSpaceMembershipInput
): Promise<SpaceMembershipServiceResult> {
  assertMutationActor(input.actor)

  const existing = input.membershipId
    ? await findMembershipById(payload, input.membershipId)
    : await findMembership(payload, input.memberId, input.spaceId)

  if (!existing) {
    const auditEvent = await createAuditEvent(payload, {
      actorType: input.actor.type,
      actorId: input.actor.id,
      action: 'space_membership.remove.noop',
      targetCollection: 'payload_space_memberships',
      severity: 'warning',
      metadata: {
        memberId: String(input.memberId),
        spaceId: String(input.spaceId),
        reason: input.reason ?? null,
      },
    })

    return {
      membership: null,
      auditEvent,
      changed: false,
      emailEvents: [],
    }
  }

  const effectiveMemberId = getDocumentId(existing.member) ?? String(input.memberId)
  const effectiveSpaceId = getDocumentId(existing.space) ?? String(input.spaceId)

  const membership = await payload.update({
    collection: 'payload_space_memberships',
    id: existing.id,
    data: {
      status: 'removed',
      expiresAt: new Date().toISOString(),
      metadata: {
        ...(typeof existing.metadata === 'object' && existing.metadata ? existing.metadata : {}),
        removedBy: input.actor.id ? String(input.actor.id) : input.actor.type,
        removedReason: input.reason ?? null,
      },
    },
    overrideAccess: true,
  })

  const auditEvent = await createAuditEvent(payload, {
    actorType: input.actor.type,
    actorId: input.actor.id,
    action: 'space_membership.removed',
    targetCollection: 'payload_space_memberships',
    targetId: membership.id,
    before: existing,
    after: membership,
    metadata: {
      memberId: effectiveMemberId,
      spaceId: effectiveSpaceId,
      reason: input.reason ?? null,
    },
  })

  await createEntitlementEvent(payload, {
    member: effectiveMemberId,
    eventType: 'access_revoked',
    resourceType: 'space',
    resourceId: effectiveSpaceId,
    result: 'changed',
    reason: input.reason,
    metadata: {
      membershipId: String(membership.id),
      auditEventId: String(auditEvent.id),
    },
  })

  const emailEvents = await queueMembershipEmails(payload, {
    memberId: effectiveMemberId,
    spaceId: effectiveSpaceId,
    membership,
    action: 'removed',
    adminEmail: input.adminEmail,
    reason: input.reason,
  })

  return {
    membership,
    auditEvent,
    changed: true,
    emailEvents,
  }
}
