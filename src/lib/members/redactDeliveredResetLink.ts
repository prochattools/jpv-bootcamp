import type {
  PayloadCourseWriteAPI,
  PayloadDocument,
  PayloadId,
} from '@/lib/payloadCourse/accessService'

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function isSensitivePasswordTemplate(templateKey: unknown): boolean {
  return (
    templateKey === 'member-invitation' ||
    templateKey === 'member-password-reset' ||
    templateKey === 'member-email-verification'
  )
}

export async function redactDeliveredResetLink(
  payload: PayloadCourseWriteAPI,
  event: PayloadDocument,
  delivery: {
    sentAt: Date
    idempotencyKey: string
    provider: string
  },
): Promise<PayloadDocument> {
  const metadata = asRecord(event.metadata)
  const safeMetadata: Record<string, unknown> = {
    purpose: metadata.purpose,
    deliveredAt: delivery.sentAt.toISOString(),
    deliveryProvider: delivery.provider,
    deliveryIdempotencyKey: delivery.idempotencyKey,
  }

  if (!isSensitivePasswordTemplate(event.templateKey)) {
    return payload.update({
      collection: 'payload_email_events',
      id: event.id as PayloadId,
      data: {
        metadata: {
          ...metadata,
          lastSend: {
            idempotencyKey: delivery.idempotencyKey,
            provider: delivery.provider,
            sentAt: delivery.sentAt.toISOString(),
          },
        },
      },
      overrideAccess: true,
    })
  }

  return payload.update({
    collection: 'payload_email_events',
    id: event.id as PayloadId,
    data: {
      metadata: safeMetadata,
    },
    overrideAccess: true,
  })
}
