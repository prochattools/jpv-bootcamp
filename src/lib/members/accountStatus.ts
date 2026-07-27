import type {
  PayloadCourseWriteAPI,
  PayloadDocument,
  PayloadId,
} from '@/lib/payloadCourse/accessService'
import { createAuditEvent, queueAndAttemptEmailEvent } from '@/lib/payloadCourse/events'
import { resolveJpvLogoUrl } from '@/lib/brand/jpvDesignSystem'

type ActorInput = {
  type: 'admin' | 'system' | 'stripe' | 'migration'
  id?: PayloadId | null
}

export type AccountStatusChangeInput = {
  memberId: PayloadId
  actor: ActorInput
  reason: string
  eventId?: string | null
  adminEmail?: string | null
  baseUrl?: string | null
}

export type AccountStatusChangeResult = {
  member: PayloadDocument
  auditEvent: PayloadDocument
  changed: boolean
  emailEvents: PayloadDocument[]
}

type AccountAction = 'blocked' | 'suspended' | 'restored' | 'deleted'
type AccountStatus = 'blocked' | 'suspended' | 'active' | 'deleted'
type SecurityEvent = 'account_blocked' | 'account_suspended' | 'account_restored' | 'account_deleted'

const actionConfig: Record<AccountAction, {
  targetStatus: AccountStatus
  securityEvent: SecurityEvent
  auditAction: string
  noopAction: string
  severity: 'info' | 'warning' | 'critical'
}> = {
  blocked: {
    targetStatus: 'blocked',
    securityEvent: 'account_blocked',
    auditAction: 'member.blocked',
    noopAction: 'member.block.noop',
    severity: 'critical',
  },
  suspended: {
    targetStatus: 'suspended',
    securityEvent: 'account_suspended',
    auditAction: 'member.suspended',
    noopAction: 'member.suspend.noop',
    severity: 'warning',
  },
  restored: {
    targetStatus: 'active',
    securityEvent: 'account_restored',
    auditAction: 'member.restored',
    noopAction: 'member.restore.noop',
    severity: 'info',
  },
  deleted: {
    targetStatus: 'deleted',
    securityEvent: 'account_deleted',
    auditAction: 'member.deleted',
    noopAction: 'member.delete.noop',
    severity: 'critical',
  },
}

async function findMember(payload: PayloadCourseWriteAPI, memberId: PayloadId) {
  return payload.findByID({
    collection: 'payload_members',
    id: memberId,
    depth: 0,
    overrideAccess: true,
  })
}

function getEmail(member: PayloadDocument): string | null {
  return typeof member.email === 'string' ? member.email : null
}

function displayName(member: PayloadDocument): string {
  const email = getEmail(member)
  return email?.split('@')[0] || 'there'
}

function logoUrl(baseUrl: string | null | undefined): string | undefined {
  if (!baseUrl) return undefined
  try {
    return resolveJpvLogoUrl(baseUrl)
  } catch {
    return undefined
  }
}

async function writeSecurityEvent(
  payload: PayloadCourseWriteAPI,
  input: AccountStatusChangeInput,
  eventType: SecurityEvent,
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
        automaticLogin: false,
      },
    },
    overrideAccess: true,
  })
}

async function queueAccountEmails(
  payload: PayloadCourseWriteAPI,
  input: AccountStatusChangeInput,
  member: PayloadDocument,
  action: AccountAction,
  auditEvent: PayloadDocument,
): Promise<PayloadDocument[]> {
  const emailEvents: PayloadDocument[] = []
  const email = getEmail(member)
  const sourceEventId = input.eventId ?? String(auditEvent.id)
  const logo = logoUrl(input.baseUrl)

  if (email) {
    try {
      const { event } = await queueAndAttemptEmailEvent(payload, {
        toEmail: email,
        templateKey: `access-${action}`,
        dedupeKey: `access-${action}:${member.id}:${sourceEventId}`,
        metadata: {
          memberId: String(member.id),
          purpose: `account_${action}_notice`,
          displayName: displayName(member),
          auditEventId: String(auditEvent.id),
          ...(logo ? { logoUrl: logo } : {}),
        },
      })
      emailEvents.push(event)
    } catch {
      // Account status changes remain authoritative even when notification queueing fails.
    }
  }

  if (input.adminEmail) {
    try {
      const { event } = await queueAndAttemptEmailEvent(payload, {
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
    } catch {
      // Administrator notification failure does not roll back the status change.
    }
  }

  return emailEvents
}

async function changeAccountStatus(
  payload: PayloadCourseWriteAPI,
  input: AccountStatusChangeInput,
  action: AccountAction,
): Promise<AccountStatusChangeResult> {
  const config = actionConfig[action]
  const before = await findMember(payload, input.memberId)
  const alreadyTarget = before.accountStatus === config.targetStatus
  const restoredWithoutHold = action === 'restored' && !before.billingHoldReason

  if (alreadyTarget && (action !== 'restored' || restoredWithoutHold)) {
    const auditEvent = await createAuditEvent(payload, {
      actorType: input.actor.type,
      actorId: input.actor.id,
      action: config.noopAction,
      targetCollection: 'payload_members',
      targetId: before.id,
      severity: 'warning',
      before,
      after: before,
      metadata: { reason: input.reason, eventId: input.eventId ?? null },
    })
    return { member: before, auditEvent, changed: false, emailEvents: [] }
  }

  const member = await payload.update({
    collection: 'payload_members',
    id: input.memberId,
    data: {
      accountStatus: config.targetStatus,
      billingHoldReason:
        action === 'blocked' || action === 'suspended' ? input.reason : null,
    },
    overrideAccess: true,
  })

  const securityEvent = await writeSecurityEvent(payload, input, config.securityEvent)
  const auditEvent = await createAuditEvent(payload, {
    actorType: input.actor.type,
    actorId: input.actor.id,
    action: config.auditAction,
    targetCollection: 'payload_members',
    targetId: member.id,
    severity: config.severity,
    before,
    after: member,
    metadata: {
      reason: input.reason,
      eventId: input.eventId ?? null,
      securityEventId: String(securityEvent.id),
      automaticLogin: false,
    },
  })

  const emailEvents = await queueAccountEmails(payload, input, member, action, auditEvent)
  return { member, auditEvent, changed: true, emailEvents }
}

export function blockMember(
  payload: PayloadCourseWriteAPI,
  input: AccountStatusChangeInput,
): Promise<AccountStatusChangeResult> {
  return changeAccountStatus(payload, input, 'blocked')
}

export function suspendMember(
  payload: PayloadCourseWriteAPI,
  input: AccountStatusChangeInput,
): Promise<AccountStatusChangeResult> {
  return changeAccountStatus(payload, input, 'suspended')
}

export function restoreMember(
  payload: PayloadCourseWriteAPI,
  input: AccountStatusChangeInput,
): Promise<AccountStatusChangeResult> {
  return changeAccountStatus(payload, input, 'restored')
}

export function deleteMember(
  payload: PayloadCourseWriteAPI,
  input: AccountStatusChangeInput,
): Promise<AccountStatusChangeResult> {
  return changeAccountStatus(payload, input, 'deleted')
}
