import assert from 'node:assert/strict'

import {
  createPayloadMemberEmailVerificationService,
  createPostgresAtomicVerificationStore,
  type AtomicVerificationStore,
} from '../src/lib/auth/payloadMemberEmailVerification'
import {
  GENERIC_VERIFICATION_REQUEST_MESSAGE,
  handleMemberEmailVerificationComplete,
  handleMemberEmailVerificationResend,
} from '../src/lib/auth/memberEmailVerificationHttp'
import { resolveMemberVerificationPublicBaseUrl } from '../src/lib/auth/memberEmailVerificationApplication'
import { sendQueuedPayloadEmail } from '../src/lib/payloadCourse/emailSender'
import type { PayloadCourseWriteAPI, PayloadDocument } from '../src/lib/payloadCourse/accessService'
import type { VerificationTokenRecord } from '../src/lib/auth/memberEmailVerification'

function asId(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  throw new Error('missing id')
}

function conditionEquals(document: PayloadDocument, condition: Record<string, unknown>): boolean {
  return Object.entries(condition).every(([field, rawComparison]) => {
    const comparison = rawComparison as { equals?: unknown; exists?: boolean }
    if (Object.prototype.hasOwnProperty.call(comparison, 'equals')) {
      return String(document[field] ?? '') === String(comparison.equals ?? '')
    }
    if (Object.prototype.hasOwnProperty.call(comparison, 'exists')) {
      const exists = document[field] !== null && document[field] !== undefined
      return exists === comparison.exists
    }
    return true
  })
}

function matchesWhere(document: PayloadDocument, where: Record<string, unknown> | undefined): boolean {
  if (!where) return true
  const and = where.and
  if (Array.isArray(and)) {
    return and.every((condition) => conditionEquals(document, condition as Record<string, unknown>))
  }
  return conditionEquals(document, where)
}

class FakePayload implements PayloadCourseWriteAPI {
  sequence = 100
  collections = new Map<string, PayloadDocument[]>([
    ['payload_members', [{ id: 1, email: 'student@example.test', accountStatus: 'pending', source: 'self_signup' }]],
    ['payload_member_profiles', [{ id: 11, member: 1, displayName: 'Student' }]],
    ['payload_member_verification_tokens', []],
    ['payload_email_events', []],
    ['payload_email_templates', []],
    ['payload_member_security_events', []],
    ['payload_audit_events', []],
  ])
  db = {
    pool: {
      query: async (sql: string, values?: readonly unknown[]) => this.handleQuery(sql, values),
    },
  }

  private async handleQuery(sql: string, values?: readonly unknown[]) {
    if (sql.includes('INSERT INTO') && sql.includes('payload_email_events')) {
      const [displayName, toEmail, templateKey, dedupeKey, metadata] = values ?? []
      const document: PayloadDocument = {
        id: ++this.sequence,
        displayName,
        toEmail,
        templateKey,
        deliveryStatus: 'queued',
        dedupeKey,
        metadata,
        createdAt: '2026-07-01T20:00:00.000Z',
        updatedAt: '2026-07-01T20:00:00.000Z',
      }
      const collection = this.collections.get('payload_email_events') ?? []
      collection.push(document)
      this.collections.set('payload_email_events', collection)
      return { rows: [{ id: document.id }], rowCount: 1 }
    }
    if (sql.includes('SELECT "id"') && sql.includes('payload_email_events')) {
      const dedupeKey = String(values?.[0] ?? '')
      const event = (this.collections.get('payload_email_events') ?? []).find(
        (entry) => String(entry.dedupeKey) === dedupeKey,
      )
      return event ? { rows: [{ id: event.id }], rowCount: 1 } : { rows: [], rowCount: 0 }
    }
    return { rows: [{ id: 1 }], rowCount: 1 }
  }

  async find(args: {
    collection: string
    where?: Record<string, unknown>
    limit?: number
    depth?: number
    sort?: unknown
    overrideAccess?: boolean
  }) {
    const docs = (this.collections.get(args.collection) ?? []).filter((document) =>
      matchesWhere(document, args.where),
    )
    return { docs: docs.slice(0, args.limit ?? docs.length) }
  }

  async findByID(args: { collection: string; id: string | number }) {
    const document = (this.collections.get(args.collection) ?? []).find(
      (entry) => String(entry.id) === String(args.id),
    )
    if (!document) throw new Error(`missing ${args.collection}:${args.id}`)
    return document
  }

  async create(args: { collection: string; data: Record<string, unknown> }) {
    const document: PayloadDocument = { id: ++this.sequence, ...structuredClone(args.data) }
    const collection = this.collections.get(args.collection) ?? []
    collection.push(document)
    this.collections.set(args.collection, collection)
    return document
  }

