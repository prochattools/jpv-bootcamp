import type {
  PayloadCourseWriteAPI,
  PayloadDocument,
  PayloadId,
} from '@/lib/payloadCourse/accessService'
import { queueAndAttemptEmailEvent } from '@/lib/payloadCourse/events'

export type CommunityModerationRecordKind = 'post' | 'comment' | 'file'
export type CommunityModerationOutcome = 'visible' | 'hidden'

type PendingNotificationInput = {
  kind: CommunityModerationRecordKind
  recordId: PayloadId
  spaceId: PayloadId
}

type OutcomeNotificationInput = {
  kind: CommunityModerationRecordKind
  recordId: PayloadId
  spaceId: PayloadId
  authorId: PayloadId
  outcome: CommunityModerationOutcome
}

type QueuedNotificationSummary = {
  queued: number
  skipped: number
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized ? normalized : null
}

function normalizeEmail(value: unknown): string | null {
  const email = asString(value)?.toLowerCase()
  if (!email || email.length > 320) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  return email
}

function configuredModerationRecipients(): string[] {
  const configured = process.env.COMMUNITY_MODERATION_NOTIFICATION_EMAILS
  if (!configured) return []

  return configured
    .split(/[;,\n]/)
    .map(normalizeEmail)
    .filter((email): email is string => Boolean(email))
}

async function findAll(
  payload: PayloadCourseWriteAPI,
  collection: string,
  where?: Record<string, unknown>
): Promise<PayloadDocument[]> {
  const result = await payload.find({
    collection,
    where,
    limit: 500,
    depth: 0,
    overrideAccess: true,
  })
  return result.docs
}

async function findByIdSafe(
  payload: PayloadCourseWriteAPI,
  collection: string,
  id: PayloadId
): Promise<PayloadDocument | null> {
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

export async function resolveCommunityModerationRecipients(
  payload: PayloadCourseWriteAPI
): Promise<string[]> {
  const recipients = new Set(configuredModerationRecipients())

  try {
    const administrators = await findAll(payload, 'payload_users')
    for (const administrator of administrators) {
      const email = normalizeEmail(administrator.email)
      if (email) recipients.add(email)
    }
  } catch {
    // Trusted server configuration remains a valid fallback when administrator
    // lookup is temporarily unavailable.
  }

  return [...recipients].sort()
}

export async function queuePendingCommunityModerationNotifications(
  payload: PayloadCourseWriteAPI,
  input: PendingNotificationInput
): Promise<QueuedNotificationSummary> {
  try {
    const recipients = await resolveCommunityModerationRecipients(payload)
    let queued = 0
    let skipped = 0

    for (const recipient of recipients) {
      const result = await queueAndAttemptEmailEvent(payload, {
        toEmail: recipient,
        templateKey: 'admin-notification',
        dedupeKey: `community-moderation:pending:${input.kind}:${String(input.recordId)}:${recipient}`,
        metadata: {
          action: 'community-moderation-pending',
          recordKind: input.kind,
          recordId: String(input.recordId),
          spaceId: String(input.spaceId),
        },
      })
      if (result.created) queued += 1
      else skipped += 1
    }

    return { queued, skipped }
  } catch {
    return { queued: 0, skipped: 0 }
  }
}

export async function queueCommunityModerationOutcomeNotification(
  payload: PayloadCourseWriteAPI,
  input: OutcomeNotificationInput
): Promise<QueuedNotificationSummary> {
  try {
    const author = await findByIdSafe(payload, 'payload_members', input.authorId)
    const recipient = normalizeEmail(author?.email)
    if (!recipient) return { queued: 0, skipped: 1 }

    const result = await queueAndAttemptEmailEvent(payload, {
      toEmail: recipient,
      contact: author?.id ?? null,
      templateKey: 'community-moderation-outcome',
      dedupeKey: `community-moderation:outcome:${input.kind}:${String(input.recordId)}:${input.outcome}`,
      metadata: {
        action: 'community-moderation-outcome',
        recordKind: input.kind,
        recordId: String(input.recordId),
        spaceId: String(input.spaceId),
        outcome: input.outcome,
      },
    })

    return result.created
      ? { queued: 1, skipped: 0 }
      : { queued: 0, skipped: 1 }
  } catch {
    return { queued: 0, skipped: 0 }
  }
}
