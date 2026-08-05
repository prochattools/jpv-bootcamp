import assert from 'node:assert/strict'

import {
  createMemberAccountActionService,
  digestMemberAccountAction,
  type MemberAccountActionDelivery,
} from '../src/lib/auth/memberAccountActions'
import { MemoryMemberAccountActionRepository } from './helpers/memberAccountActionMemoryRepository'
import {
  completeMemberEmailChange,
  requestMemberEmailChange,
} from '../src/lib/members/changeMemberEmail'
import { redactDeliveredResetLink } from '../src/lib/members/redactDeliveredResetLink'
import type {
  PayloadDocument,
  PayloadId,
  PayloadMemberAuthAPI,
} from '../src/lib/payloadCourse/accessService'
import {
  GET as completeEmailChangeRoute,
  buildMemberEmailChangeLoginResultUrl,
} from '../src/app/api/member-email-change/complete/route'

type CollectionMap = Record<string, PayloadDocument[]>

type Where = Record<string, unknown> | undefined

function relationValue(value: unknown): string {
  if (value && typeof value === 'object' && 'id' in value) {
    return String((value as { id: PayloadId }).id)
  }
  return String(value ?? '')
}

function matchesCondition(document: PayloadDocument, condition: Record<string, unknown>): boolean {
  return Object.entries(condition).every(([field, rawComparison]) => {
    if (!rawComparison || typeof rawComparison !== 'object') {
      return document[field] === rawComparison
    }
    const comparison = rawComparison as { equals?: unknown; exists?: boolean }
    if (Object.prototype.hasOwnProperty.call(comparison, 'equals')) {
      return relationValue(document[field]) === String(comparison.equals ?? '')
    }
    if (Object.prototype.hasOwnProperty.call(comparison, 'exists')) {
      const exists = document[field] !== null && document[field] !== undefined
      return exists === comparison.exists
    }
    return true
  })
}

function matchesWhere(document: PayloadDocument, where: Where): boolean {
  if (!where) return true
  const and = where.and
  if (Array.isArray(and)) {
    return and.every((condition) => matchesCondition(document, condition as Record<string, unknown>))
  }
  return matchesCondition(document, where)
}

class FakePayload implements PayloadMemberAuthAPI {
  readonly calls: string[] = []
  private sequence = 100

  constructor(readonly collections: CollectionMap) {}

  async find(args: {
    collection: string
    where?: Record<string, unknown>
    limit?: number
    depth?: number
    sort?: unknown
    overrideAccess?: boolean
  }) {
    this.calls.push(`find:${args.collection}`)
    const docs = (this.collections[args.collection] ?? []).filter((document) =>
      matchesWhere(document, args.where),
    )
    return { docs: docs.slice(0, args.limit ?? docs.length) }
  }

  async findByID(args: {
    collection: string
    id: PayloadId
    depth?: number
    overrideAccess?: boolean
  }) {
    this.calls.push(`findByID:${args.collection}`)
    const document = (this.collections[args.collection] ?? []).find(
      (entry) => String(entry.id) === String(args.id),
    )
    if (!document) throw new Error(`missing ${args.collection}:${args.id}`)
    return document
  }

  async create(args: {
    collection: string
    data: Record<string, unknown>
    overrideAccess?: boolean
  }) {
    this.calls.push(`create:${args.collection}`)
    const document: PayloadDocument = {
      id: `${args.collection}_${++this.sequence}`,
      ...structuredClone(args.data),
    }
    this.collections[args.collection] = this.collections[args.collection] ?? []
    this.collections[args.collection].push(document)
    return document
  }

  async update(args: {
    collection: string
    id: PayloadId
    data: Record<string, unknown>
    overrideAccess?: boolean
  }) {
    this.calls.push(`update:${args.collection}`)
    const document = await this.findByID({ collection: args.collection, id: args.id })
    Object.assign(document, structuredClone(args.data))
    return document
  }

  async login() {
    this.calls.push('forbidden:login')
    return { user: { id: 'member_1' } }
  }

  async forgotPassword() {
    this.calls.push('forbidden:forgotPassword')
    return 'legacy-action-value'
  }