  async update(args: { collection: string; id: string | number; data: Record<string, unknown> }) {
    const document = await this.findByID({ collection: args.collection, id: args.id })
    Object.assign(document, structuredClone(args.data))
    return document
  }
}

function createMemoryAtomicStore(payload: FakePayload): AtomicVerificationStore {
  return {
    async replaceActive(record) {
      const records = payload.collections.get('payload_member_verification_tokens') ?? []
      for (const existing of records) {
        if (
          String(existing.member) === record.memberId &&
          existing.purpose === 'member_email_verification' &&
          !existing.consumedAt &&
          !existing.invalidatedAt
        ) {
          existing.invalidatedAt = record.createdAt
        }
      }
      records.push({
        id: ++payload.sequence,
        member: Number(record.memberId),
        email: record.email,
        purpose: 'member_email_verification',
        tokenDigest: record.tokenDigest,
        expiresAt: record.expiresAt,
        consumedAt: record.consumedAt,
        invalidatedAt: undefined,
        lastSentAt: record.lastSentAt,
        sendAttempts: record.sendAttempts,
        idempotencyKey: record.idempotencyKey,
        createdAt: record.createdAt,
        updatedAt: record.createdAt,
      })
      payload.collections.set('payload_member_verification_tokens', records)
    },

    async consume(tokenDigest, consumedAt) {
      const record = (payload.collections.get('payload_member_verification_tokens') ?? []).find(
        (entry) =>
          entry.tokenDigest === tokenDigest &&
          !entry.consumedAt &&
          !entry.invalidatedAt &&
          new Date(String(entry.expiresAt)).getTime() > new Date(consumedAt).getTime(),
      )
      if (!record) return null
      record.consumedAt = consumedAt
      record.updatedAt = consumedAt
      return String(record.member)
    },
  }
}

