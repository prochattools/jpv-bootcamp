import type {
  PayloadCourseWriteAPI,
  PayloadDocument,
  PayloadId,
} from '@/lib/payloadCourse/accessService'
import { createLocalReq } from 'payload'

type PayloadDbWriteAdapter = {
  updateOne(args: {
    collection: string
    id: PayloadId
    data: Record<string, unknown>
    returning?: boolean
    req?: unknown
  }): Promise<PayloadDocument>
}

async function createWriteReq(payload: PayloadCourseWriteAPI) {
  try {
    return await createLocalReq({ req: {} }, payload as never)
  } catch {
    return undefined
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function isSensitivePasswordTemplate(templateKey: unknown): boolean {
  return (
    templateKey === 'member-invitation' ||
    templateKey === 'member-password-reset' ||
    templateKey === 'member-email-verification' ||
    templateKey === 'member-email-change-confirmation'
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

  const db = (payload as PayloadCourseWriteAPI & { db?: PayloadDbWriteAdapter }).db
  if (db?.updateOne) {
    const req = await createWriteReq(payload)
    if (!isSensitivePasswordTemplate(event.templateKey)) {
      return db.updateOne({
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
          updatedAt: delivery.sentAt.toISOString(),
        },
        returning: true,
        req,
      })
    }

    return db.updateOne({
      collection: 'payload_email_events',
      id: event.id as PayloadId,
      data: {
        metadata: safeMetadata,
        updatedAt: delivery.sentAt.toISOString(),
      },
      returning: true,
      req,
    })
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
      overrideLock: true,
    })
  }

  return payload.update({
    collection: 'payload_email_events',
    id: event.id as PayloadId,
    data: {
      metadata: safeMetadata,
    },
    overrideAccess: true,
    overrideLock: true,
  })
}
