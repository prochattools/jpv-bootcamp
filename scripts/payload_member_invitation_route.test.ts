import assert from 'node:assert/strict'

import {
  createMemberAccountActionService,
  type MemberAccountActionDelivery,
  type MemberAccountActionPurpose,
  type MemberAccountActionRecord,
  type MemberAccountActionRepository,
} from '../src/lib/auth/memberAccountActions'
import { inviteMember } from '../src/lib/members/inviteMember'
import { handleMemberInvitationRequest } from '../src/lib/members/memberInvitationHttp'
import type {
  PayloadDocument,
  PayloadId,
  PayloadMemberAuthAPI,
} from '../src/lib/payloadCourse/accessService'

type CollectionMap = Record<string, PayloadDocument[]>

function relationValue(value: unknown): string {
  if (value && typeof value === 'object' && 'id' in value) {
    return String((value as { id: PayloadId }).id)
  }
  return String(value ?? '')
}

function matchesWhere(document: PayloadDocument, where?: Record<string, unknown>): boolean {
  if (!where) return true
  return Object.entries(where).every(([field, comparison]) => {
    if (!comparison || typeof comparison !== 'object') return document[field] === comparison
    const equals = (comparison as { equals?: unknown }).equals
    return relationValue(document[field]) === String(equals ?? '')
  })
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
    const data = structuredClone(args.data)
    if (args.collection === 'payload_members' && typeof data.password === 'string') {
      delete data.password
      data.passwordHash = 'payload-managed-hash'
    }
    const document: PayloadDocument = {
      id: `${args.collection}_${++this.sequence}`,
      ...data,
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
    return { user: { id: 'member' } }
  }

  async forgotPassword() {
    this.calls.push('forbidden:forgotPassword')
    return 'legacy-action-value'
  }

  async resetPassword() {
    this.calls.push('forbidden:resetPassword')
    return { user: { id: 'member' } }
  }

  docs(collection: string) {
    return this.collections[collection] ?? []
  }
}

class MemoryActionRepository implements MemberAccountActionRepository {
  readonly records: MemberAccountActionRecord[] = []
  readonly deliveries: Array<Record<string, unknown>> = []

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

