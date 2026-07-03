import type { PayloadCourseWriteAPI, PayloadDocument, PayloadId } from '@/lib/payloadCourse/accessService'
import { createAuditEvent } from '@/lib/payloadCourse/events'

export type PartnerDeliveryTransition = 'submitted' | 'delivery_pending' | 'delivered' | 'delivery_failed'

type PartnerApplicationRecord = PayloadDocument & {
  status?: unknown
  deliveryMethod?: unknown
  deliveryAttempts?: unknown
  lastDeliveryError?: unknown
  partner?: unknown
  member?: unknown
  trustedDestinationSnapshot?: unknown
}

function asString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number') return String(value)
  return null
}

function asStatus(value: unknown): PartnerDeliveryTransition {
  return value === 'delivery_pending' || value === 'delivered' || value === 'delivery_failed'
    ? value
    : 'submitted'
}

function sanitizeError(value: unknown): string {
  const text = asString(value) ?? 'delivery_failed'
  return text.slice(0, 200)
}

export async function recordPartnerEvent(
  payload: PayloadCourseWriteAPI,
  input: {
    partnerId?: PayloadId | null
    applicationId?: PayloadId | null
    memberId?: PayloadId | null
    eventType: string
    sourceRoute?: string | null
    status?: string | null
    deliveryMethod?: string | null
    attempt?: number | null
    deliveryError?: string | null
    metadata?: Record<string, unknown> | null
  }
): Promise<PayloadDocument> {
  return payload.create({
    collection: 'payload_partner_events',
    data: {
      displayName: `${input.eventType} ${String(input.applicationId ?? input.partnerId ?? 'none')}`,
      partner: input.partnerId ? String(input.partnerId) : undefined,
      application: input.applicationId ? String(input.applicationId) : undefined,
      member: input.memberId ? String(input.memberId) : undefined,
      eventType: input.eventType,
      sourceRoute: input.sourceRoute ?? undefined,
      status: input.status ?? undefined,
      deliveryMethod: input.deliveryMethod ?? undefined,
      attempt: input.attempt ?? undefined,
      deliveryError: input.deliveryError ?? undefined,
      metadata: input.metadata ?? undefined,
    },
    overrideAccess: true,
  })
}

export async function transitionPartnerApplicationDelivery(
  payload: PayloadCourseWriteAPI,
  applicationId: PayloadId,
  targetStatus: PartnerDeliveryTransition,
  params: {
    error?: unknown
    actorType: 'admin' | 'system'
    actorId?: PayloadId | null
  }
): Promise<PayloadDocument> {
  const application = (await payload.findByID({
    collection: 'payload_partner_applications',
    id: applicationId,
    overrideAccess: true,
  })) as PartnerApplicationRecord

  const currentStatus = asStatus(application.status)
  if (currentStatus === 'delivered' && targetStatus !== 'delivered') {
    throw new Error('partner_application_already_delivered')
  }

  const deliveryAttempts = typeof application.deliveryAttempts === 'number' ? application.deliveryAttempts : 0
  const nextAttempts = targetStatus === 'delivery_pending' ? deliveryAttempts + 1 : deliveryAttempts
  const sanitizedError = targetStatus === 'delivery_failed' ? sanitizeError(params.error) : null

  const updated = await payload.update({
    collection: 'payload_partner_applications',
    id: applicationId,
    data: {
      status: targetStatus,
      deliveryAttempts: nextAttempts,
      lastDeliveryError: sanitizedError,
      deliveredAt: targetStatus === 'delivered' ? new Date().toISOString() : application.deliveredAt,
    },
    overrideAccess: true,
  })

  await createAuditEvent(payload, {
    actorType: params.actorType,
    actorId: params.actorId ?? null,
    action: `partner_application_${targetStatus}`,
    targetCollection: 'payload_partner_applications',
    targetId: applicationId,
    before: { status: currentStatus, deliveryAttempts },
    after: { status: targetStatus, deliveryAttempts: nextAttempts },
    metadata: {
      deliveryError: sanitizedError ?? undefined,
      deliveryMethod: asString(application.deliveryMethod),
    },
  })

  await recordPartnerEvent(payload, {
    partnerId: application.partner as PayloadId | null,
    applicationId,
    memberId: application.member as PayloadId | null,
    eventType: `partner_application_${targetStatus}`,
    status: targetStatus,
    deliveryMethod: asString(application.deliveryMethod),
    attempt: nextAttempts,
    deliveryError: sanitizedError,
  })

  return updated
}

export async function retryPartnerDelivery(
  payload: PayloadCourseWriteAPI,
  applicationId: PayloadId,
  actorId?: PayloadId | null
): Promise<PayloadDocument> {
  const application = (await payload.findByID({
    collection: 'payload_partner_applications',
    id: applicationId,
    overrideAccess: true,
  })) as PartnerApplicationRecord

  const status = asStatus(application.status)
  if (status === 'delivered') {
    throw new Error('partner_application_already_delivered')
  }

  const nextStatus = status === 'delivery_failed' ? 'delivery_pending' : 'delivery_pending'
  return transitionPartnerApplicationDelivery(payload, applicationId, nextStatus, {
    actorType: 'admin',
    actorId,
  })
}
