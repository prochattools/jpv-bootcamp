import type {
  PayloadCourseWriteAPI,
  PayloadDocument,
  PayloadId,
} from '@/lib/payloadCourse/accessService'
import type { ResourceType } from '@/lib/entitlements/evaluateAccess'
import {
  createAuditEvent,
  createEntitlementEvent,
  queueEmailEvent,
} from '@/lib/payloadCourse/events'

type ActorInput = {
  type: 'admin' | 'system' | 'migration'
  id?: PayloadId | null
}

type GrantAccessInput = {
  actor: ActorInput
  memberId?: PayloadId | null
  accessGroupId?: PayloadId | null
  resourceType: ResourceType
  resourceId: PayloadId
  startsAt?: Date | string | null
  expiresAt?: Date | string | null
  reason?: string | null
  sourceId?: string | null
  adminEmail?: string | null
}

type RevokeAccessInput = GrantAccessInput & {
  grantId?: PayloadId | null
}

type GrantServiceResult = {
  grant: PayloadDocument | null
  auditEvent: PayloadDocument
  changed: boolean
  emailEvents: PayloadDocument[]
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

async function findMember(payload: PayloadCourseWriteAPI, memberId?: PayloadId | null) {
  if (!memberId) return null
  try {
    return await payload.findByID({
      collection: 'payload_members',
      id: memberId,
      depth: 0,
      overrideAccess: true,
    })
  } catch {
    return null
  }
}

function memberEmail(member: PayloadDocument | null): string | null {
  return typeof member?.email === 'string' ? member.email : null
}

function validateSubject(input: GrantAccessInput) {
  if (input.memberId && input.accessGroupId) {
    throw new Error('Grant target must be either memberId or accessGroupId, not both.')
  }

  if (!input.memberId && !input.accessGroupId) {
    throw new Error('Grant target requires memberId or accessGroupId.')
  }
}

function grantWhere(input: GrantAccessInput) {
  const subject = input.memberId
    ? { member: { equals: String(input.memberId) } }
    : { accessGroup: { equals: String(input.accessGroupId) } }

  return {
    and: [
      subject,
      { resourceType: { equals: input.resourceType } },
      { resourceId: { equals: String(input.resourceId) } },
      { status: { equals: 'active' } },
    ],
  }
}

function displayName(input: GrantAccessInput) {
  const subject = input.memberId
    ? `member:${input.memberId}`
    : `access-group:${input.accessGroupId}`

  return `${subject} -> ${input.resourceType}:${input.resourceId}`
}

async function queueGrantEmails(
  payload: PayloadCourseWriteAPI,
  input: GrantAccessInput,
  grant: PayloadDocument,
  action: 'granted' | 'revoked'
) {
  const emailEvents: PayloadDocument[] = []
  const member = await findMember(payload, input.memberId)
  const toEmail = memberEmail(member)

  if (toEmail && input.memberId) {
    const { event } = await queueEmailEvent(payload, {
      toEmail,
      templateKey: `manual-access-${action}`,
      dedupeKey: `manual-access-${action}:${input.memberId}:${input.resourceType}:${input.resourceId}:${grant.id}`,
      metadata: {
        resourceType: input.resourceType,
        resourceId: String(input.resourceId),
        grantId: String(grant.id),
        reason: input.reason ?? null,
      },
    })
    emailEvents.push(event)
  }

  if (input.adminEmail) {
    const { event } = await queueEmailEvent(payload, {
      toEmail: input.adminEmail,
      templateKey: 'admin-notification',
      dedupeKey: `admin-notification:manual-access-${action}:${grant.id}`,
      metadata: {
        action: `manual-access-${action}`,
        resourceType: input.resourceType,
        resourceId: String(input.resourceId),
        grantId: String(grant.id),
      },
    })
    emailEvents.push(event)
  }

  return emailEvents
}

export async function grantAccess(
  payload: PayloadCourseWriteAPI,
  input: GrantAccessInput
): Promise<GrantServiceResult> {
  validateSubject(input)

  const existing = await findOne(payload, 'payload_access_grants', grantWhere(input))
  const data = {
    displayName: displayName(input),
    member: input.memberId ?? undefined,
    accessGroup: input.accessGroupId ?? undefined,
    resourceType: input.resourceType,
    resourceId: String(input.resourceId),
    status: 'active',
    source: 'manual',
    sourceId: input.sourceId ?? undefined,
    startsAt: input.startsAt ?? undefined,
    expiresAt: input.expiresAt ?? undefined,
    metadata: {
      reason: input.reason ?? null,
    },
  }

  const grant = existing
    ? await payload.update({
        collection: 'payload_access_grants',
        id: existing.id,
        data,
        overrideAccess: true,
      })
    : await payload.create({
        collection: 'payload_access_grants',
        data,
        overrideAccess: true,
      })

  const auditEvent = await createAuditEvent(payload, {
    actorType: input.actor.type,
    actorId: input.actor.id,
    action: existing ? 'access.grant.updated' : 'access.granted',
    targetCollection: 'payload_access_grants',
    targetId: grant.id,
    before: existing ?? null,
    after: grant,
    metadata: {
      resourceType: input.resourceType,
      resourceId: String(input.resourceId),
      reason: input.reason ?? null,
    },
  })

  await createEntitlementEvent(payload, {
    member: input.memberId,
    eventType: 'access_granted',
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    result: 'changed',
    reason: input.reason,
    metadata: {
      grantId: String(grant.id),
      auditEventId: String(auditEvent.id),
    },
  })

  const emailEvents = await queueGrantEmails(payload, input, grant, 'granted')

  return {
    grant,
    auditEvent,
    changed: true,
    emailEvents,
  }
}

export async function revokeAccess(
  payload: PayloadCourseWriteAPI,
  input: RevokeAccessInput
): Promise<GrantServiceResult> {
  validateSubject(input)

  const existing = input.grantId
    ? await findOne(payload, 'payload_access_grants', {
        id: { equals: String(input.grantId) },
      })
    : await findOne(payload, 'payload_access_grants', grantWhere(input))

  if (!existing) {
    const auditEvent = await createAuditEvent(payload, {
      actorType: input.actor.type,
      actorId: input.actor.id,
      action: 'access.revoke.noop',
      targetCollection: 'payload_access_grants',
      severity: 'warning',
      metadata: {
        resourceType: input.resourceType,
        resourceId: String(input.resourceId),
        reason: input.reason ?? null,
      },
    })

    return {
      grant: null,
      auditEvent,
      changed: false,
      emailEvents: [],
    }
  }

  const grant = await payload.update({
    collection: 'payload_access_grants',
    id: existing.id,
    data: {
      status: 'revoked',
      revokedAt: new Date().toISOString(),
      revokedReason: input.reason ?? 'Manual revoke',
      metadata: {
        ...(typeof existing.metadata === 'object' && existing.metadata ? existing.metadata : {}),
        revokedBy: input.actor.id ? String(input.actor.id) : input.actor.type,
      },
    },
    overrideAccess: true,
  })

  const auditEvent = await createAuditEvent(payload, {
    actorType: input.actor.type,
    actorId: input.actor.id,
    action: 'access.revoked',
    targetCollection: 'payload_access_grants',
    targetId: grant.id,
    before: existing,
    after: grant,
    metadata: {
      resourceType: input.resourceType,
      resourceId: String(input.resourceId),
      reason: input.reason ?? null,
    },
  })

  await createEntitlementEvent(payload, {
    member: input.memberId,
    eventType: 'access_revoked',
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    result: 'changed',
    reason: input.reason,
    metadata: {
      grantId: String(grant.id),
      auditEventId: String(auditEvent.id),
    },
  })

  const emailEvents = await queueGrantEmails(payload, input, grant, 'revoked')

  return {
    grant,
    auditEvent,
    changed: true,
    emailEvents,
  }
}
