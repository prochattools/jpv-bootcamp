import assert from 'node:assert/strict'

import {
  blockMember,
  deleteMember,
  restoreMember,
  suspendMember,
} from '../src/lib/members/accountStatus'
import { changeMemberPassword } from '../src/lib/members/changeMemberPassword'
import { cleanupSensitiveEmailEvents } from '../src/lib/members/cleanupSensitiveEmailEvents'
import { isEligibleCurrentMember } from '../src/lib/members/currentMember'
import type {
  PayloadDocument,
  PayloadId,
  PayloadMemberAuthAPI,
} from '../src/lib/payloadCourse/accessService'

type CollectionMap = Record<string, PayloadDocument[]>

type LoginMode = 'success' | 'failure'

function relationValue(value: unknown): string {
  if (value && typeof value === 'object' && 'id' in value) {
    return String((value as { id: PayloadId }).id)
  }
  return String(value)
}

function matchesCondition(value: unknown, condition: unknown): boolean {
  if (!condition || typeof condition !== 'object') return value === condition
  const record = condition as Record<string, unknown>
  if ('equals' in record) return relationValue(value) === String(record.equals)
  if ('in' in record && Array.isArray(record.in)) return record.in.map(String).includes(String(value))
  if ('less_than' in record) return String(value) < String(record.less_than)
  return false
}

function matchesWhere(doc: PayloadDocument, where?: Record<string, unknown>): boolean {
  if (!where) return true
  if (Array.isArray(where.and)) {
    return where.and.every((entry) => matchesWhere(doc, entry as Record<string, unknown>))
  }
  return Object.entries(where).every(([field, condition]) => matchesCondition(doc[field], condition))
}

class FakePayload implements PayloadMemberAuthAPI {
  private nextId = 1
  loginMode: LoginMode = 'success'
  loginUserId: PayloadId = 'member_1'

  constructor(private readonly collections: CollectionMap) {}

  async find(args: {
    collection: string
    where?: Record<string, unknown>
    limit?: number
    depth?: number
    sort?: string
    overrideAccess?: boolean
  }) {
    const docs = (this.collections[args.collection] ?? []).filter((doc) => matchesWhere(doc, args.where))
    return { docs: docs.slice(0, args.limit ?? docs.length) }
  }

  async findByID(args: { collection: string; id: PayloadId }) {
    const doc = (this.collections[args.collection] ?? []).find((item) => String(item.id) === String(args.id))
    if (!doc) throw new Error(`missing ${args.collection}:${args.id}`)
    return doc
  }

  async create(args: { collection: string; data: Record<string, unknown>; overrideAccess?: boolean }) {
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
    const docs = this.collections[args.collection] ?? []
    const index = docs.findIndex((doc) => String(doc.id) === String(args.id))
    if (index < 0) throw new Error(`missing ${args.collection}:${args.id}`)
    const data = { ...args.data }
    if (args.collection === 'payload_members' && typeof data.password === 'string') {
      delete data.password
      data.passwordHash = 'payload-managed-hash'
    }
    docs[index] = { ...docs[index], ...data }
    return docs[index]
  }

  async login(_args: {
    collection: 'payload_members'
    data: { email: string; password: string }
    overrideAccess?: boolean
  }) {
    if (this.loginMode === 'failure') throw new Error('invalid login')
    return { user: { id: this.loginUserId } }
  }

  async forgotPassword() {
    return 'unused-token'
  }

  async resetPassword() {
    return { user: { id: 'member_1' } }
  }

  docs(collection: string) {
    return this.collections[collection] ?? []
  }
}

