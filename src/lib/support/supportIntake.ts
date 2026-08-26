import { createHash } from 'node:crypto'

export const SUPPORT_DEDUPE_WINDOW_MS = 30 * 60_000
export const SUPPORT_NOTIFICATION_RETRY_MS = 15 * 60_000
export const SUPPORT_DEDUPE_VERSION = 'support-v1'

export type SupportIntakeInput = {
  normalizedEmail: string
  name: string
  phone: string
  question: string
  source?: string
  page?: string
}

export type SupportRequestRecord = {
  id: string
}

export type SupportRequestCreateData = SupportIntakeInput & {
  dedupeKey: string
  reviewStatus: 'pending'
  notificationStatus: 'pending'
  notificationAttemptCount: 0
}

export type SupportRequestUpdateData = {
  notificationStatus: 'queued' | 'retry_pending'
  notificationAttemptCount: number
  notificationLastAttemptAt: Date
  notificationNextAttemptAt: Date | null
  notificationLastErrorCode: string | null
}

export type SupportIntakeDependencies = {
  createRequest(data: SupportRequestCreateData): Promise<SupportRequestRecord>
  updateRequest(id: string, data: SupportRequestUpdateData): Promise<void>
  queueNotification(input: {
    requestId: string
    dedupeKey: string
    reviewStatus: 'pending'
    requesterEmail: string
    requesterName: string
    requesterPhone: string
  }): Promise<void>
  now(): Date
  log(event: {
    event: 'support_intake'
    decision: 'accepted' | 'duplicate' | 'persistence_failed' | 'queue_failed'
    reason: string
  }): void
}

export type SupportIntakeResult =
  | { ok: true; accepted: true; duplicate: boolean; notification: 'queued' | 'retry_pending' | 'not_queued' }
  | { ok: false; code: 'support_persistence_unavailable'; retryable: true }

function normalizeText(value: string | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}

function windowBucket(now: Date): number {
  return Math.floor(now.getTime() / SUPPORT_DEDUPE_WINDOW_MS)
}

export function buildSupportDedupeKey(input: SupportIntakeInput, now: Date): string {
  const material = [
    SUPPORT_DEDUPE_VERSION,
    String(windowBucket(now)),
    input.normalizedEmail.trim().toLowerCase(),
    normalizeText(input.name),
    normalizeText(input.phone),
    normalizeText(input.question),
    normalizeText(input.source),
    normalizeText(input.page),
  ].join('\n')

  return createHash('sha256').update(material, 'utf8').digest('hex')
}

function isUniqueDedupeConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) return false
  if ((error as { code?: string }).code !== 'P2002') return false

  const target = (error as { meta?: { target?: unknown } }).meta?.target
  if (Array.isArray(target)) return target.includes('dedupe_key') || target.includes('dedupeKey')
  if (typeof target === 'string') return target.includes('dedupe_key') || target.includes('dedupeKey')
  return false
}

export function createSupportIntakeService(dependencies: SupportIntakeDependencies) {
  return async function acceptSupportIntake(input: SupportIntakeInput): Promise<SupportIntakeResult> {
    const now = dependencies.now()
    const dedupeKey = buildSupportDedupeKey(input, now)

    let request: SupportRequestRecord
    try {
      request = await dependencies.createRequest({
        ...input,
        dedupeKey,
        reviewStatus: 'pending',
        notificationStatus: 'pending',
        notificationAttemptCount: 0,
      })
    } catch (error) {
      if (isUniqueDedupeConflict(error)) {
        dependencies.log({
          event: 'support_intake',
          decision: 'duplicate',
          reason: 'dedupe_conflict',
        })
        return {
          ok: true,
          accepted: true,
          duplicate: true,
          notification: 'not_queued',
        }
      }

      dependencies.log({
        event: 'support_intake',
        decision: 'persistence_failed',
        reason: 'create_failed',
      })
      return {
        ok: false,
        code: 'support_persistence_unavailable',
        retryable: true,
      }
    }

    const queueDedupeKey = `support-request-notification:${request.id}`
    try {
      await dependencies.queueNotification({
        requestId: request.id,
        dedupeKey: queueDedupeKey,
        reviewStatus: 'pending',
        requesterEmail: input.normalizedEmail,
        requesterName: input.name,
        requesterPhone: input.phone,
      })
      await dependencies.updateRequest(request.id, {
        notificationStatus: 'queued',
        notificationAttemptCount: 1,
        notificationLastAttemptAt: now,
        notificationNextAttemptAt: null,
        notificationLastErrorCode: null,
      })
      dependencies.log({
        event: 'support_intake',
        decision: 'accepted',
        reason: 'persisted_and_queued',
      })
      return {
        ok: true,
        accepted: true,
        duplicate: false,
        notification: 'queued',
      }
    } catch {
      try {
        await dependencies.updateRequest(request.id, {
          notificationStatus: 'retry_pending',
          notificationAttemptCount: 1,
          notificationLastAttemptAt: now,
          notificationNextAttemptAt: new Date(now.getTime() + SUPPORT_NOTIFICATION_RETRY_MS),
          notificationLastErrorCode: 'support_notification_queue_failed',
        })
      } catch {
        // Persistence already succeeded. A later operations reconciliation can recover the pending record.
      }
      dependencies.log({
        event: 'support_intake',
        decision: 'queue_failed',
        reason: 'queue_unavailable',
      })
      return {
        ok: true,
        accepted: true,
        duplicate: false,
        notification: 'retry_pending',
      }
    }
  }
}
