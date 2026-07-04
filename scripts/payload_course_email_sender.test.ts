import assert from 'node:assert/strict'

import {
  processQueuedPayloadEmails,
  sendQueuedPayloadEmail,
  type PayloadEmailSenderClient,
} from '../src/lib/payloadCourse/emailSender'
import { cleanupSensitiveEmailEvents } from '../src/lib/members/cleanupSensitiveEmailEvents'
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

  if ('in' in record && Array.isArray(record.in)) {
    return record.in.map(String).includes(relationValue(value))
  }

  if ('less_than' in record) {
    return String(value ?? '') < String(record.less_than ?? '')
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
  updates: Array<Record<string, unknown>> = []

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
    this.updates.push(args as Record<string, unknown>)
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

const accountSecurityTemplateKeys = [
  'member-invitation',
  'member-password-reset',
  'member-password-changed',
  'member-account-ready',
  'member-profile-changed',
  'member-email-change-confirmation',
  'member-email-change-requested',
  'member-email-changed',
  'access-blocked',
  'access-suspended',
  'access-restored',
  'access-deleted',
] as const

const sensitiveAccountTemplateKeys = [
  'member-invitation',
  'member-password-reset',
  'member-email-verification',
  'member-email-change-confirmation',
] as const

async function testAccountSecuritySystemTemplates() {
  for (const templateKey of accountSecurityTemplateKeys) {
    const eventId = `event_${templateKey}`
    const payload = buildPayload({
      payload_email_templates: [],
      payload_email_events: [
        {
          id: eventId,
          toEmail: 'member@example.test',
          templateKey,
          deliveryStatus: 'queued',
          dedupeKey: `${templateKey}:member_1:event_1`,
          metadata: {
            displayName: '<Member & Admin>',
            logoUrl: 'https://preview.jpvbootcamp.test/images/jpv-logo.png',
            actionUrl: 'https://preview.jpvbootcamp.test/account-action?token=fake-sensitive-value',
            verificationUrl: 'https://preview.jpvbootcamp.test/verify?token=fake-sensitive-value',
            moderationReason: 'private-moderation-detail',
            administratorIdentity: 'private-administrator-identity',
            password: 'private-password-value',
            sessionToken: 'private-session-value',
          },
          createdAt: '2026-07-02T03:00:00.000Z',
        },
      ],
    })
    const resend = fakeResend()
    const result = await sendQueuedPayloadEmail(payload, eventId, {
      resend: resend.client,
      emailConfig: { from: 'JPV Bootcamp <support@example.test>' },
    })

    assert.equal(result.status, 'sent', templateKey)
    assert.equal(resend.sends.length, 1, templateKey)
    const message = resend.sends[0]?.payload as {
      subject?: string
      text?: string
      html?: string
    }
    assert.ok(message.subject?.trim(), templateKey)
    assert.ok(message.text?.trim(), templateKey)
    assert.ok(message.html?.trim(), templateKey)
    assert.match(message.html ?? '', /JPV/)
    assert.match(message.html ?? '', /jpv-logo\.png/)
    assert.match(message.html ?? '', /&lt;Member &amp; Admin&gt;/)
    assert.equal((message.html ?? '').includes('<Member & Admin>'), false)

    const rendered = `${message.subject ?? ''}\n${message.text ?? ''}\n${message.html ?? ''}`
    for (const privateValue of [
      'private-moderation-detail',
      'private-administrator-identity',
      'private-password-value',
      'private-session-value',
    ]) {
      assert.equal(rendered.includes(privateValue), false, `${templateKey}:${privateValue}`)
    }
  }
}

async function testSensitiveAccountLinkRedaction() {
  for (const templateKey of sensitiveAccountTemplateKeys) {
    const eventId = `sensitive_${templateKey}`
    const payload = buildPayload({
      payload_email_templates: [],
      payload_email_events: [
        {
          id: eventId,
          toEmail: 'member@example.test',
          templateKey,
          deliveryStatus: 'queued',
          dedupeKey: `${templateKey}:member_1:sensitive`,
          metadata: {
            purpose: templateKey,
            displayName: 'Member',
            logoUrl: 'https://preview.jpvbootcamp.test/images/jpv-logo.png',
            actionUrl: 'https://preview.jpvbootcamp.test/action?token=fake-sensitive-value',
            verificationUrl: 'https://preview.jpvbootcamp.test/verify?token=fake-sensitive-value',
          },
          createdAt: '2026-07-02T03:00:00.000Z',
        },
      ],
    })
    const resend = fakeResend()
    const result = await sendQueuedPayloadEmail(payload, eventId, {
      resend: resend.client,
      emailConfig: { from: 'JPV Bootcamp <support@example.test>' },
    })
    assert.equal(result.status, 'sent', templateKey)
    const stored = payload.doc('payload_email_events', eventId)
    assert.ok(stored, templateKey)
    const serialized = JSON.stringify(stored?.metadata)
    assert.equal(serialized.includes('actionUrl'), false, templateKey)
    assert.equal(serialized.includes('verificationUrl'), false, templateKey)
    assert.equal(serialized.includes('fake-sensitive-value'), false, templateKey)
  }
}

async function testStaleSensitiveAccountLinkCleanup() {
  const oldEvents = sensitiveAccountTemplateKeys.map((templateKey, index) => ({
    id: `stale_${index}`,
    toEmail: 'member@example.test',
    templateKey,
    deliveryStatus: index % 2 === 0 ? 'queued' : 'failed',
    dedupeKey: `${templateKey}:stale:${index}`,
    metadata: {
      purpose: templateKey,
      actionUrl: `https://preview.jpvbootcamp.test/action?token=stale-sensitive-${index}`,
      verificationUrl: `https://preview.jpvbootcamp.test/verify?token=stale-sensitive-${index}`,
    },
    createdAt: '2026-07-02T01:00:00.000Z',
  }))
  const payload = buildPayload({
    payload_email_templates: [],
    payload_email_events: [
      ...oldEvents,
      {
        id: 'recent_sensitive',
        toEmail: 'member@example.test',
        templateKey: 'member-password-reset',
        deliveryStatus: 'queued',
        dedupeKey: 'member-password-reset:recent',
        metadata: { actionUrl: 'https://preview.jpvbootcamp.test/action?token=recent-value' },
        createdAt: '2026-07-02T03:30:00.000Z',
      },
    ],
  })

  const result = await cleanupSensitiveEmailEvents(payload, {
    now: new Date('2026-07-02T04:00:00.000Z'),
    retentionMs: 60 * 60 * 1000,
  })
  assert.equal(result.redacted, sensitiveAccountTemplateKeys.length)
  for (const event of oldEvents) {
    const stored = payload.doc('payload_email_events', event.id)
    const serialized = JSON.stringify(stored?.metadata)
    assert.equal(serialized.includes('actionUrl'), false, event.templateKey)
    assert.equal(serialized.includes('verificationUrl'), false, event.templateKey)
    assert.equal(serialized.includes('stale-sensitive-'), false, event.templateKey)
  }
  assert.equal(
    JSON.stringify(payload.doc('payload_email_events', 'recent_sensitive')?.metadata).includes('recent-value'),
    true,
  )
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

  await testAccountSecuritySystemTemplates()
  await testSensitiveAccountLinkRedaction()
  await testStaleSensitiveAccountLinkCleanup()
  await testPasswordWorkflowEmailRedactionAfterDelivery()
  await testEmailSenderBypassesDocumentLocks()
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

async function testEmailSenderBypassesDocumentLocks() {
  const payload = new FakePayload({
    payload_email_templates: [
      {
        id: 'template_lock',
        templateKey: 'subscription-started',
        status: 'active',
        subject: 'Lock override test',
        textBody: 'Hello {{plan}}',
      },
    ],
    payload_email_events: [
      {
        id: 'event_lock',
        toEmail: 'student@example.com',
        templateKey: 'subscription-started',
        deliveryStatus: 'queued',
        dedupeKey: 'subscription-started:lock-test',
        metadata: {
          plan: 'pro',
        },
        createdAt: '2026-07-04T00:00:00.000Z',
      },
    ],
  })

  const result = await sendQueuedPayloadEmail(payload, 'event_lock', {
    resend: {
      emails: {
        async send() {
          return { data: { id: 'email_lock' } }
        },
      },
    },
    emailConfig: { from: 'JPV Bootcamp <support@example.com>' },
  })

  assert.equal(result.status, 'sent')
  assert.equal(payload.updates.length, 2)
  assert.equal(payload.updates.every((update) => update.overrideAccess === true), true)
  assert.equal(payload.updates.every((update) => update.overrideLock === true), true)
}
