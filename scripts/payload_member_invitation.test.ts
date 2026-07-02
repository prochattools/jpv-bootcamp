import assert from 'node:assert/strict'

import {
  createMemberAccountActionService,
  type MemberAccountActionDelivery,
  type MemberAccountActionPurpose,
  type MemberAccountActionRecord,
  type MemberAccountActionRepository,
} from '../src/lib/auth/memberAccountActions'
import { completeMemberSetup } from '../src/lib/members/completeMemberSetup'
import { completePasswordReset } from '../src/lib/members/completePasswordReset'
import { inviteMember } from '../src/lib/members/inviteMember'
import { requestPasswordReset } from '../src/lib/members/requestPasswordReset'
import type {
  PayloadDocument,
  PayloadId,
  PayloadMemberAuthAPI,
} from '../src/lib/payloadCourse/accessService'

type CollectionMap = Record<string, PayloadDocument[]>

class FakePayload implements PayloadMemberAuthAPI {
  calls: string[] = []
  sequence = 0

  constructor(private readonly collections: CollectionMap) {}

  async find(args: { collection: string; where?: Record<string, unknown>; limit?: number }) {
    this.calls.push(`find:${args.collection}`)
    const docs = (this.collections[args.collection] ?? []).filter((document) => {
      if (!args.where) return true
      return Object.entries(args.where).every(([field, condition]) => {
        if (!condition || typeof condition !== 'object') return document[field] === condition
        const record = condition as { equals?: unknown }
        return String(document[field] ?? '') === String(record.equals ?? '')
      })
    })
    return { docs: docs.slice(0, args.limit ?? docs.length) }
  }

  async findByID(args: { collection: string; id: PayloadId }) {
    const document = (this.collections[args.collection] ?? []).find(
      (entry) => String(entry.id) === String(args.id),
    )
    if (!document) throw new Error(`missing ${args.collection}:${args.id}`)
    return document
  }

  async create(args: { collection: string; data: Record<string, unknown> }) {
    this.calls.push(`create:${args.collection}`)
    const data = { ...structuredClone(args.data) }
    if (args.collection === 'payload_members' && typeof data.password === 'string') {
      delete data.password
      data.passwordHash = 'payload-managed-hash'
    }
    const document: PayloadDocument = { id: ++this.sequence, ...data }
    this.collections[args.collection] = this.collections[args.collection] ?? []
    this.collections[args.collection].push(document)
    return document
  }

  async update(args: { collection: string; id: PayloadId; data: Record<string, unknown> }) {
    this.calls.push(`update:${args.collection}`)
    const documents = this.collections[args.collection] ?? []
    const document = documents.find((entry) => String(entry.id) === String(args.id))
    if (!document) throw new Error(`missing ${args.collection}:${args.id}`)
    const data = { ...structuredClone(args.data) }
    if (args.collection === 'payload_members' && typeof data.password === 'string') {
      delete data.password
      data.passwordHash = 'payload-managed-hash'
    }
    Object.assign(document, data)
    return document
  }

  async login() {
    return { user: { id: 1 } }
  }

  async forgotPassword() {
    this.calls.push('forbidden:forgotPassword')
    return 'legacy-token'
  }

  async resetPassword() {
    this.calls.push('forbidden:resetPassword')
    return { user: { id: 1 } }
  }

  docs(collection: string) {
    return this.collections[collection] ?? []
  }
}

class MemoryActions implements MemberAccountActionRepository {
  records: MemberAccountActionRecord[] = []
  deliveries: Array<Record<string, unknown>> = []

  async findActiveAction(memberId: string, purpose: MemberAccountActionPurpose) {
    return this.records.find(
      (record) =>
        record.memberId === memberId &&
        record.purpose === purpose &&
        !record.consumedAt &&
        !record.invalidatedAt,
    ) ?? null
  }

  async replaceActiveAction(record: MemberAccountActionRecord) {
    for (const existing of this.records) {
      if (
        existing.memberId === record.memberId &&
        existing.purpose === record.purpose &&
        !existing.consumedAt &&
        !existing.invalidatedAt
      ) {
        existing.invalidatedAt = record.createdAt
      }
    }
    this.records.push(structuredClone(record))
  }

  async findActionByDigest(tokenDigest: string, purpose: MemberAccountActionPurpose) {
    return this.records.find(
      (record) => record.tokenDigest === tokenDigest && record.purpose === purpose,
    ) ?? null
  }

