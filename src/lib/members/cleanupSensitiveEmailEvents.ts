import type {
  PayloadCourseWriteAPI,
  PayloadDocument,
} from '@/lib/payloadCourse/accessService'

const SENSITIVE_TEMPLATES = ['member-invitation', 'member-password-reset'] as const
const DEFAULT_RETENTION_MS = 60 * 60 * 1000

export type CleanupSensitiveEmailEventsInput = {
  now?: Date
  retentionMs?: number
  limit?: number
}

export type CleanupSensitiveEmailEventsResult = {
  scanned: number
  redacted: number
  eventIds: string[]
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function safeMetadata(event: PayloadDocument, redactedAt: string): Record<string, unknown> {
  const metadata = asRecord(event.metadata)
  return {
    purpose: metadata.purpose,
    redactedAt,
    redactionReason: 'sensitive_link_retention_expired',
  }
}

export async function cleanupSensitiveEmailEvents(
  payload: PayloadCourseWriteAPI,
  input: CleanupSensitiveEmailEventsInput = {},
): Promise<CleanupSensitiveEmailEventsResult> {
  const now = input.now ?? new Date()
  const retentionMs = Math.max(60_000, input.retentionMs ?? DEFAULT_RETENTION_MS)
  const cutoff = new Date(now.getTime() - retentionMs).toISOString()

  const result = await payload.find({
    collection: 'payload_email_events',
    where: {
      and: [
        { templateKey: { in: [...SENSITIVE_TEMPLATES] } },
        { deliveryStatus: { in: ['queued', 'failed'] } },
        { createdAt: { less_than: cutoff } },
      ],
    },
    limit: input.limit ?? 100,
    depth: 0,
    overrideAccess: true,
  })

  const eventIds: string[] = []
  for (const event of result.docs) {
    await payload.update({
      collection: 'payload_email_events',
      id: event.id,
      data: {
        metadata: safeMetadata(event, now.toISOString()),
        failureReason:
          event.deliveryStatus === 'queued'
            ? 'Sensitive password link expired before delivery.'
            : event.failureReason,
      },
      overrideAccess: true,
    })
    eventIds.push(String(event.id))
  }

  return {
    scanned: result.docs.length,
    redacted: eventIds.length,
    eventIds,
  }
}
