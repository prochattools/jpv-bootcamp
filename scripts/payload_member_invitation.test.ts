import assert from 'node:assert/strict'

import { inviteMember } from '../src/lib/members/inviteMember'
import { requestPasswordReset } from '../src/lib/members/requestPasswordReset'
import type {
  PayloadDocument,
  PayloadId,
  PayloadMemberAuthAPI,
} from '../src/lib/payloadCourse/accessService'

type CollectionMap = Record<string, PayloadDocument[]>

type Call = {
  method: 'find' | 'create' | 'update' | 'forgotPassword' | 'resetPassword'
  collection?: string
  data?: Record<string, unknown>
  where?: Record<string, unknown>
  id?: PayloadId
  disableEmail?: boolean
}

function relationValue(value: unknown): string {
  if (value && typeof value === 'object' && 'id' in value) {
    return String((value as { id: PayloadId }).id)
  }
  return String(value)
}

function matchesWhere(doc: PayloadDocument, where?: Record<string, unknown>): boolean {
  if (!where) return true
  return Object.entries(where).every(([field, condition]) => {
    if (!condition || typeof condition !== 'object') return doc[field] === condition
    const record = condition as Record<string, unknown>
    if ('equals' in record) return relationValue(doc[field]) === String(record.equals)
    return false
  })
}

class FakePayload implements PayloadMemberAuthAPI {
  readonly calls: Call[] = []
  private nextId = 1
  private nextToken = 1

  constructor(
    private readonly collections: CollectionMap,
    private readonly tokenFactory: () => string | null = () => `raw-token-${this.nextToken++}`,
  ) {}

  async find(args: {
    collection: string
    where?: Record<string, unknown>
    limit?: number
    depth?: number
    sort?: string
    overrideAccess?: boolean
  }) {
    this.calls.push({ method: 'find', collection: args.collection, where: args.where })
    const docs = (this.collections[args.collection] ?? []).filter((doc) => matchesWhere(doc, args.where))
    return { docs: docs.slice(0, args.limit ?? docs.length) }
  }

  async findByID(args: { collection: string; id: PayloadId }) {
    const doc = (this.collections[args.collection] ?? []).find((item) => String(item.id) === String(args.id))
    if (!doc) throw new Error(`missing ${args.collection}:${args.id}`)
    return doc
  }

  async create(args: {
    collection: string
    data: Record<string, unknown>
    overrideAccess?: boolean
  }) {
    this.calls.push({ method: 'create', collection: args.collection, data: args.data })
    const doc = { id: `${args.collection}_${this.nextId++}`, ...args.data }
    this.collections[args.collection] = this.collections[args.collection] ?? []
    this.collections[args.collection].push(doc)
    return doc
  }

  async update(args: {
    collection: string
    id: PayloadId
    data: Record<string, unknown>
    overrideAccess?: boolean
  }) {
    this.calls.push({ method: 'update', collection: args.collection, id: args.id, data: args.data })
    const docs = this.collections[args.collection] ?? []
    const index = docs.findIndex((doc) => String(doc.id) === String(args.id))
    if (index < 0) throw new Error(`missing ${args.collection}:${args.id}`)
    docs[index] = { ...docs[index], ...args.data }
    return docs[index]
  }

  async forgotPassword(args: {
    collection: 'payload_members'
    data: { email: string }
    disableEmail: true
  }) {
    this.calls.push({
      method: 'forgotPassword',
      collection: args.collection,
      data: args.data,
      disableEmail: args.disableEmail,
    })
    return this.tokenFactory()
  }

  async resetPassword(args: {
    collection: 'payload_members'
    data: { password: string; token: string }
  }) {
    this.calls.push({ method: 'resetPassword', collection: args.collection, data: args.data })
    return { user: { id: 'member' } }
  }

  docs(collection: string) {
    return this.collections[collection] ?? []
  }
}

function persistedText(payload: FakePayload, collections: string[]): string {
  return JSON.stringify(collections.flatMap((collection) => payload.docs(collection)))
}

async function testNewInvitationAndAttribution() {
  const payload = new FakePayload({
    payload_members: [],
    payload_member_profiles: [],
    payload_member_security_events: [],
    payload_audit_events: [],
    payload_email_events: [],
  })

  const result = await inviteMember(payload, {
    administratorId: 'admin_1',
    email: '  STUDENT@Example.COM ',
    displayName: '  Student   Name ',
    baseUrl: 'https://example.com',
  })

  assert.deepEqual(result, {
    ok: true,
    memberId: 'payload_members_1',
    created: true,
    emailQueued: true,
  })
  const member = payload.docs('payload_members')[0]
  assert.equal(member.email, 'student@example.com')
  assert.equal(member.accountStatus, 'pending')
  assert.equal(payload.docs('payload_member_profiles')[0].displayName, 'Student Name')

  const forgotCall = payload.calls.find((call) => call.method === 'forgotPassword')
  assert.deepEqual(forgotCall?.data, { email: 'student@example.com' })
  assert.equal(forgotCall?.disableEmail, true)

  const security = payload.docs('payload_member_security_events')[0]
  assert.equal(security.eventType, 'password_reset_requested')
  assert.equal((security.metadata as Record<string, unknown>).administratorId, 'admin_1')

  const audit = payload.docs('payload_audit_events')[0]
  assert.equal(audit.actorType, 'admin')
  assert.equal(audit.actorId, 'admin_1')
  assert.equal(audit.action, 'member.invited.created')

  const email = payload.docs('payload_email_events')[0]
  assert.equal(email.toEmail, 'student@example.com')
  assert.match(String((email.metadata as Record<string, unknown>).actionUrl), /\/set-password\?token=raw-token-1/)

  const protectedRecords = persistedText(payload, [
    'payload_member_security_events',
    'payload_audit_events',
  ])
  assert.equal(protectedRecords.includes('raw-token-1'), false)
  assert.equal(protectedRecords.includes(String(member.password)), false)
}