  async consumeAction(tokenDigest: string, purpose: MemberAccountActionPurpose, consumedAt: string) {
    const record = this.records.find(
      (candidate) =>
        candidate.tokenDigest === tokenDigest &&
        candidate.purpose === purpose &&
        !candidate.consumedAt &&
        !candidate.invalidatedAt &&
        new Date(candidate.expiresAt).getTime() > new Date(consumedAt).getTime(),
    )
    if (!record) return null
    record.consumedAt = consumedAt
    return record.memberId
  }

  async recordDelivery(event: Record<string, unknown>) {
    this.deliveries.push(structuredClone(event))
  }
}

class FakeTransport {
  deliveries: MemberAccountActionDelivery[] = []
  async send(delivery: MemberAccountActionDelivery) {
    this.deliveries.push(structuredClone(delivery))
    return { providerMessageId: `fake-${this.deliveries.length}` }
  }
}

async function run() {
  const payload = new FakePayload({
    payload_members: [],
    payload_member_profiles: [],
    payload_member_security_events: [],
    payload_audit_events: [],
    payload_email_events: [],
  })
  const repository = new MemoryActions()
  const transport = new FakeTransport()
  let token = 'invitation-action-value-that-is-never-stored'
  const service = createMemberAccountActionService({
    repository,
    transport,
    publicBaseUrl: 'https://preview.jpvbootcamp.test',
    now: () => new Date('2026-07-02T00:00:00.000Z'),
    randomToken: () => token,
  })

  const invitation = await inviteMember(payload, service, {
    administratorId: 'admin-1',
    email: ' Student@Example.Test ',
    displayName: 'Student',
  })
  assert.equal(invitation.ok, true)
  if (!invitation.ok) throw new Error('invitation failed')
  assert.equal(invitation.created, true)
  assert.equal(invitation.emailQueued, true)
  assert.equal(payload.docs('payload_members')[0]?.accountStatus, 'pending')
  assert.equal(payload.docs('payload_members')[0]?.password, undefined)
  assert.equal(payload.docs('payload_members')[0]?.passwordHash, 'payload-managed-hash')
  assert.equal(repository.records[0]?.purpose, 'member_invitation')
  assert.equal(JSON.stringify(repository.records).includes(token), false)
  assert.match(transport.deliveries[0]?.actionUrl ?? '', /set-password/)
  assert.equal(
    payload.docs('payload_member_security_events').at(-1)?.eventType,
    'invitation_created',
  )

  const setup = await completeMemberSetup(payload, service, {
    token,
    password: 'strong-password-value',
    passwordConfirmation: 'strong-password-value',
  })
  assert.deepEqual(setup, { ok: true, activated: true })
  assert.equal(payload.docs('payload_members')[0]?.accountStatus, 'active')
  assert.equal(payload.docs('payload_members')[0]?.passwordHash, 'payload-managed-hash')
  assert.equal(
    payload.docs('payload_member_security_events').some(
      (event) => event.eventType === 'invitation_consumed',
    ),
    true,
  )
  assert.equal(
    payload.docs('payload_email_events').at(-1)?.templateKey,
    'member-account-ready',
  )

  const reused = await completeMemberSetup(payload, service, {
    token,
    password: 'another-strong-password',
    passwordConfirmation: 'another-strong-password',
  })
  assert.equal(reused.ok, false)

  const unknownReset = await requestPasswordReset(payload, service, {
    email: 'unknown@example.test',
  })
  token = 'password-reset-action-value-that-is-never-stored'
  const knownReset = await requestPasswordReset(payload, service, {
    email: 'student@example.test',
  })
  assert.deepEqual(knownReset, unknownReset)

  const resetIssue = await requestPasswordReset(payload, service, {
    email: 'student@example.test',
  })
  assert.deepEqual(resetIssue, knownReset)
  assert.equal(repository.records.at(-1)?.purpose, 'password_reset')

  const reset = await completePasswordReset(payload, service, {
    token,
    password: 'replacement-password-value',
    passwordConfirmation: 'replacement-password-value',
  })
  assert.equal(reset.ok, true)
  assert.equal(
    payload.docs('payload_email_events').some(
      (event) => event.templateKey === 'member-password-changed',
    ),
    true,
  )
  assert.equal(payload.calls.includes('forbidden:forgotPassword'), false)
  assert.equal(payload.calls.includes('forbidden:resetPassword'), false)

  console.log('payload_member_invitation.test.ts passed')
}

void run()