  async resetPassword() {
    this.calls.push('forbidden:resetPassword')
    return { user: { id: 'member_1' } }
  }

  docs(collection: string): PayloadDocument[] {
    return this.collections[collection] ?? []
  }
}

class MemoryActionRepository extends MemoryMemberAccountActionRepository {}

class FakeActionTransport {
  readonly deliveries: MemberAccountActionDelivery[] = []

  async send(delivery: MemberAccountActionDelivery) {
    this.deliveries.push(structuredClone(delivery))
    return { providerMessageId: `fake-${this.deliveries.length}` }
  }
}

function createFixture(input?: {
  accountStatus?: string
  email?: string
  additionalMembers?: PayloadDocument[]
  actionValue?: string
  now?: Date
}) {
  const payload = new FakePayload({
    payload_members: [
      {
        id: 'member_1',
        email: input?.email ?? 'current@example.test',
        accountStatus: input?.accountStatus ?? 'active',
        emailVerifiedAt: '2026-06-01T00:00:00.000Z',
      },
      ...(input?.additionalMembers ?? []),
    ],
    payload_member_security_events: [],
    payload_audit_events: [],
    payload_email_events: [],
  })
  let currentTime = input?.now ?? new Date('2026-07-02T02:00:00.000Z')
  const repository = new MemoryActionRepository(() => new Date(currentTime))
  const transport = new FakeActionTransport()
  let actionValue = input?.actionValue ?? 'email-change-action-value-never-persisted'
  const service = createMemberAccountActionService({
    repository,
    transport,
    publicBaseUrl: 'https://preview.jpvbootcamp.test',
    now: () => new Date(currentTime),
    randomToken: () => actionValue,
    sendCooldownMs: 60_000,
    maxSendAttempts: 3,
  })

  return {
    payload,
    repository,
    transport,
    service,
    now: () => new Date(currentTime),
    setNow(value: Date) {
      currentTime = value
    },
    setActionValue(value: string) {
      actionValue = value
    },
  }
}

async function testRequestValidation() {
  const invalid = createFixture()
  assert.deepEqual(
    await requestMemberEmailChange(invalid.payload, invalid.service, {
      memberId: 'member_1',
      currentEmail: 'current@example.test',
      newEmail: 'not-an-email',
      baseUrl: 'https://preview.jpvbootcamp.test',
    }),
    { ok: false, error: 'invalid_email' },
  )
  assert.equal(invalid.repository.records.length, 0)

  const same = createFixture()
  assert.deepEqual(
    await requestMemberEmailChange(same.payload, same.service, {
      memberId: 'member_1',
      currentEmail: 'CURRENT@example.test',
      newEmail: ' current@example.test ',
      baseUrl: 'https://preview.jpvbootcamp.test',
    }),
    { ok: false, error: 'same_email' },
  )

  const duplicate = createFixture({
    additionalMembers: [{ id: 'member_2', email: 'used@example.test', accountStatus: 'active' }],
  })
  assert.deepEqual(
    await requestMemberEmailChange(duplicate.payload, duplicate.service, {
      memberId: 'member_1',
      currentEmail: 'current@example.test',
      newEmail: 'USED@example.test',
      baseUrl: 'https://preview.jpvbootcamp.test',
    }),
    { ok: false, error: 'email_unavailable' },
  )

  for (const accountStatus of ['pending', 'blocked', 'suspended', 'deleted']) {
    const ineligible = createFixture({ accountStatus })
    assert.deepEqual(
      await requestMemberEmailChange(ineligible.payload, ineligible.service, {
        memberId: 'member_1',
        currentEmail: 'current@example.test',
        newEmail: 'new@example.test',
        baseUrl: 'https://preview.jpvbootcamp.test',
      }),
      { ok: false, error: 'account_ineligible' },
    )
  }
}

