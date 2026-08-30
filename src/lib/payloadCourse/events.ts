import { Resend } from 'resend'

import { attemptImmediateEmailDelivery } from '@/lib/payloadCourse/emailSender'
import type { PayloadEmailSenderConfig } from '@/lib/payloadCourse/emailSender'
import type {
  PayloadCourseWriteAPI,
  PayloadDocument,
  PayloadId,
} from '@/lib/payloadCourse/accessService'

type ActorType = 'admin' | 'member' | 'stripe' | 'system' | 'migration'
type AuditSeverity = 'info' | 'warning' | 'critical'

type AuditEventInput = {
  actorType: ActorType
  actorId?: PayloadId | null
  action: string
  targetCollection: string
  targetId?: PayloadId | null
  severity?: AuditSeverity
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
  ipAddress?: string | null
  userAgent?: string | null
}

type EmailEventInput = {
  toEmail: string
  templateKey: string
  dedupeKey: string
  displayName?: string
  contact?: PayloadId | null
  metadata?: Record<string, unknown> | null
}

type EntitlementEventInput = {
  member?: PayloadId | null
  eventType: 'access_evaluated' | 'access_granted' | 'access_revoked' | 'billing_hold_applied' | 'billing_hold_cleared'
  resourceType: 'course' | 'lesson' | 'space' | 'access_group'
  resourceId: PayloadId
  result: 'allowed' | 'denied' | 'changed'
  reason?: string | null
  metadata?: Record<string, unknown> | null
}

async function findOne(
  payload: PayloadCourseWriteAPI,
  collection: string,
  where: Record<string, unknown>
): Promise<PayloadDocument | null> {
  const result = await payload.find({
    collection,
    where,
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  return result.docs[0] ?? null
}

export async function createAuditEvent(
  payload: PayloadCourseWriteAPI,
  input: AuditEventInput
): Promise<PayloadDocument> {
  return payload.create({
    collection: 'payload_audit_events',
    data: {
      displayName: `${input.action} ${input.targetCollection}:${input.targetId ?? 'none'}`,
      actorType: input.actorType,
      actorId: input.actorId ? String(input.actorId) : undefined,
      action: input.action,
      targetCollection: input.targetCollection,
      targetId: input.targetId ? String(input.targetId) : undefined,
      severity: input.severity ?? 'info',
      ipAddress: input.ipAddress ?? undefined,
      userAgent: input.userAgent ?? undefined,
      before: input.before ?? undefined,
      after: input.after ?? undefined,
      metadata: input.metadata ?? undefined,
    },
    overrideAccess: true,
  })
}

export async function queueEmailEvent(
  payload: PayloadCourseWriteAPI,
  input: EmailEventInput
): Promise<{ event: PayloadDocument; created: boolean }> {
  const existing = await findOne(payload, 'payload_email_events', {
    dedupeKey: { equals: input.dedupeKey },
  })

  if (existing) return { event: existing, created: false }

  try {
    const event = await payload.create({
      collection: 'payload_email_events',
      data: {
        displayName: input.displayName ?? `${input.templateKey} -> ${input.toEmail}`,
        toEmail: input.toEmail,
        contact: input.contact ?? undefined,
        templateKey: input.templateKey,
        deliveryStatus: 'queued',
        dedupeKey: input.dedupeKey,
        metadata: input.metadata ?? undefined,
      },
      overrideAccess: true,
    })

    return { event, created: true }
  } catch (error) {
    // The unique dedupe key is the concurrency boundary. If another worker
    // won the insert between the initial read and create, use that event and
    // let only the winner attempt immediate delivery.
    const raced = await findOne(payload, 'payload_email_events', {
      dedupeKey: { equals: input.dedupeKey },
    })
    if (raced) return { event: raced, created: false }
    throw error
  }
}

export async function queueAndAttemptEmailEvent(
  payload: PayloadCourseWriteAPI,
  input: EmailEventInput
): Promise<{ event: PayloadDocument; created: boolean }> {
  const result = await queueEmailEvent(payload, input)

  if (result.created) {
    const resendApiKey = process.env.RESEND_API_KEY
    const resend = resendApiKey ? new Resend(resendApiKey) : undefined
    const emailConfig: PayloadEmailSenderConfig = {
      from: process.env.RESEND_FROM ?? process.env.EMAIL_FROM ?? '',
      replyTo: process.env.EMAIL_REPLY_TO ?? null,
    }
    attemptImmediateEmailDelivery(payload, result.event.id, { resend, emailConfig })
  }

  return result
}

export async function createEntitlementEvent(
  payload: PayloadCourseWriteAPI,
  input: EntitlementEventInput
): Promise<PayloadDocument> {
  return payload.create({
    collection: 'payload_entitlement_events',
    data: {
      displayName: `${input.eventType} ${input.resourceType}:${input.resourceId}`,
      member: input.member ?? undefined,
      eventType: input.eventType,
      resourceType: input.resourceType,
      resourceId: String(input.resourceId),
      result: input.result,
      reason: input.reason ?? undefined,
      metadata: input.metadata ?? undefined,
    },
    overrideAccess: true,
  })
}