async function testReinvitationAndDedupe() {
  const payload = new FakePayload({
    payload_members: [{ id: 'member_pending', email: 'pending@example.com', accountStatus: 'pending' }],
    payload_member_profiles: [],
    payload_member_security_events: [],
    payload_audit_events: [],
    payload_email_events: [],
  }, () => 'same-raw-token')

  const first = await inviteMember(payload, {
    administratorId: 'admin_2',
    email: 'pending@example.com',
    baseUrl: 'https://example.com',
  })
  const second = await inviteMember(payload, {
    administratorId: 'admin_2',
    email: 'pending@example.com',
    baseUrl: 'https://example.com',
  })

  assert.equal(first.ok && first.created, false)
  assert.equal(second.ok && second.created, false)
  assert.equal(first.ok && first.emailQueued, true)
  assert.equal(second.ok && second.emailQueued, false)
  assert.equal(payload.docs('payload_members').length, 1)
  assert.equal(payload.docs('payload_email_events').length, 1)
  assert.equal(payload.docs('payload_audit_events')[0].action, 'member.invited.reissued')
}

async function testInvitationRefusal() {
  for (const status of ['blocked', 'deleted']) {
    const payload = new FakePayload({
      payload_members: [{ id: `member_${status}`, email: `${status}@example.com`, accountStatus: status }],
      payload_member_profiles: [],
      payload_member_security_events: [],
      payload_audit_events: [],
      payload_email_events: [],
    })

    const result = await inviteMember(payload, {
      administratorId: 'admin_3',
      email: `${status}@example.com`,
      baseUrl: 'https://example.com',
    })

    assert.deepEqual(result, { ok: false, error: 'account_ineligible' })
    assert.equal(payload.calls.some((call) => call.method === 'forgotPassword'), false)
    assert.equal(payload.docs('payload_email_events').length, 0)
  }
}

async function testGenericMissingAndSuppressedReset() {
  const genericMessage = 'If an eligible account exists, password reset instructions have been sent.'

  const missing = new FakePayload({ payload_members: [], payload_email_events: [] })
  const missingResult = await requestPasswordReset(missing, {
    email: 'missing@example.com',
    baseUrl: 'https://example.com',
  })
  assert.deepEqual(missingResult, { ok: true, message: genericMessage })
  assert.equal(missing.calls.some((call) => call.method === 'forgotPassword'), false)

  for (const status of ['blocked', 'deleted']) {
    const payload = new FakePayload({
      payload_members: [{ id: status, email: `${status}@example.com`, accountStatus: status }],
      payload_email_events: [],
    })
    const result = await requestPasswordReset(payload, {
      email: `${status}@example.com`,
      baseUrl: 'https://example.com',
    })
    assert.deepEqual(result, { ok: true, message: genericMessage })
    assert.equal(payload.calls.some((call) => call.method === 'forgotPassword'), false)
  }
}

async function testEligibleResetRequest() {
  const payload = new FakePayload({
    payload_members: [{ id: 'member_active', email: 'student@example.com', accountStatus: 'active' }],
    payload_member_security_events: [],
    payload_email_events: [],
  }, () => 'reset-raw-token')

  const result = await requestPasswordReset(payload, {
    email: '  STUDENT@EXAMPLE.COM ',
    baseUrl: 'https://example.com',
  })

  assert.equal(result.ok, true)
  const forgotCall = payload.calls.find((call) => call.method === 'forgotPassword')
  assert.deepEqual(forgotCall?.data, { email: 'student@example.com' })
  assert.equal(forgotCall?.disableEmail, true)

  const security = payload.docs('payload_member_security_events')[0]
  assert.equal(security.eventType, 'password_reset_requested')
  assert.equal((security.metadata as Record<string, unknown>).purpose, 'password_reset')

  const email = payload.docs('payload_email_events')[0]
  assert.equal(email.templateKey, 'member-password-reset')
  assert.match(String((email.metadata as Record<string, unknown>).actionUrl), /\/reset-password\?token=reset-raw-token/)

  const protectedRecords = persistedText(payload, ['payload_member_security_events'])
  assert.equal(protectedRecords.includes('reset-raw-token'), false)
}

async function main() {
  await testNewInvitationAndAttribution()
  await testReinvitationAndDedupe()
  await testInvitationRefusal()
  await testGenericMissingAndSuppressedReset()
  await testEligibleResetRequest()
  console.log('payload_member_invitation.test.ts passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