async function run() {
  process.env.DATABASE_URL ??= 'postgresql://redacted.invalid/app?schema=jpvbootcamp_staging'
  assert.equal(
    resolveMemberVerificationPublicBaseUrl({ APP_PUBLIC_URL: 'https://preview.jpvbootcamp.test/path?q=1' } as unknown as NodeJS.ProcessEnv),
    'https://preview.jpvbootcamp.test/',
  )
  assert.equal(
    resolveMemberVerificationPublicBaseUrl({ NEXT_PUBLIC_APP_DOMAIN: 'jpvbootcamp.test' } as unknown as NodeJS.ProcessEnv),
    'https://jpvbootcamp.test/',
  )
  assert.throws(() => resolveMemberVerificationPublicBaseUrl({} as NodeJS.ProcessEnv), /public application URL/)

  const payload = new FakePayload()
  const rawToken = 'integration-verification-value-that-is-long-enough'
  const service = createPayloadMemberEmailVerificationService({
    payload,
    atomicStore: createMemoryAtomicStore(payload),
    publicBaseUrl: 'https://preview.jpvbootcamp.test',
    now: () => new Date('2026-07-01T20:00:00.000Z'),
    randomToken: () => rawToken,
  })

  const requestResult = await service.requestVerification('student@example.test')
  assert.deepEqual(requestResult, { accepted: true, message: GENERIC_VERIFICATION_REQUEST_MESSAGE })

  const verificationRecords = payload.collections.get('payload_member_verification_tokens') ?? []
  assert.equal(verificationRecords.length, 1)
  assert.equal(JSON.stringify(verificationRecords).includes(rawToken), false)
  assert.equal(verificationRecords[0]?.email, 'student@example.test')
  assert.equal(verificationRecords[0]?.sendAttempts, 1)

  const emailEvents = payload.collections.get('payload_email_events') ?? []
  assert.equal(emailEvents.length, 1)
  const queuedEvent = emailEvents[0]
  assert(queuedEvent)
  assert.equal(queuedEvent.templateKey, 'member-email-verification')
  assert.match(String(queuedEvent.dedupeKey), /^member-email-verification:1:/)
  const queuedMetadata = queuedEvent.metadata as Record<string, unknown>
  assert.equal(queuedMetadata.memberId, '1')
  assert.equal(queuedMetadata.displayName, 'Student')
  assert.match(String(queuedMetadata.verificationUrl), /member-email-verification\/complete/)
  assert.equal('token' in queuedMetadata, false)

  const sends: Array<{ payload: Record<string, unknown>; idempotencyKey?: string }> = []
  const sendResult = await sendQueuedPayloadEmail(payload, queuedEvent.id, {
    emailConfig: {
      from: 'JPV Bootcamp <members@example.test>',
      replyTo: 'support@example.test',
    },
    resend: {
      emails: {
        async send(sendPayload, options) {
          sends.push({ payload: sendPayload as unknown as Record<string, unknown>, idempotencyKey: options?.idempotencyKey })
          return { data: { id: 'fake-provider-message-1' } }
        },
      },
    },
  })
  assert.equal(sendResult.status, 'sent')
  assert.equal(sends.length, 1)
  assert.match(String(sends[0]?.payload.subject), /Verify your JPV Bootcamp email/)
  assert.match(String(sends[0]?.payload.text), /expires in one hour/)
  assert.match(String(sends[0]?.payload.html), /jpv-logo\.png/)
  assert.equal(sends[0]?.idempotencyKey, queuedEvent.dedupeKey)
  assert.equal(queuedEvent.deliveryStatus, 'sent')
  assert.equal(queuedEvent.resendEmailId, 'fake-provider-message-1')
  const deliveredMetadata = queuedEvent.metadata as Record<string, unknown>
  assert.equal('verificationUrl' in deliveredMetadata, false)
  assert.equal('logoUrl' in deliveredMetadata, false)
  assert.equal(deliveredMetadata.deliveryProvider, 'resend')
  assert.equal(deliveredMetadata.deliveryIdempotencyKey, queuedEvent.dedupeKey)

  const duplicate = await service.requestVerification('student@example.test')
  assert.deepEqual(duplicate, requestResult)
  assert.equal((payload.collections.get('payload_email_events') ?? []).length, 1)
  assert.equal(
    (payload.collections.get('payload_audit_events') ?? []).at(-1)?.action,
    'member_email_verification_suppressed',
  )

  const [firstCompletion, secondCompletion] = await Promise.all([
    service.completeVerification(rawToken),
    service.completeVerification(rawToken),
  ])
  assert.equal([firstCompletion, secondCompletion].filter((result) => result.verified).length, 1)
  assert.equal(
    [firstCompletion, secondCompletion].filter(
      (result) => result.verified === false && result.reason === 'already_used',
    ).length,
    1,
  )
  const member = (payload.collections.get('payload_members') ?? [])[0]
  assert(member?.emailVerifiedAt)
  assert.equal(member?.accountStatus, 'active')
  assert.equal(
    (payload.collections.get('payload_member_security_events') ?? []).at(-1)?.eventType,
    'email_verified',
  )
  assert.equal(
    ((payload.collections.get('payload_member_security_events') ?? []).at(-1)?.metadata as Record<string, unknown>)?.automaticLogin,
    false,
  )

  const validResendResponse = await handleMemberEmailVerificationResend(
    new Request('https://preview.jpvbootcamp.test/api/member-email-verification/resend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'unknown@example.test' }),
    }),
    {
      requestVerification: async () => ({ accepted: true, message: GENERIC_VERIFICATION_REQUEST_MESSAGE }),
      completeVerification: async () => ({ verified: false, reason: 'invalid_or_expired' }),
    },
  )
  assert.equal(validResendResponse.status, 200)
  assert.deepEqual(await validResendResponse.json(), {
    accepted: true,
    message: GENERIC_VERIFICATION_REQUEST_MESSAGE,
  })

  const failedProviderResponse = await handleMemberEmailVerificationResend(
    new Request('https://preview.jpvbootcamp.test/api/member-email-verification/resend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'student@example.test' }),
    }),
    {
      requestVerification: async () => {
        throw new Error('provider unavailable')
      },
      completeVerification: async () => ({ verified: false, reason: 'invalid_or_expired' }),
    },
  )
  assert.equal(failedProviderResponse.status, 200)
  assert.equal(JSON.stringify(await failedProviderResponse.json()).includes('provider'), false)

  const malformedResponse = await handleMemberEmailVerificationResend(
    new Request('https://preview.jpvbootcamp.test/api/member-email-verification/resend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '' }),
    }),
    {
      requestVerification: async () => ({ accepted: true, message: GENERIC_VERIFICATION_REQUEST_MESSAGE }),
      completeVerification: async () => ({ verified: false, reason: 'invalid_or_expired' }),
    },
  )
  assert.equal(malformedResponse.status, 400)

  const completionResponse = await handleMemberEmailVerificationComplete(
    new Request(`http://0.0.0.0:3000/api/member-email-verification/complete?token=${rawToken}&next=https://evil.example`),
    {
      requestVerification: async () => ({ accepted: true, message: GENERIC_VERIFICATION_REQUEST_MESSAGE }),
      completeVerification: async () => ({ verified: true, memberId: '1' }),
    },
    { publicBaseUrl: 'https://preview.jpvbootcamp.test' },
  )
  assert.equal(completionResponse.status, 303)
  const completionLocation = new URL(completionResponse.headers.get('location') ?? '')
  assert.equal(completionLocation.origin, 'https://preview.jpvbootcamp.test')
  assert.equal(completionLocation.pathname, '/portal')
  assert.equal(completionLocation.searchParams.get('mode'), 'login')
  assert.equal(completionLocation.searchParams.get('verification'), 'success')
  assert.equal(completionLocation.toString().includes('evil.example'), false)
  assert.equal(completionLocation.toString().includes(rawToken), false)

  const queryCalls: Array<{ sql: string; values?: readonly unknown[] }> = []
  const queryPayload = Object.assign(new FakePayload(), {
    db: {
      pool: {
        async query(sql: string, values?: readonly unknown[]) {
          queryCalls.push({ sql, values })
          if (sql.includes('RETURNING "member_id"')) return { rows: [{ member_id: 1 }], rowCount: 1 }
          return { rows: [{ id: 1 }], rowCount: 1 }
        },
      },
    },
  })
  const postgresStore = createPostgresAtomicVerificationStore(
    queryPayload,
    'postgresql://redacted.invalid/app?schema=jpvbootcamp_staging',
  )
  const record = verificationRecords[0] as unknown as VerificationTokenRecord
  await postgresStore.replaceActive({
    memberId: '1',
    email: 'student@example.test',
    tokenDigest: String(record.tokenDigest),
    expiresAt: String(record.expiresAt),
    createdAt: String(record.createdAt),
    lastSentAt: String(record.lastSentAt),
    sendAttempts: 1,
    idempotencyKey: String(record.idempotencyKey),
  })
  const consumedMember = await postgresStore.consume(String(record.tokenDigest), '2026-07-01T20:01:00.000Z')
  assert.equal(consumedMember, '1')
  assert.equal(queryCalls.length, 2)
  assert.match(queryCalls[0]?.sql ?? '', /\$8::varchar/)
  assert.equal((queryCalls[0]?.sql ?? '').includes(String(record.tokenDigest)), false)
  assert.equal(queryCalls[0]?.values?.[2], record.tokenDigest)

  const env = process.env as NodeJS.ProcessEnv & { NODE_ENV?: string }
  const previousNodeEnv = env.NODE_ENV
  env.NODE_ENV = 'production'
  try {
    const productionQueryCalls: Array<{ sql: string; values?: readonly unknown[] }> = []
    const productionQueryClient = {
      async query(sql: string, values?: readonly unknown[]) {
        productionQueryCalls.push({ sql, values })
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
          return { rows: [], rowCount: 0 }
        }
        if (sql.includes('INSERT INTO') && sql.includes('payload_member_verification_tokens')) {
          return { rows: [{ id: 42 }], rowCount: 1 }
        }
        return { rows: [{ id: 1 }], rowCount: 1 }
      },
    }
    const productionStore = createPostgresAtomicVerificationStore(
      new FakePayload(),
      'postgresql://redacted.invalid/app?schema=jpvbootcamp_staging',
      productionQueryClient,
    )
    await productionStore.replaceActive({
      memberId: '1',
      email: 'student@example.test',
      tokenDigest: String(record.tokenDigest),
      expiresAt: String(record.expiresAt),
      createdAt: String(record.createdAt),
      lastSentAt: String(record.lastSentAt),
      sendAttempts: 1,
      idempotencyKey: String(record.idempotencyKey),
    })
    assert.deepEqual(productionQueryCalls.map((entry) => entry.sql), [
      'BEGIN',
      productionQueryCalls[1]?.sql ?? '',
      productionQueryCalls[2]?.sql ?? '',
      'COMMIT',
    ])
    assert.match(productionQueryCalls[1]?.sql ?? '', /UPDATE "jpvbootcamp_staging"\."payload_member_verification_tokens"/)
    assert.match(productionQueryCalls[2]?.sql ?? '', /INSERT INTO "jpvbootcamp_staging"\."payload_member_verification_tokens"/)
    assert.equal((productionQueryCalls[1]?.sql ?? '').includes(String(record.tokenDigest)), false)
    assert.equal(productionQueryCalls[1]?.values?.length, 2)
    assert.equal(productionQueryCalls[1]?.values?.[0], 1)
    assert.equal(productionQueryCalls[1]?.values?.[1], record.createdAt)
    assert.equal(productionQueryCalls[2]?.values?.[2], record.tokenDigest)
  } finally {
    env.NODE_ENV = previousNodeEnv
  }

  console.log('member email verification integration checks passed')
}

void run()
