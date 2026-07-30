import { createHash, randomBytes } from 'node:crypto'

import { normalizeEmail } from '@/lib/normalize-email'
import { getPublicBaseUrl } from '@/lib/public-base-url'
import { assertStagingRecipientAllowed, StagingEmailGuardViolation } from '@/lib/staging-email-guard'
import { getSystemEmailTemplate } from '@/lib/payloadCourse/systemEmailTemplates'
import { redactDeliveredResetLink } from '@/lib/members/redactDeliveredResetLink'
import type {
  PayloadCourseWriteAPI,
  PayloadDocument,
  PayloadId,
} from '@/lib/payloadCourse/accessService'

// Stale lease threshold: rows in 'processing' longer than this are reclaimed.
const STALE_LEASE_MS = 5 * 60 * 1000

type SendEmailPayload = {
  from: string
  to: string[]
  replyTo?: string
  subject: string
  text: string
  html?: string
}

type SendEmailResponse = {
  data?: { id?: string } | null
  error?: unknown
}

export type PayloadEmailSenderClient = {
  emails: {
    send(
      payload: SendEmailPayload,
      options?: { idempotencyKey?: string }
    ): Promise<SendEmailResponse>
  }
}

export type PayloadEmailSenderConfig = {
  from: string
  replyTo?: string | null
}

export type SendQueuedPayloadEmailResult = {
  eventId: string
  templateKey: string | null
  toEmail: string | null
  status: 'sent' | 'failed' | 'skipped' | 'dry_run'
  reason?: string
  resendEmailId?: string | null
  idempotencyKey?: string | null
}

type ProcessQueuedPayloadEmailsArgs = {
  limit?: number
  dryRun?: boolean
  resend?: PayloadEmailSenderClient
  emailConfig: PayloadEmailSenderConfig
  targetEventId?: string | null
}

function asString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value
  if (typeof value === 'number') return String(value)
  return null
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function validEmail(value: string | null): value is string {
  if (!value) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      case "'":
        return '&#39;'
      default:
        return char
    }
  })
}

function stringifyTemplateValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function flattenRecord(
  value: Record<string, unknown>,
  prefix = '',
  output: Record<string, string> = {}
) {
  for (const [key, entry] of Object.entries(value)) {
    const nextKey = prefix ? `${prefix}.${key}` : key
    if (entry && typeof entry === 'object' && !Array.isArray(entry) && !(entry instanceof Date)) {
      flattenRecord(entry as Record<string, unknown>, nextKey, output)
      continue
    }
    output[nextKey] = stringifyTemplateValue(entry)
  }
  return output
}

function templateData(event: PayloadDocument): Record<string, string> {
  const baseUrl = getPublicBaseUrl().replace(/\/$/, '')

  return {
    portalUrl: `${baseUrl}/portal`,
    billingUrl: `${baseUrl}/portal/billing`,
    supportUrl: `${baseUrl}/#support`,
    ...flattenRecord(asRecord(event.metadata)),
    eventId: String(event.id),
    toEmail: asString(event.toEmail) ?? '',
    templateKey: asString(event.templateKey) ?? '',
    dedupeKey: asString(event.dedupeKey) ?? '',
  }
}

function renderTemplate(
  body: string,
  data: Record<string, string>,
  options?: { html?: boolean }
): string {
  return body.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, key: string) => {
    const value = data[key] ?? ''
    return options?.html ? escapeHtml(value) : value
  })
}

function truncateIdempotencyKey(key: string): string {
  if (key.length <= 256) return key
  const hash = createHash('sha256').update(key).digest('hex')
  return `${key.slice(0, 191)}:${hash}`
}

function errorMessage(error: unknown): string {
  if (!error) return 'unknown_error'
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string') return message
  }
  return JSON.stringify(error)
}