async function testRequestAndConcurrentCompletion() {
  const fixture = createFixture()
  const actionValue = 'email-change-action-value-never-persisted'
  const requested = await requestMemberEmailChange(fixture.payload, fixture.service, {
    memberId: 'member_1',
    currentEmail: 'current@example.test',
    newEmail: ' New@Example.Test ',
    displayName: 'Member <Admin>',
    baseUrl: 'https://preview.jpvbootcamp.test',
  })

  assert.deepEqual(requested, { ok: true, delivery: 'queued', noticeQueued: true })
  assert.equal(fixture.payload.docs('payload_members')[0]?.email, 'current@example.test')
  assert.equal(fixture.repository.records.length, 1)
  const record = fixture.repository.records[0]
  assert(record)
  assert.equal(record.email, 'new@example.test')
  assert.equal(record.purpose, 'email_change_confirmation')
  assert.equal(record.tokenDigest, digestMemberAccountAction(actionValue))
  assert.equal(JSON.stringify(record).includes(actionValue), false)
  assert.equal(fixture.transport.deliveries[0]?.to, 'new@example.test')
  assert.equal(fixture.transport.deliveries[0]?.purpose, 'email_change_confirmation')
  assert.equal(
    fixture.payload.docs('payload_email_events').some(
      (event) =>
        event.templateKey === 'member-email-change-requested' &&
        event.toEmail === 'current@example.test',
    ),
    true,
  )

  const requestSecurityEvent = fixture.payload.docs('payload_member_security_events').find(
    (event) => event.eventType === 'email_change_requested',
  )
  const requestAudit = fixture.payload.docs('payload_audit_events').find(
    (event) => event.action === 'member.email.change.requested',
  )
  const requestMetadata = JSON.stringify([
    requestSecurityEvent?.metadata,
    requestAudit?.metadata,
  ])
  assert.equal(requestMetadata.includes('new@example.test'), false)
  assert.match(requestMetadata, /targetFingerprint/)

  assert.deepEqual(
    await completeMemberEmailChange(
      fixture.payload,
      fixture.service,
      'invalid-email-change-action-value',
      'https://preview.jpvbootcamp.test',
      fixture.now,
    ),
    { ok: false, error: 'invalid_or_expired_token' },
  )

  const completionTime = new Date('2026-07-02T02:05:00.000Z')
  fixture.setNow(completionTime)
  const results = await Promise.all([
    completeMemberEmailChange(
      fixture.payload,
      fixture.service,
      actionValue,
      'https://preview.jpvbootcamp.test',
      fixture.now,
    ),
    completeMemberEmailChange(
      fixture.payload,
      fixture.service,
      actionValue,
      'https://preview.jpvbootcamp.test',
      fixture.now,
    ),
  ])
  assert.equal(results.filter((result) => result.ok).length, 1)
  assert.equal(
    results.filter(
      (result) => result.ok === false && result.error === 'invalid_or_expired_token',
    ).length,
    1,
  )
  assert.equal(JSON.stringify(results).includes(actionValue), false)
  assert.equal(
    fixture.payload.calls.filter((call) => call === 'update:payload_members').length,
    1,
  )

  const member = fixture.payload.docs('payload_members')[0]
  assert.equal(member?.email, 'new@example.test')
  assert.equal(member?.emailVerifiedAt, completionTime.toISOString())
  const changedEvent = fixture.payload.docs('payload_member_security_events').find(
    (event) => event.eventType === 'email_changed',
  )
  assert(changedEvent)
  assert.equal((changedEvent.metadata as { automaticLogin?: unknown }).automaticLogin, false)
  assert.equal(
    fixture.payload.docs('payload_email_events').filter(
      (event) => event.templateKey === 'member-email-changed',
    ).length,
    2,
  )
  assert.equal(
    new Set(
      fixture.payload.docs('payload_email_events')
        .filter((event) => event.templateKey === 'member-email-changed')
        .map((event) => String(event.toEmail)),
    ).size,
    2,
  )
  assert.equal(fixture.payload.calls.includes('forbidden:login'), false)
  assert.equal(fixture.payload.calls.includes('forbidden:forgotPassword'), false)
  assert.equal(fixture.payload.calls.includes('forbidden:resetPassword'), false)

  const confirmationEvent = await fixture.payload.create({
    collection: 'payload_email_events',
    data: {
      toEmail: 'new@example.test',
      templateKey: 'member-email-change-confirmation',
      deliveryStatus: 'sent',
      metadata: {
        purpose: 'email_change_confirmation',
        actionUrl: fixture.transport.deliveries[0]?.actionUrl,
      },
    },
  })
  await redactDeliveredResetLink(fixture.payload, confirmationEvent, {
    sentAt: completionTime,
    idempotencyKey: 'fake-delivery-idempotency-key',
    provider: 'fake-provider',
  })
  const redacted = fixture.payload.docs('payload_email_events').find(
    (event) => event.id === confirmationEvent.id,
  )
  assert.equal(JSON.stringify(redacted?.metadata).includes('actionUrl'), false)
  assert.equal(JSON.stringify(redacted?.metadata).includes(actionValue), false)
}

