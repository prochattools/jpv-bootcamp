import assert from 'node:assert/strict'

import { createRoomCommand } from '../src/lib/rooms/roomCommands'
import { isRoomMemberEntitled } from '../src/lib/rooms/roomAccess'
import type { PayloadCourseWriteAPI, PayloadDocument, PayloadId } from '../src/lib/payloadCourse/accessService'

type Collections = Record<string, PayloadDocument[]>

function relationId(value: unknown): string {
  if (value && typeof value === 'object' && 'id' in value) return String((value as { id: PayloadId }).id)
  return String(value)
}

function matches(value: unknown, condition: unknown): boolean {
  if (!condition || typeof condition !== 'object') return value === condition
  const record = condition as Record<string, unknown>
  if ('equals' in record) return relationId(value) === String(record.equals)
  if ('not_equals' in record) return relationId(value) !== String(record.not_equals)
  return false
}

function matchesWhere(document: PayloadDocument, where?: Record<string, unknown>): boolean {
  if (!where) return true
  if (Array.isArray(where.and)) return where.and.every((entry) => matchesWhere(document, entry as Record<string, unknown>))
  return Object.entries(where).every(([field, condition]) => matches(document[field], condition))
}

class FakePayload implements PayloadCourseWriteAPI {
  private nextId = 1

  constructor(readonly collections: Collections) {}

  async find(args: { collection: string; where?: Record<string, unknown>; limit?: number }) {
    const docs = (this.collections[args.collection] ?? []).filter((doc) => matchesWhere(doc, args.where))
    return { docs: docs.slice(0, args.limit ?? docs.length), totalDocs: docs.length }
  }

  async findByID(args: { collection: string; id: PayloadId }) {
    const document = (this.collections[args.collection] ?? []).find((doc) => String(doc.id) === String(args.id))
    if (!document) throw new Error(`missing ${args.collection}:${String(args.id)}`)
    return document
  }

  async create(args: { collection: string; data: Record<string, unknown> }) {
    const id = args.collection === 'live_sessions' ? 500 : `${args.collection}_${this.nextId++}`
    const document = { id, ...args.data }
    this.collections[args.collection] = [...(this.collections[args.collection] ?? []), document]
    return document
  }

  async update(args: { collection: string; id: PayloadId; data: Record<string, unknown> }) {
    const docs = this.collections[args.collection] ?? []
    const index = docs.findIndex((doc) => String(doc.id) === String(args.id))
    if (index < 0) throw new Error(`missing ${args.collection}:${String(args.id)}`)
    docs[index] = { ...docs[index], ...args.data }
    return docs[index]
  }
}

function member(id: string, email: string): PayloadDocument {
  return {
    id,
    email,
    accountStatus: 'active',
    emailVerifiedAt: '2026-08-01T00:00:00.000Z',
  }
}

async function run() {
  const payload = new FakePayload({
    payload_users: [{ id: 99, email: 'admin@example.com', portalMember: 'm1' }],
    payload_members: [
      member('m1', 'admin@example.com'),
      member('m2', 'two@example.com'),
      member('m3', 'three@example.com'),
      member('m4', 'four@example.com'),
    ],
    payload_member_profiles: [],
    payload_room_access: [],
    payload_email_events: [],
    payload_member_notifications: [],
    payload_admin_notifications: [],
  })

  const result = await createRoomCommand(
    { payload, adminId: '99', adminEmail: 'admin@example.com' },
    {
      title: 'Creator invitation regression room',
      scheduledAt: '2026-08-31T19:00:00.000Z',
      audience: 'selected',
      targetMemberIds: ['m2', 'm3', 'm4'],
    },
  )

  assert.equal(result.addedMembers, 4, 'the creator must be reconciled with the three selected members')
  assert.deepEqual(
    payload.collections.payload_room_access.map((grant) => String(grant.member)).sort(),
    ['m1', 'm2', 'm3', 'm4'],
  )
  assert.equal(
    payload.collections.payload_email_events.filter((event) => event.templateKey === 'room-invitation').length,
    4,
    'each entitled member, including the creator, receives an invitation email event',
  )
  assert.equal(
    payload.collections.payload_member_notifications.filter((notification) => notification.type === 'room_invitation').length,
    4,
    'each entitled member, including the creator, receives an in-app invitation',
  )

  // A Room created before the creator grant fix remains accessible without a
  // production data rewrite; the next reconciliation will add its grant.
  const legacyRoom = { id: 501, hostUser: 99, audience: 'selected', targetMemberIds: ['m2'], status: 'scheduled' }
  assert.equal(await isRoomMemberEntitled(payload, legacyRoom, 'm1'), true)

  console.log('room_creator_invitation.test.ts passed')
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
