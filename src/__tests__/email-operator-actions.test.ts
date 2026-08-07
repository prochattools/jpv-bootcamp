import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  EmailOperatorActionError,
  executeEmailOperatorAction,
} from '@/lib/email/emailOperatorActions'
import type {
  PayloadCourseWriteAPI,
  PayloadDocument,
  PayloadId,
} from '@/lib/payloadCourse/accessService'

class FakePayload implements PayloadCourseWriteAPI {
  readonly updates: Array<Record<string, unknown>> = []

  constructor(readonly events: PayloadDocument[]) {}

  async find() {
    return { docs: [] }
  }

  async findByID(args: { collection: string; id: PayloadId }) {
    const event = this.events.find((item) => String(item.id) === String(args.id))
    if (!event) throw new Error('missing')
    return event
  }

  async create() {
    throw new Error('not implemented')
  }

  async update(args: {
    collection: string
    id: PayloadId
    data: Record<string, unknown>
    overrideAccess?: boolean
    overrideLock?: boolean
  }) {
    this.updates.push(args)
    const event = this.events.find((item) => String(item.id) === String(args.id))
    if (!event) throw new Error('missing')
    Object.assign(event, args.data)
    return event
  }
}

function failedEvent(overrides: Partial<PayloadDocument> = {}): PayloadDocument {
  return {
    id: 'email-1',
    displayName: 'Password reset email',
    toEmail: 'member@example.test',
    templateKey: 'member-password-reset',
    deliveryStatus: 'failed',
    resendEmailId: 'provider-message-1',
    dedupeKey: 'member-password-reset:member-1:request-1',
    sentAt: '2026-07-24T08:00:00.000Z',
    deliveredAt: null,
    failureReason: 'provider_unavailable',
    retryCount: 1,
    metadata: {
      existingAuditValue: 'preserved',
      retryCount: 1,
    },
    ...overrides,
  }
}

