import { createHash } from 'node:crypto'

import { normalizeEmail } from '@/lib/normalize-email'
import { getSystemEmailTemplate } from '@/lib/payloadCourse/systemEmailTemplates'
import { redactDeliveredResetLink } from '@/lib/members/redactDeliveredResetLink'
import type {
  PayloadCourseWriteAPI,
  PayloadDocument,
  PayloadId,
} from '@/lib/payloadCourse/accessService'

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
  return {
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

  if (!args.resend) {
    await updateEmailEvent(payload, event, {
      deliveryStatus: 'failed',
      failureReason: 'resend_client_missing',
    })
    return {
      eventId: String(event.id),
      templateKey,
      toEmail,
      status: 'failed',
      reason: 'resend_client_missing',
      idempotencyKey,
    }
  }

  let sendResult: SendEmailResponse
  try {
    sendResult = await args.resend.emails.send(sendPayload, { idempotencyKey })
  } catch (error) {
    const reason = errorMessage(error)
    await updateEmailEvent(payload, event, {
      deliveryStatus: 'failed',
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

  const { data, error } = sendResult
  if (error) {
    const reason = errorMessage(error)
    if (isResendIdempotencyReplay(reason)) {
      const sentAt = new Date()
      await updateEmailEvent(payload, event, {
        deliveryStatus: 'sent',
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
    await updateEmailEvent(payload, event, {
      deliveryStatus: 'failed',
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
