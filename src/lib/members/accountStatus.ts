import type {
  PayloadCourseWriteAPI,
  PayloadDocument,
  PayloadId,
} from '@/lib/payloadCourse/accessService'
import { createAuditEvent, queueEmailEvent } from '@/lib/payloadCourse/events'

type ActorInput = {
  type: 'admin' | 'system' | 'stripe' | 'migration'
  id?: PayloadId | null
}

type AccountStatusChangeInput = {
  memberId: PayloadId
  actor: ActorInput
  reason: string
  eventId?: string | null
  adminEmail?: string | null
}

type AccountStatusChangeResult = {
  member: PayloadDocument
  auditEvent: PayloadDocument
  changed: boolean
  emailEvents: PayloadDocument[]
}

async function findMember(payload: PayloadCourseWriteAPI, memberId: PayloadId) {
  return payload.findByID({
    collection: 'payload_members',
    id: memberId,
    depth: 0,
    overrideAccess: true,
  })
}

function getEmail(member: PayloadDocument) {
  return typeof member.email === 'string' ? member.email : null
}

async function writeSecurityEvent(
  payload: PayloadCourseWriteAPI,
  input: AccountStatusChangeInput,
  eventType: 'account_blocked' | 'account_restored'
) {
  return payload.create({
    collection: 'payload_member_security_events',
    data: {
      member: input.memberId,
      eventType,
      source: input.actor.type,
      metadata: {
        actorId: input.actor.id ? String(input.actor.id) : null,
        reason: input.reason,
        eventId: input.eventId ?? null,
      },
    },
    overrideAccess: true,
  })
}

async function queueAccountEmails(
  payload: PayloadCourseWriteAPI,
  input: AccountStatusChangeInput,
  member: PayloadDocument,
  action: 'blocked' | 'restored',
  auditEvent: PayloadDocument
) {
  const emailEvents: PayloadDocument[] = []
  const email = getEmail(member)
  const sourceEventId = input.eventId ?? String(auditEvent.id)

  if (email) {
    const { event } = await queueEmailEvent(payload, {
      toEmail: email,
      templateKey: `access-${action}`,
      dedupeKey: `access-${action}:${member.id}:${input.reason}:${sourceEventId}`,
      metadata: {
        memberId: String(member.id),
        reason: input.reason,
        auditEventId: String(auditEvent.id),
      },
    })
    emailEvents.push(event)
  }

  if (input.adminEmail) {
    const { event } = await queueEmailEvent(payload, {
      toEmail: input.adminEmail,
      templateKey: 'admin-notification',
      dedupeKey: `admin-notification:account-${action}:${member.id}:${sourceEventId}`,
      metadata: {
        memberId: String(member.id),
        reason: input.reason,
        auditEventId: String(auditEvent.id),
      },
    })
    emailEvents.push(event)
  }

  return emailEvents
}

export async function blockMember(
  payload: PayloadCourseWriteAPI,
  input: AccountStatusChangeInput
): Promise<AccountStatusChangeResult> {
  const before = await findMember(payload, input.memberId)

  if (before.accountStatus === 'blocked') {
    const auditEvent = await createAuditEvent(payload, {
      actorType: input.actor.type,
      actorId: input.actor.id,
      action: 'member.block.noop',
      targetCollection: 'payload_members',
      targetId: before.id,
      severity: 'warning',
      before,
      after: before,
      metadata: {
        reason: input.reason,
        eventId: input.eventId ?? null,
      },
    })

    return {
      member: before,
      auditEvent,
      changed: false,
      emailEvents: [],
    }
  }

  const member = await payload.update({
    collection: 'payload_members',
    id: input.memberId,
    data: {
      accountStatus: 'blocked',
      billingHoldReason: input.reason,
    },
    overrideAccess: true,
  })

  await writeSecurityEvent(payload, input, 'account_blocked')

  const auditEvent = await createAuditEvent(payload, {
    actorType: input.actor.type,
    actorId: input.actor.id,
    action: 'member.blocked',
    targetCollection: 'payload_members',
    targetId: member.id,
    severity: 'critical',
    before,
    after: member,
    metadata: {
      reason: input.reason,
      eventId: input.eventId ?? null,
    },
  })

  const emailEvents = await queueAccountEmails(payload, input, member, 'blocked', auditEvent)

  return {
    member,
    auditEvent,
    changed: true,
    emailEvents,
  }
}

export async function restoreMember(
  payload: PayloadCourseWriteAPI,
  input: AccountStatusChangeInput
): Promise<AccountStatusChangeResult> {
  const before = await findMember(payload, input.memberId)

  if (before.accountStatus === 'active' && !before.billingHoldReason) {
    const auditEvent = await createAuditEvent(payload, {
      actorType: input.actor.type,
      actorId: input.actor.id,
      action: 'member.restore.noop',
      targetCollection: 'payload_members',
      targetId: before.id,
      severity: 'warning',
      before,
      after: before,
      metadata: {
        reason: input.reason,
        eventId: input.eventId ?? null,
      },
    })

    return {
      member: before,
      auditEvent,
      changed: false,
      emailEvents: [],
    }
  }

  const member = await payload.update({
    collection: 'payload_members',
    id: input.memberId,
    data: {
      accountStatus: 'active',
      billingHoldReason: null,
    },
    overrideAccess: true,
  })

  await writeSecurityEvent(payload, input, 'account_restored')

  const auditEvent = await createAuditEvent(payload, {
    actorType: input.actor.type,
    actorId: input.actor.id,
    action: 'member.restored',
    targetCollection: 'payload_members',
    targetId: member.id,
    before,
    after: member,
    metadata: {
      reason: input.reason,
      eventId: input.eventId ?? null,
    },
  })

  const emailEvents = await queueAccountEmails(payload, input, member, 'restored', auditEvent)

  return {
    member,
    auditEvent,
    changed: true,
    emailEvents,
  }
}