  async consumeAction(
    tokenDigest: string,
    purpose: MemberAccountActionPurpose,
    consumedAt: string,
  ) {
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
  readonly deliveries: MemberAccountActionDelivery[] = []

  async send(delivery: MemberAccountActionDelivery) {
    this.deliveries.push(structuredClone(delivery))
    return { providerMessageId: `fake-${this.deliveries.length}` }
  }
}

function createFixture(existingMember?: PayloadDocument) {
  const payload = new FakePayload({
    payload_members: existingMember ? [existingMember] : [],
    payload_member_profiles: [],
    payload_member_security_events: [],
    payload_audit_events: [],
    payload_email_events: [],
  })
  const repository = new MemoryActionRepository()
  const transport = new FakeTransport()
  const service = createMemberAccountActionService({
    repository,
    transport,
    publicBaseUrl: 'https://preview.jpvbootcamp.test',
    now: () => new Date('2026-07-02T03:00:00.000Z'),
    randomToken: () => 'invitation-action-value-never-persisted',
    sendCooldownMs: 60_000,
    maxSendAttempts: 3,
  })

  return { payload, repository, transport, service }
}

function jsonRequest(body: unknown): Request {
  return new Request('https://preview.jpvbootcamp.test/api/admin/member-invitations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function responseBody(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>
}

function createHandlerDependencies(
  fixture: ReturnType<typeof createFixture>,
  collection: string | null,
) {
  return {
    async authenticate() {
      return collection ? { id: 'admin_1', collection } : null
    },
    async invite(input: Parameters<typeof inviteMember>[2]) {
      return inviteMember(fixture.payload, fixture.service, input)
    },
  }
}

async function testAuthorizationAndValidation() {
  const fixture = createFixture()
  const anonymous = await handleMemberInvitationRequest(
    jsonRequest({ email: 'member@example.test' }),
    createHandlerDependencies(fixture, null),
  )
  assert.equal(anonymous.status, 403)

  const memberSession = await handleMemberInvitationRequest(
    jsonRequest({ email: 'member@example.test' }),
    createHandlerDependencies(fixture, 'payload_members'),
  )
  assert.equal(memberSession.status, 403)
  assert.equal(fixture.payload.docs('payload_members').length, 0)

  const malformed = await handleMemberInvitationRequest(
    new Request('https://preview.jpvbootcamp.test/api/admin/member-invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid-json',
    }),
    createHandlerDependencies(fixture, 'payload_users'),
  )
  assert.equal(malformed.status, 400)
  assert.equal((await responseBody(malformed)).error, 'invalid_request')

  for (const email of ['bad-email', `${'a'.repeat(310)}@example.test`]) {
    const response = await handleMemberInvitationRequest(
      jsonRequest({ email }),
      createHandlerDependencies(fixture, 'payload_users'),
    )
    assert.equal(response.status, 400)
    assert.equal((await responseBody(response)).error, 'invalid_email')
  }

  const displayName = await handleMemberInvitationRequest(
    jsonRequest({ email: 'member@example.test', displayName: { unsafe: true } }),
    createHandlerDependencies(fixture, 'payload_users'),
  )
  assert.equal(displayName.status, 400)
  assert.equal((await responseBody(displayName)).error, 'invalid_display_name')
}

async function testNewAndExistingPendingInvitations() {
  const createdFixture = createFixture()
  const createdResponse = await handleMemberInvitationRequest(
    jsonRequest({ email: ' New.Member@Example.Test ', displayName: 'New Member' }),
    createHandlerDependencies(createdFixture, 'payload_users'),
  )
  assert.equal(createdResponse.status, 200)
  const createdBody = await responseBody(createdResponse)
  assert.equal(createdBody.ok, true)
  assert.equal(createdBody.created, true)
  assert.equal(createdBody.delivery, 'queued')
  assert.equal(createdBody.emailQueued, true)
  assert.equal(JSON.stringify(createdBody).includes('token'), false)
  assert.equal(JSON.stringify(createdBody).includes('actionUrl'), false)
  assert.equal(JSON.stringify(createdBody).includes('password'), false)

  const createdMember = createdFixture.payload.docs('payload_members')[0]
  assert.equal(createdMember?.email, 'new.member@example.test')
  assert.equal(createdMember?.accountStatus, 'pending')
  assert.equal(createdMember?.password, undefined)
  assert.equal(createdMember?.passwordHash, 'payload-managed-hash')
  assert.equal(createdFixture.repository.records[0]?.purpose, 'member_invitation')
  assert.equal(
    JSON.stringify(createdFixture.repository.records).includes('invitation-action-value-never-persisted'),
    false,
  )
  assert.equal(createdFixture.transport.deliveries.length, 1)
  assert.equal(createdFixture.payload.calls.includes('forbidden:forgotPassword'), false)
  assert.equal(createdFixture.payload.calls.includes('forbidden:resetPassword'), false)

  const pendingFixture = createFixture({
    id: 'member_pending',
    email: 'pending@example.test',
    accountStatus: 'pending',
  })
  const first = await handleMemberInvitationRequest(
    jsonRequest({ email: 'pending@example.test' }),
    createHandlerDependencies(pendingFixture, 'payload_users'),
  )
  assert.equal(first.status, 200)
  assert.equal((await responseBody(first)).created, false)
  assert.equal(pendingFixture.payload.docs('payload_members').length, 1)

  const duplicate = await handleMemberInvitationRequest(
    jsonRequest({ email: 'pending@example.test' }),
    createHandlerDependencies(pendingFixture, 'payload_users'),
  )
  assert.equal(duplicate.status, 200)
  const duplicateBody = await responseBody(duplicate)
  assert.equal(duplicateBody.created, false)
  assert.equal(duplicateBody.delivery, 'suppressed')
  assert.equal(duplicateBody.emailQueued, false)
  assert.equal(pendingFixture.transport.deliveries.length, 1)
  assert.equal(pendingFixture.repository.records.length, 1)
}

async function testIneligibleExistingMembers() {
  for (const accountStatus of ['active', 'blocked', 'suspended', 'deleted']) {
    const fixture = createFixture({
      id: `member_${accountStatus}`,
      email: `${accountStatus}@example.test`,
      accountStatus,
    })
    const response = await handleMemberInvitationRequest(
      jsonRequest({ email: `${accountStatus}@example.test` }),
      createHandlerDependencies(fixture, 'payload_users'),
    )
    assert.equal(response.status, 409)
    assert.equal((await responseBody(response)).error, 'account_ineligible')
    assert.equal(fixture.repository.records.length, 0)
    assert.equal(fixture.transport.deliveries.length, 0)
  }
}

async function main() {
  await testAuthorizationAndValidation()
  await testNewAndExistingPendingInvitations()
  await testIneligibleExistingMembers()
  console.log('payload_member_invitation_route.test.ts passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
