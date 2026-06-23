import assert from 'node:assert/strict'

import {
  processQueuedPayloadEmails,
  sendQueuedPayloadEmail,
  type PayloadEmailSenderClient,
} from '../src/lib/payloadCourse/emailSender'
import type {
  PayloadCourseWriteAPI,
  PayloadDocument,
  PayloadId,
} from '../src/lib/payloadCourse/accessService'

type CollectionMap = Record<string, PayloadDocument[]>

function relationValue(value: unknown) {
  if (value && typeof value === 'object' && 'id' in value) {
    return String((value as { id: PayloadId }).id)
  }
  return String(value)
}

function matchesCondition(value: unknown, condition: unknown): boolean {
  if (!condition || typeof condition !== 'object') return value === condition
  const record = condition as Record<string, unknown>

  if ('equals' in record) {
    const expected = String(record.equals)
    if (Array.isArray(value)) return value.some((item) => relationValue(item) === expected)
    return relationValue(value) === expected
  }

  return false
}

function matchesWhere(doc: PayloadDocument, where?: Record<string, unknown>): boolean {
  if (!where) return true
  if (Array.isArray(where.and)) {
    return where.and.every((condition) => matchesWhere(doc, condition as Record<string, unknown>))
  }

  return Object.entries(where).every(([field, condition]) => {
    if (field === 'and') return true
    return matchesCondition(doc[field], condition)
  })
}

class FakePayload implements PayloadCourseWriteAPI {
  private nextId = 100

  constructor(private readonly collections: CollectionMap) {}

  async find(args: {
    collection: string
    where?: Record<string, unknown>
    limit?: number
    sort?: string
  }) {
    let docs = [...(this.collections[args.collection] ?? [])].filter((doc) => matchesWhere(doc, args.where))
    if (args.sort) {
      const direction = args.sort.startsWith('-') ? -1 : 1
      const field = args.sort.replace(/^-/, '')
      docs = docs.sort((a, b) => String(a[field] ?? '').localeCompare(String(b[field] ?? '')) * direction)
    }
    return { docs: docs.slice(0, args.limit ?? docs.length) }
  }

  async findByID(args: { collection: string; id: PayloadId }) {
    const doc = (this.collections[args.collection] ?? []).find((item) => String(item.id) === String(args.id))
    if (!doc) throw new Error(`missing ${args.collection}:${args.id}`)
    return doc
  }

  async create(args: { collection: string; data: Record<string, unknown> }) {
    const doc = {
      id: `${args.collection}_${this.nextId++}`,
      ...args.data,
    }
    this.collections[args.collection] = this.collections[args.collection] ?? []
    this.collections[args.collection].push(doc)
    return doc
  }

  async update(args: { collection: string; id: PayloadId; data: Record<string, unknown> }) {
    const docs = this.collections[args.collection] ?? []
    const index = docs.findIndex((doc) => String(doc.id) === String(args.id))
    if (index < 0) throw new Error(`missing ${args.collection}:${args.id}`)
    docs[index] = {
      ...docs[index],
      ...args.data,
    }
    return docs[index]
  }

  doc(collection: string, id: PayloadId) {
    return (this.collections[collection] ?? []).find((item) => String(item.id) === String(id))
  }
}