async function testExpiredAndPurposeConfusedActions() {
  const expired = createFixture({ actionValue: 'expired-email-change-action-value' })
  await expired.service.issueAction({
    memberId: 'member_1',
    email: 'new@example.test',
    purpose: 'email_change_confirmation',
    templateKey: 'member-email-change-confirmation',
    actionPath: '/api/member-email-change/complete',
    ttlMs: 1,
  })
  expired.setNow(new Date('2026-07-02T02:00:00.002Z'))
  assert.deepEqual(
    await completeMemberEmailChange(
      expired.payload,
      expired.service,
      'expired-email-change-action-value',
      'https://preview.jpvbootcamp.test',
      expired.now,
    ),
    { ok: false, error: 'invalid_or_expired_token' },
  )

  const confused = createFixture({ actionValue: 'password-reset-action-value' })
  await confused.service.issueAction({
    memberId: 'member_1',
    email: 'current@example.test',
    purpose: 'password_reset',
    templateKey: 'member-password-reset',
    actionPath: '/reset-password',
    ttlMs: 60_000,
  })
  assert.deepEqual(
    await completeMemberEmailChange(
      confused.payload,
      confused.service,
      'password-reset-action-value',
      'https://preview.jpvbootcamp.test',
      confused.now,
    ),
    { ok: false, error: 'invalid_or_expired_token' },
  )
  assert.equal(confused.payload.docs('payload_members')[0]?.email, 'current@example.test')
}

async function testSameOriginRedirectSafety() {
  const request = new Request(
    'https://preview.jpvbootcamp.test/api/member-email-change/complete?token=redacted&next=https://evil.test&redirect=//evil.test',
  )
  const redirectUrl = buildMemberEmailChangeLoginResultUrl(request, 'success')
  assert.equal(redirectUrl.origin, 'https://preview.jpvbootcamp.test')
  assert.equal(redirectUrl.pathname, '/portal')
  assert.equal(redirectUrl.searchParams.get('mode'), 'login')
  assert.equal(redirectUrl.searchParams.get('emailChange'), 'success')
  assert.equal(redirectUrl.searchParams.has('token'), false)
  assert.equal(redirectUrl.searchParams.has('next'), false)
  assert.equal(redirectUrl.searchParams.has('redirect'), false)

  const invalidResponse = await completeEmailChangeRoute(
    new Request(
      'https://preview.jpvbootcamp.test/api/member-email-change/complete?token=short&next=https://evil.test',
    ),
  )
  assert.equal(invalidResponse.status, 303)
  const location = invalidResponse.headers.get('location')
  assert(location)
  const invalidUrl = new URL(location)
  assert.equal(invalidUrl.origin, 'https://preview.jpvbootcamp.test')
  assert.equal(invalidUrl.pathname, '/portal')
  assert.equal(invalidUrl.searchParams.get('mode'), 'login')
  assert.equal(invalidUrl.searchParams.get('emailChange'), 'invalid')
  assert.equal(invalidUrl.searchParams.has('token'), false)
  assert.equal(invalidUrl.searchParams.has('next'), false)
}

async function main() {
  await testRequestValidation()
  await testRequestAndConcurrentCompletion()
  await testExpiredAndPurposeConfusedActions()
  await testSameOriginRedirectSafety()
  console.log('payload_member_email_change.test.ts passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