function isResendIdempotencyReplay(reason: string): boolean {
  return (
    reason.includes('idempotency key has been used') &&
    reason.includes("request body was modified")
  )
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

async function updateEmailEvent(
  payload: PayloadCourseWriteAPI,
  event: PayloadDocument,
  data: Record<string, unknown>
): Promise<PayloadDocument> {
  return payload.update({
    collection: 'payload_email_events',
    id: event.id,
    data,
    overrideAccess: true,
    overrideLock: true,
  })
}

async function findActiveTemplate(
  payload: PayloadCourseWriteAPI,
  templateKey: string
): Promise<PayloadDocument | null> {
  const storedTemplate = await findOne(payload, 'payload_email_templates', {
    and: [
      { templateKey: { equals: templateKey } },
      { status: { equals: 'active' } },
    ],
  })

  return storedTemplate ?? getSystemEmailTemplate(templateKey)
}

function buildSendPayload(
  event: PayloadDocument,
  template: PayloadDocument,
  config: PayloadEmailSenderConfig
): SendEmailPayload {
  const toEmail = normalizeEmail(asString(event.toEmail))
  if (!validEmail(toEmail)) {
    throw new Error('invalid_recipient_email')
  }

  const subject = asString(template.subject)
  const textBody = asString(template.textBody)
  if (!subject || !textBody) {
    throw new Error('active_template_missing_required_fields')
  }

  const data = templateData(event)
  const htmlBody = asString(template.htmlBody)

  return {
    from: config.from,
    to: [toEmail],
    replyTo: config.replyTo ?? undefined,
    subject: renderTemplate(subject, data),
    text: renderTemplate(textBody, data),
    html: htmlBody ? renderTemplate(htmlBody, data, { html: true }) : undefined,
  }
}

// ─── Atomic claim / lease ─────────────────────────────────────────────────────

function generateClaimId(): string {
  return randomBytes(16).toString('hex')
}

// Attempt to claim a queued event for exclusive delivery.
// Returns the claim token if successful, null if another worker won the race
// (the event is no longer queued after our update returns a different claimId).
async function claimEventForDelivery(
  payload: PayloadCourseWriteAPI,
  eventId: PayloadId,
  claimId: string,
  now: Date,
): Promise<boolean> {
  // Update with overrideAccess + overrideLock — Payload does not support
  // WHERE-guarded updates on its own update API, so we use an optimistic
  // read-then-write: we read status = queued above, set our claimId, then
  // re-read to verify we own it. The window between is small; for correctness
  // we check the workerClaimId after writing.
  await payload.update({
    collection: 'payload_email_events',
    id: eventId,
    data: {
      deliveryStatus: 'processing',
      claimedAt: now.toISOString(),
      workerClaimId: claimId,
    },
    overrideAccess: true,
    overrideLock: true,
  })
  // Re-read and verify we own the lease.
  const after = await payload.findByID({
    collection: 'payload_email_events',
    id: eventId,
    depth: 0,
    overrideAccess: true,
  })
  return asString(after.workerClaimId) === claimId
}

// Release a claim back to 'queued' after a non-fatal failure.
async function releaseEventClaim(
  payload: PayloadCourseWriteAPI,
  event: PayloadDocument,
  failureReason: string,
): Promise<void> {
  await updateEmailEvent(payload, event, {
    deliveryStatus: 'queued',
    claimedAt: null,
    workerClaimId: null,
    failureReason,
  })
}

// Recover stale leases: find events stuck in 'processing' longer than
// STALE_LEASE_MS and requeue them so the next worker run picks them up.
export async function recoverStaleEmailLeases(
  payload: PayloadCourseWriteAPI,
  now = new Date(),
): Promise<number> {
  const cutoff = new Date(now.getTime() - STALE_LEASE_MS).toISOString()
  const stale = await payload.find({
    collection: 'payload_email_events',
    where: {
      and: [
        { deliveryStatus: { equals: 'processing' } },
        { claimedAt: { less_than: cutoff } },
      ],
    },
    limit: 50,
    depth: 0,
    overrideAccess: true,
  })
  let recovered = 0
  for (const event of stale.docs) {
    await updateEmailEvent(payload, event, {
      deliveryStatus: 'queued',
      claimedAt: null,
      workerClaimId: null,
      failureReason: 'stale_lease_recovered',
    })
    recovered++
  }
  return recovered
}

export async function sendQueuedPayloadEmail(
  payload: PayloadCourseWriteAPI,
  eventId: PayloadId,
  args: ProcessQueuedPayloadEmailsArgs
): Promise<SendQueuedPayloadEmailResult> {
  const event = await payload.findByID({
    collection: 'payload_email_events',
    id: eventId,
    depth: 0,
    overrideAccess: true,
  })
  const templateKey = asString(event.templateKey)
  const toEmail = normalizeEmail(asString(event.toEmail))

  if (event.deliveryStatus === 'sent' && event.resendEmailId) {
    return {
      eventId: String(event.id),
      templateKey,
      toEmail,
      status: 'skipped',
      reason: 'already_sent',
      resendEmailId: asString(event.resendEmailId),
    }
  }

  if (event.deliveryStatus !== 'queued') {
    return {
      eventId: String(event.id),
      templateKey,
      toEmail,
      status: 'skipped',
      reason: `not_queued:${event.deliveryStatus ?? 'unknown'}`,
    }
  }

  // Atomic claim: mark as processing with a unique claim token.
  // If another worker claimed it first, skip without error.
  if (!args.dryRun) {
    const claimId = generateClaimId()
    const claimed = await claimEventForDelivery(payload, event.id, claimId, new Date())
    if (!claimed) {
      return {
        eventId: String(event.id),
        templateKey,
        toEmail,
        status: 'skipped',
        reason: 'claimed_by_other_worker',
      }
    }
    // Refresh event after claim (deliveryStatus is now 'processing')
    Object.assign(event, { deliveryStatus: 'processing', workerClaimId: claimId })

    // Guard: no resend client means we cannot deliver. Release claim immediately so the
    // event stays available for retry once the client is configured.
    if (!args.resend) {
      await releaseEventClaim(payload, event, 'resend_client_missing')
      return {
        eventId: String(event.id),
        templateKey,
        toEmail,
        status: 'failed',
        reason: 'resend_client_missing',
      }
    }
  }

  if (!templateKey) {
    if (!args.dryRun) {
      await updateEmailEvent(payload, event, {
        deliveryStatus: 'failed',
        failureReason: 'missing_template_key',
      })
    }
    return {
      eventId: String(event.id),
      templateKey: null,
      toEmail,
      status: args.dryRun ? 'dry_run' : 'failed',
      reason: 'missing_template_key',
    }
  }

  const template = await findActiveTemplate(payload, templateKey)
  if (!template) {
    if (!args.dryRun) {
      await updateEmailEvent(payload, event, {
        deliveryStatus: 'failed',
        failureReason: 'active_template_missing',
      })
    }
    return {
      eventId: String(event.id),
      templateKey,
      toEmail,
      status: args.dryRun ? 'dry_run' : 'failed',
      reason: 'active_template_missing',
    }
  }

  let sendPayload: SendEmailPayload
  try {
    sendPayload = buildSendPayload(event, template, args.emailConfig)
  } catch (error) {
    const reason = errorMessage(error)
    if (!args.dryRun) {
      await updateEmailEvent(payload, event, {
        deliveryStatus: 'failed',
        failureReason: reason,
      })
    }
    return {
      eventId: String(event.id),
      templateKey,
      toEmail,
      status: args.dryRun ? 'dry_run' : 'failed',
      reason,
    }
  }

  const idempotencyKey = truncateIdempotencyKey(
    asString(event.dedupeKey) ?? `payload-email-event:${event.id}`
  )

  if (args.dryRun) {
    return {
      eventId: String(event.id),
      templateKey,
      toEmail,
      status: 'dry_run',
      reason: 'dry_run',
      idempotencyKey,
    }
  }

  try {
    assertStagingRecipientAllowed(sendPayload.to, 'payloadCourse/emailSender:sendQueuedPayloadEmail')
  } catch (error) {
    if (!(error instanceof StagingEmailGuardViolation)) throw error
    await updateEmailEvent(payload, event, {
      deliveryStatus: 'blocked_by_staging_guard',
      claimedAt: null,
      workerClaimId: null,
      failureReason: 'blocked_by_staging_guard',
    })
    return { eventId: String(event.id), templateKey, toEmail, status: 'skipped', reason: 'blocked_by_staging_guard', idempotencyKey }
  }

  let sendResult: SendEmailResponse
  try {
    sendResult = await args.resend.emails.send(sendPayload, { idempotencyKey })
  } catch (error) {
    // Provider network error — release claim so retry worker can pick it up.
    const reason = errorMessage(error)
    await releaseEventClaim(payload, event, reason)
    return {
      eventId: String(event.id),
      templateKey,
      toEmail,
      status: 'failed',
      reason,
      idempotencyKey,
    }
  }

  const { data, error } = sendResult
  if (error) {
    const reason = errorMessage(error)
    if (isResendIdempotencyReplay(reason)) {
      const sentAt = new Date()
      await updateEmailEvent(payload, event, {
        deliveryStatus: 'sent',
        claimedAt: null,
        workerClaimId: null,
        sentAt,
        failureReason: null,
      })
      await redactDeliveredResetLink(payload, event, {
        sentAt,
        idempotencyKey,
        provider: 'resend',
      })
      return {
        eventId: String(event.id),
        templateKey,
        toEmail,
        status: 'sent',
        reason: 'idempotency_replay',
        resendEmailId: null,
        idempotencyKey,
      }
    }
    // Permanent provider-reported failure — mark failed (admin can retry via EmailAction).
    await updateEmailEvent(payload, event, {
      deliveryStatus: 'failed',
      claimedAt: null,
      workerClaimId: null,
      failureReason: reason,
    })
    return {
      eventId: String(event.id),
      templateKey,
      toEmail,
      status: 'failed',
      reason,
      idempotencyKey,
    }
  }

  const resendEmailId = data?.id ?? null
  const sentAt = new Date()
  await updateEmailEvent(payload, event, {
    deliveryStatus: 'sent',
    claimedAt: null,
    workerClaimId: null,
    resendEmailId: resendEmailId ?? undefined,
    sentAt,
    failureReason: null,
  })
  await redactDeliveredResetLink(payload, event, {
    sentAt,
    idempotencyKey,
    provider: 'resend',
  })

  return {
    eventId: String(event.id),
    templateKey,
    toEmail,
    status: 'sent',
    resendEmailId,
    idempotencyKey,
  }
}

export async function processQueuedPayloadEmails(
  payload: PayloadCourseWriteAPI,
  args: ProcessQueuedPayloadEmailsArgs
): Promise<SendQueuedPayloadEmailResult[]> {
  // Recover any stale leases before processing new batch.
  await recoverStaleEmailLeases(payload)

  const where: Record<string, unknown> = {
    deliveryStatus: { equals: 'queued' },
  }
  if (args.targetEventId) {
    where.id = { equals: args.targetEventId }
  }

  const result = await payload.find({
    collection: 'payload_email_events',
    where,
    limit: args.limit ?? 25,
    depth: 0,
    sort: 'createdAt',
    overrideAccess: true,
  })

  const outcomes: SendQueuedPayloadEmailResult[] = []
  for (const event of result.docs) {
    outcomes.push(await sendQueuedPayloadEmail(payload, event.id, args))
  }

  return outcomes
}

// ─── Best-effort immediate delivery ─────────────────────────────────────────
// Call after queueEmailEvent to attempt delivery without blocking the caller.
// Failures are swallowed — the event stays queued for the retry worker.

export function attemptImmediateEmailDelivery(
  payload: PayloadCourseWriteAPI,
  eventId: PayloadId,
  args: Omit<ProcessQueuedPayloadEmailsArgs, 'limit' | 'targetEventId'>,
): void {
  if (!args.resend) return
  void sendQueuedPayloadEmail(payload, eventId, {
    ...args,
    limit: 1,
    targetEventId: String(eventId),
  }).catch((err: unknown) => {
    console.error('immediate_email_delivery_failed', {
      eventId: String(eventId),
      error: err instanceof Error ? err.message : 'unknown_error',
    })
  })
}