describe('email operator delivery actions', () => {
  it('requeues a failed event without invoking the provider directly', async () => {
    const payload = new FakePayload([failedEvent()])

    const result = await executeEmailOperatorAction({
      payload,
      actionRecordId: 'action-1',
      emailEventId: 'email-1',
      action: 'retry_delivery',
      administratorId: 'admin-1',
      note: 'Support ticket JPV-101',
      now: new Date('2026-07-24T10:00:00.000Z'),
    })

    expect(result).toEqual({
      action: 'retry_delivery',
      actionRecordId: 'action-1',
      emailEventId: 'email-1',
      status: 'completed',
      retryCount: 2,
      queuedAt: '2026-07-24T10:00:00.000Z',
    })
    expect(payload.updates).toHaveLength(1)
    expect(payload.updates[0]).toMatchObject({
      collection: 'payload_email_events',
      id: 'email-1',
      overrideAccess: true,
      overrideLock: true,
      data: {
        deliveryStatus: 'queued',
        resendEmailId: null,
        sentAt: null,
        deliveredAt: null,
        failureReason: null,
        retryCount: 2,
        lastRetryRequestedAt: '2026-07-24T10:00:00.000Z',
        lastRetryRequestedBy: 'admin-1',
        metadata: {
          existingAuditValue: 'preserved',
          retryCount: 2,
          lastRetryActionRecordId: 'action-1',
          lastRetryRequestedAt: '2026-07-24T10:00:00.000Z',
          lastRetryRequestedBy: 'admin-1',
          lastRetryNote: 'Support ticket JPV-101',
        },
      },
    })
  })

  it('is idempotent when the same action record is replayed', async () => {
    const payload = new FakePayload([
      failedEvent({
        deliveryStatus: 'queued',
        retryCount: 2,
        lastRetryRequestedAt: '2026-07-24T10:00:00.000Z',
        metadata: {
          retryCount: 2,
          lastRetryActionRecordId: 'action-1',
          lastRetryRequestedAt: '2026-07-24T10:00:00.000Z',
        },
      }),
    ])

    const result = await executeEmailOperatorAction({
      payload,
      actionRecordId: 'action-1',
      emailEventId: 'email-1',
      action: 'retry_delivery',
      administratorId: 'admin-1',
    })

    expect(result.status).toBe('skipped')
    expect(result.retryCount).toBe(2)
    expect(payload.updates).toHaveLength(0)
  })

  it('rejects queued, sent, and missing events', async () => {
    const queued = new FakePayload([failedEvent({ deliveryStatus: 'queued' })])
    await expect(
      executeEmailOperatorAction({
        payload: queued,
        actionRecordId: 'action-2',
        emailEventId: 'email-1',
        action: 'retry_delivery',
        administratorId: 'admin-1',
      }),
    ).rejects.toMatchObject({ code: 'email_event_already_requeued' } satisfies Partial<EmailOperatorActionError>)

    const sent = new FakePayload([failedEvent({ deliveryStatus: 'sent' })])
    await expect(
      executeEmailOperatorAction({
        payload: sent,
        actionRecordId: 'action-3',
        emailEventId: 'email-1',
        action: 'retry_delivery',
        administratorId: 'admin-1',
      }),
    ).rejects.toMatchObject({ code: 'email_event_not_retryable' } satisfies Partial<EmailOperatorActionError>)

    const missing = new FakePayload([])
    await expect(
      executeEmailOperatorAction({
        payload: missing,
        actionRecordId: 'action-4',
        emailEventId: 'missing',
        action: 'retry_delivery',
        administratorId: 'admin-1',
      }),
    ).rejects.toMatchObject({ code: 'email_event_missing' } satisfies Partial<EmailOperatorActionError>)
  })

  it('exposes immutable queue events and create-only audited retry controls', () => {
    const collection = readFileSync(resolve('src/collections/crm/CRM.ts'), 'utf8')
    const sender = readFileSync(resolve('src/lib/payloadCourse/emailSender.ts'), 'utf8')
    const cli = readFileSync(resolve('scripts/payload/send-queued-emails.mts'), 'utf8')
    const sendRoute = readFileSync(resolve('src/app/api/admin/send-queued-email/route.ts'), 'utf8')
    const batchRoute = readFileSync(resolve('src/app/api/admin/process-payload-email-queue/route.ts'), 'utf8')
    const actionService = readFileSync(resolve('src/lib/email/emailOperatorActions.ts'), 'utf8')

    expect(collection).toContain("slug: 'payload_email_actions'")
    expect(collection).toContain("value: 'retry_delivery'")
    expect(collection).toContain("deliveryStatus: { equals: 'failed' }")
    expect(collection).toContain('update: () => false')
    expect(collection).toContain('delete: () => false')
    expect(collection).toContain("name: 'retryCount'")
    expect(collection).toContain("name: 'lastRetryRequestedBy'")
    // Lease fields
    expect(collection).toContain("name: 'claimedAt'")
    expect(collection).toContain("name: 'workerClaimId'")
    expect(collection).toContain("value: 'processing'")
    // Dedicated worker secret — never PAYLOAD_SECRET
    expect(sendRoute).toContain('EMAIL_QUEUE_WORKER_SECRET')
    expect(sendRoute).not.toContain('PAYLOAD_SECRET')
    expect(batchRoute).toContain('EMAIL_QUEUE_WORKER_SECRET')
    expect(batchRoute).not.toContain('PAYLOAD_SECRET')
    // Sender correctness
    expect(sender).toContain("reason: 'resend_client_missing'")
    expect(sender).toContain('assertStagingRecipientAllowed')
    expect(sender).toContain('claimEventForDelivery')
    expect(sender).toContain('recoverStaleEmailLeases')
    expect(sender).toContain('attemptImmediateEmailDelivery')
    expect(cli).toContain('Refusing bulk apply without explicit targeting')
    expect(sendRoute).toContain("return json({ ok: false, error: 'processing_failed' }, 500)")
    expect(sendRoute).not.toContain('detail: message')
    expect(actionService).not.toContain("from 'resend'")
    expect(actionService).not.toContain('emails.send')
  })
})