function buildPayload(status = 'active') {
  return new FakePayload({
    payload_members: [
      {
        id: 'member_1',
        email: 'member@example.com',
        accountStatus: status,
        billingHoldReason: null,
        emailVerifiedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    payload_member_security_events: [],
    payload_audit_events: [],
    payload_email_events: [],
  })
}

const validInput = {
  memberId: 'member_1',
  email: 'member@example.com',
  currentPassword: 'current-password-123',
  newPassword: 'new-password-456',
  newPasswordConfirmation: 'new-password-456',
}

async function testPasswordChangeControls() {
  {
    const payload = buildPayload()
    const result = await changeMemberPassword(payload, validInput)
    assert.deepEqual(result, { ok: true, confirmationQueued: false })
    assert.equal(payload.docs('payload_member_security_events').length, 1)
    assert.equal(payload.docs('payload_member_security_events')[0].eventType, 'password_changed')
    const stored = JSON.stringify(payload.docs('payload_member_security_events'))
    assert.equal(stored.includes(validInput.currentPassword), false)
    assert.equal(stored.includes(validInput.newPassword), false)
  }

  {
    const payload = buildPayload()
    payload.loginMode = 'failure'
    assert.deepEqual(await changeMemberPassword(payload, validInput), {
      ok: false,
      error: 'invalid_current_password',
    })
    assert.equal(payload.docs('payload_member_security_events').length, 0)
  }

  {
    const payload = buildPayload()
    assert.deepEqual(
      await changeMemberPassword(payload, {
        ...validInput,
        newPasswordConfirmation: 'different-password',
      }),
      { ok: false, error: 'password_mismatch' },
    )
    assert.deepEqual(
      await changeMemberPassword(payload, {
        ...validInput,
        newPassword: 'short',
        newPasswordConfirmation: 'short',
      }),
      { ok: false, error: 'password_too_short' },
    )
    assert.deepEqual(
      await changeMemberPassword(payload, {
        ...validInput,
        newPassword: validInput.currentPassword,
        newPasswordConfirmation: validInput.currentPassword,
      }),
      { ok: false, error: 'password_reused' },
    )
    assert.equal(payload.docs('payload_member_security_events').length, 0)
  }

  {
    const payload = buildPayload()
    payload.loginUserId = 'different_member'
    assert.deepEqual(await changeMemberPassword(payload, validInput), {
      ok: false,
      error: 'invalid_current_password',
    })
  }

  {
    const payload = buildPayload('blocked')
    assert.deepEqual(await changeMemberPassword(payload, validInput), {
      ok: false,
      error: 'account_ineligible',
    })
    assert.equal(payload.docs('payload_member_security_events').length, 0)
  }
}

function testCurrentMemberEligibility() {
  assert.equal(isEligibleCurrentMember({ accountStatus: 'active' }), true)
  for (const accountStatus of ['pending', 'blocked', 'suspended', 'deleted']) {
    assert.equal(isEligibleCurrentMember({ accountStatus }), false)
  }
}

async function testBlockAndRestore() {
  const payload = buildPayload()
  const blocked = await blockMember(payload, {
    memberId: 'member_1',
    actor: { type: 'admin', id: 'admin_1' },
    reason: 'manual review',
  })
  assert.equal(blocked.changed, true)
  assert.equal(blocked.member.accountStatus, 'blocked')
  assert.equal(payload.docs('payload_member_security_events')[0].eventType, 'account_blocked')

  const blockNoop = await blockMember(payload, {
    memberId: 'member_1',
    actor: { type: 'admin', id: 'admin_1' },
    reason: 'manual review',
  })
  assert.equal(blockNoop.changed, false)
  assert.equal(blockNoop.auditEvent.action, 'member.block.noop')

  const restored = await restoreMember(payload, {
    memberId: 'member_1',
    actor: { type: 'admin', id: 'admin_1' },
    reason: 'review complete',
  })
  assert.equal(restored.changed, true)
  assert.equal(restored.member.accountStatus, 'active')
  assert.equal(
    payload.docs('payload_member_security_events').some((event) => event.eventType === 'account_restored'),
    true,
  )

  const restoreNoop = await restoreMember(payload, {
    memberId: 'member_1',
    actor: { type: 'admin', id: 'admin_1' },
    reason: 'review complete',
  })
  assert.equal(restoreNoop.changed, false)
  assert.equal(restoreNoop.auditEvent.action, 'member.restore.noop')
}

async function testSuspendAndDeleteNotices() {
  const suspendedPayload = buildPayload()
  const suspended = await suspendMember(suspendedPayload, {
    memberId: 'member_1',
    actor: { type: 'admin', id: 'admin_1' },
    reason: 'private moderation detail',
    baseUrl: 'https://preview.jpvbootcamp.test',
  })
  assert.equal(suspended.changed, true)
  assert.equal(suspended.member.accountStatus, 'suspended')
  assert.equal(
    suspendedPayload.docs('payload_member_security_events').at(-1)?.eventType,
    'account_suspended',
  )
  const suspendedEmail = suspendedPayload.docs('payload_email_events').at(-1)
  assert.equal(suspendedEmail?.templateKey, 'access-suspended')
  assert.equal(JSON.stringify(suspendedEmail?.metadata).includes('private moderation detail'), false)

  const deletedPayload = buildPayload()
  const deleted = await deleteMember(deletedPayload, {
    memberId: 'member_1',
    actor: { type: 'admin', id: 'admin_1' },
    reason: 'private deletion detail',
    baseUrl: 'https://preview.jpvbootcamp.test',
  })
  assert.equal(deleted.changed, true)
  assert.equal(deleted.member.accountStatus, 'deleted')
  assert.equal(
    deletedPayload.docs('payload_member_security_events').at(-1)?.eventType,
    'account_deleted',
  )
  const deletedEmail = deletedPayload.docs('payload_email_events').at(-1)
  assert.equal(deletedEmail?.templateKey, 'access-deleted')
  assert.equal(JSON.stringify(deletedEmail?.metadata).includes('private deletion detail'), false)
}

async function testSensitiveEmailCleanup() {
  const now = new Date('2026-06-23T12:00:00.000Z')
  const payload = new FakePayload({
    payload_email_events: [
      {
        id: 'expired_invite',
        templateKey: 'member-invitation',
        deliveryStatus: 'queued',
        createdAt: '2026-06-23T10:00:00.000Z',
        metadata: { purpose: 'member_setup', actionUrl: 'https://x.test/set-password?token=invite-raw' },
      },
      {
        id: 'expired_reset',
        templateKey: 'member-password-reset',
        deliveryStatus: 'failed',
        createdAt: '2026-06-23T10:30:00.000Z',
        failureReason: 'provider unavailable',
        metadata: { purpose: 'password_reset', actionUrl: 'https://x.test/reset?token=reset-raw' },
      },
      {
        id: 'recent_reset',
        templateKey: 'member-password-reset',
        deliveryStatus: 'queued',
        createdAt: '2026-06-23T11:30:00.000Z',
        metadata: { actionUrl: 'https://x.test/reset?token=recent-raw' },
      },
      {
        id: 'sent_reset',
        templateKey: 'member-password-reset',
        deliveryStatus: 'sent',
        createdAt: '2026-06-23T10:00:00.000Z',
        metadata: { actionUrl: 'https://x.test/reset?token=sent-raw' },
      },
      {
        id: 'unrelated',
        templateKey: 'course-welcome',
        deliveryStatus: 'queued',
        createdAt: '2026-06-23T10:00:00.000Z',
        metadata: { actionUrl: 'https://x.test/course?token=unrelated-raw' },
      },
    ],
  })

  const result = await cleanupSensitiveEmailEvents(payload, { now })
  assert.equal(result.redacted, 2)
  assert.deepEqual(new Set(result.eventIds), new Set(['expired_invite', 'expired_reset']))

  const expired = payload.docs('payload_email_events').filter((event) =>
    ['expired_invite', 'expired_reset'].includes(String(event.id)),
  )
  const expiredText = JSON.stringify(expired)
  assert.equal(expiredText.includes('actionUrl'), false)
  assert.equal(expiredText.includes('invite-raw'), false)
  assert.equal(expiredText.includes('reset-raw'), false)

  for (const id of ['recent_reset', 'sent_reset', 'unrelated']) {
    const event = payload.docs('payload_email_events').find((item) => item.id === id)
    assert.equal(JSON.stringify(event).includes('actionUrl'), true)
  }
}

async function main() {
  await testPasswordChangeControls()
  testCurrentMemberEligibility()
  await testBlockAndRestore()
  await testSuspendAndDeleteNotices()
  await testSensitiveEmailCleanup()
  console.log('payload_member_security_controls.test.ts passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