function buildPayload(overrides: Partial<CollectionMap> = {}) {
  return new FakePayload({
    payload_email_templates: [
      {
        id: 'template_1',
        templateKey: 'subscription-started',
        status: 'active',
        subject: 'Welcome {{plan}}',
        textBody: 'Hello {{firstName}}, your {{plan}} access is ready.',
        htmlBody: '<p>Hello {{firstName}}, your {{plan}} access is ready.</p>',
      },
    ],
    payload_email_events: [
      {
        id: 'event_1',
        toEmail: 'Student@Example.com',
        templateKey: 'subscription-started',
        deliveryStatus: 'queued',
        dedupeKey: 'subscription-started:sub_123',
        metadata: {
          firstName: '<Steve>',
          plan: 'pro',
        },
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    ...overrides,
  })
}

function fakeResend() {
  const sends: Array<{
    payload: unknown
    options: { idempotencyKey?: string } | undefined
  }> = []
  const client: PayloadEmailSenderClient = {
    emails: {
      send: async (payload, options) => {
        sends.push({ payload, options })
        return { data: { id: `email_${sends.length}` }, error: null }
      },
    },
  }
  return { client, sends }
}

async function run() {
  {
    const payload = buildPayload()
    const resend = fakeResend()

    const result = await sendQueuedPayloadEmail(payload, 'event_1', {
      resend: resend.client,
      emailConfig: {
        from: 'JPV Bootcamp <support@jpvbootcamp.com>',
        replyTo: 'support@jpvbootcamp.com',
      },
    })

    assert.equal(result.status, 'sent')
    assert.equal(result.resendEmailId, 'email_1')
    assert.equal(result.idempotencyKey, 'subscription-started:sub_123')
    assert.equal(resend.sends.length, 1)
    assert.equal(resend.sends[0]?.options?.idempotencyKey, 'subscription-started:sub_123')

    const sent = payload.doc('payload_email_events', 'event_1')
    assert.equal(sent?.deliveryStatus, 'sent')
    assert.equal(sent?.resendEmailId, 'email_1')

    const sendPayload = resend.sends[0]?.payload as { subject?: string; text?: string; html?: string }
    assert.equal(sendPayload.subject, 'Welcome pro')
    assert.equal(sendPayload.text, 'Hello <Steve>, your pro access is ready.')
    assert.equal(sendPayload.html, '<p>Hello &lt;Steve&gt;, your pro access is ready.</p>')
  }

  {
    const payload = buildPayload()
    const resend = fakeResend()

    const results = await processQueuedPayloadEmails(payload, {
      dryRun: true,
      resend: resend.client,
      emailConfig: {
        from: 'JPV Bootcamp <support@jpvbootcamp.com>',
      },
    })

    assert.equal(results.length, 1)
    assert.equal(results[0]?.status, 'dry_run')
    assert.equal(resend.sends.length, 0)
    assert.equal(payload.doc('payload_email_events', 'event_1')?.deliveryStatus, 'queued')
  }

  {
    const payload = buildPayload({
      payload_email_templates: [],
    })
    const resend = fakeResend()

    const result = await sendQueuedPayloadEmail(payload, 'event_1', {
      dryRun: true,
      resend: resend.client,
      emailConfig: {
        from: 'JPV Bootcamp <support@jpvbootcamp.com>',
      },
    })

    assert.equal(result.status, 'dry_run')
    assert.equal(result.reason, 'active_template_missing')
    assert.equal(resend.sends.length, 0)
    assert.equal(payload.doc('payload_email_events', 'event_1')?.deliveryStatus, 'queued')
  }

  {
    const payload = buildPayload({
      payload_email_events: [
        {
          id: 'event_invalid',
          toEmail: 'not-an-email',
          templateKey: 'subscription-started',
          deliveryStatus: 'queued',
          dedupeKey: 'subscription-started:invalid',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    })
    const resend = fakeResend()

    const result = await sendQueuedPayloadEmail(payload, 'event_invalid', {
      dryRun: true,
      resend: resend.client,
      emailConfig: {
        from: 'JPV Bootcamp <support@jpvbootcamp.com>',
      },
    })

    assert.equal(result.status, 'dry_run')
    assert.equal(result.reason, 'invalid_recipient_email')
    assert.equal(resend.sends.length, 0)
    assert.equal(payload.doc('payload_email_events', 'event_invalid')?.deliveryStatus, 'queued')
  }

  {
    const payload = buildPayload({
      payload_email_events: [
        {
          id: 'event_sent',
          toEmail: 'student@example.com',
          templateKey: 'subscription-started',
          deliveryStatus: 'sent',
          resendEmailId: 'email_existing',
          dedupeKey: 'subscription-started:sub_123',
        },
      ],
    })
    const resend = fakeResend()

    const result = await sendQueuedPayloadEmail(payload, 'event_sent', {
      resend: resend.client,
      emailConfig: {
        from: 'JPV Bootcamp <support@jpvbootcamp.com>',
      },
    })

    assert.equal(result.status, 'skipped')
    assert.equal(result.reason, 'already_sent')
    assert.equal(resend.sends.length, 0)
  }

  {
    const payload = buildPayload({
      payload_email_templates: [],
    })
    const resend = fakeResend()

    const result = await sendQueuedPayloadEmail(payload, 'event_1', {
      resend: resend.client,
      emailConfig: {
        from: 'JPV Bootcamp <support@jpvbootcamp.com>',
      },
    })

    assert.equal(result.status, 'failed')
    assert.equal(result.reason, 'active_template_missing')
    assert.equal(resend.sends.length, 0)
    assert.equal(payload.doc('payload_email_events', 'event_1')?.deliveryStatus, 'failed')
  }

  {
    const payload = buildPayload()
    const client: PayloadEmailSenderClient = {
      emails: {
        send: async () => {
          throw new Error('provider_unavailable')
        },
      },
    }

    const result = await sendQueuedPayloadEmail(payload, 'event_1', {
      resend: client,
      emailConfig: {
        from: 'JPV Bootcamp <support@jpvbootcamp.com>',
      },
    })

    assert.equal(result.status, 'failed')
    assert.equal(result.reason, 'provider_unavailable')
    assert.equal(payload.doc('payload_email_events', 'event_1')?.deliveryStatus, 'failed')
    assert.equal(payload.doc('payload_email_events', 'event_1')?.failureReason, 'provider_unavailable')
  }
}

run()
  .then(() => {
    console.log('payload_course_email_sender.test.ts passed')
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })




async function testPasswordWorkflowEmailRedactionAfterDelivery() {
  const payload = new FakePayload({
    payload_email_templates: [
      {
        id: 'template_password_reset',
        templateKey: 'member-password-reset',
        status: 'active',
        subject: 'Reset your password',
        textBody: 'Open {{actionUrl}}',
        htmlBody: '<p><a href="{{actionUrl}}">Reset password</a></p>',
      },
    ],
    payload_email_events: [
      {
        id: 'event_password_reset',
        toEmail: 'member@example.com',
        templateKey: 'member-password-reset',
        deliveryStatus: 'queued',
        dedupeKey: 'member-password-reset:member_1:fingerprint',
        metadata: {
          purpose: 'password_reset',
          actionUrl: 'https://example.com/reset-password?token=raw-sensitive-token',
        },
        createdAt: '2026-06-23T12:00:00.000Z',
      },
    ],
  })
  const resend: PayloadEmailSenderClient = {
    emails: {
      async send(message) {
        assert.equal(message.text.includes('raw-sensitive-token'), true)
        return { data: { id: 'resend_password_reset' } }
      },
    },
  }

  const result = await sendQueuedPayloadEmail(payload, 'event_password_reset', {
    resend,
    emailConfig: { from: 'JPV Bootcamp <support@example.com>' },
  })

  assert.equal(result.status, 'sent')
  const stored = payload.doc('payload_email_events', 'event_password_reset')
  assert.ok(stored)
  assert.equal(stored.deliveryStatus, 'sent')
  assert.equal(stored.resendEmailId, 'resend_password_reset')
  const metadata = stored.metadata as Record<string, unknown>
  assert.equal('actionUrl' in metadata, false)
  assert.equal(metadata.purpose, 'password_reset')
  assert.equal(metadata.deliveryProvider, 'resend')
  assert.equal(JSON.stringify(stored).includes('raw-sensitive-token'), false)
}

testPasswordWorkflowEmailRedactionAfterDelivery().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
