import assert from 'node:assert/strict'

import { resolveRoomAudience } from '../src/lib/rooms/audience'
import { isRoomMemberEntitled, roomAccessEventKey, synchronizeRoomAccess } from '../src/lib/rooms/roomAccess'
import { notifyRoomMember } from '../src/lib/rooms/roomNotifications'
import { roomLiveKitPermissions } from '../src/lib/rooms/livekitPermissions'
import { buildLiveKitToken } from '../src/lib/livekit-jwt'
import type { PayloadCourseWriteAPI, PayloadDocument, PayloadId } from '../src/lib/payloadCourse/accessService'

type Collections = Record<string, PayloadDocument[]>

function relationId(value: unknown): string {
  if (value && typeof value === 'object' && 'id' in value) return String((value as { id: PayloadId }).id)
  return String(value)
}

function matches(value: unknown, condition: unknown): boolean {
  if (!condition || typeof condition !== 'object') return value === condition
  const record = condition as Record<string, unknown>
  if ('equals' in record) return Array.isArray(value) ? value.some((item) => relationId(item) === String(record.equals)) : relationId(value) === String(record.equals)
  if ('in' in record && Array.isArray(record.in)) return record.in.map(String).includes(relationId(value))
  if ('not_equals' in record) return relationId(value) !== String(record.not_equals)
  return false
}

function matchesWhere(document: PayloadDocument, where?: Record<string, unknown>): boolean {
  if (!where) return true
  if (Array.isArray(where.and)) return where.and.every((entry) => matchesWhere(document, entry as Record<string, unknown>))
  if (Array.isArray(where.or)) return where.or.some((entry) => matchesWhere(document, entry as Record<string, unknown>))
  return Object.entries(where).every(([field, condition]) => matches(document[field], condition))
}

class FakePayload implements PayloadCourseWriteAPI {
  private nextId = 100
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
    const document = { id: `${args.collection}_${this.nextId++}`, ...args.data }
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

function member(id: string, email: string, eligible = true): PayloadDocument {
  return { id, email, accountStatus: eligible ? 'active' : 'blocked', emailVerifiedAt: eligible ? '2026-01-01T00:00:00.000Z' : null }
}

function buildPayload(): FakePayload {
  return new FakePayload({
    payload_members: [member('m1', 'one@example.com'), member('m2', 'two@example.com'), member('m3', 'three@example.com', false), member('m4', 'four@example.com')],
    payload_member_profiles: [{ id: 'p1', member: 'm1', displayName: 'One' }, { id: 'p2', member: 'm2', displayName: 'Two' }],
    payload_member_groups: [
      { id: 'g1', status: 'active', members: ['m1', 'm2'] },
      { id: 'g2', status: 'active', members: ['m2', 'm4'] },
      { id: 'g3', status: 'archived', members: ['m1', 'm4'] },
    ],
    payload_room_access: [],
    payload_email_events: [],
    payload_member_notifications: [],
  })
}

async function run() {
  const payload = buildPayload()

  const groupAudience = await resolveRoomAudience(payload, { id: 'room-1', audience: 'groups', targetGroupIds: ['g1', 'g2', 'g3'] })
  assert.deepEqual(groupAudience.map((item) => item.memberId), ['m1', 'm2', 'm4'])
  assert.deepEqual(groupAudience.find((item) => item.memberId === 'm2')?.sources, ['member_group'])

  const allAudience = await resolveRoomAudience(payload, { id: 'room-2', audience: 'all' })
  assert.deepEqual(allAudience.map((item) => item.memberId), ['m1', 'm2', 'm4'])

  const selectedAudience = await resolveRoomAudience(payload, { id: 'room-3', audience: 'selected', targetMemberIds: ['m1', 'm1', 'm3'] })
  assert.deepEqual(selectedAudience.map((item) => item.memberId), ['m1'])

  const room = { id: 'room-4', audience: 'selected', targetMemberIds: ['m1', 'm2'], status: 'scheduled' }
  const callbacks: string[] = []
  const firstSync = await synchronizeRoomAccess(payload, room, { onAdded: async (recipient) => { callbacks.push(recipient.memberId) }, now: new Date('2026-08-30T10:00:00.000Z') })
  assert.deepEqual(firstSync.added, ['m1', 'm2'])
  assert.deepEqual(callbacks, ['m1', 'm2'])
  assert.equal(await isRoomMemberEntitled(payload, room, 'm1'), true)
  assert.equal(roomAccessEventKey('room-4', 'm1'), 'room-invitation:room-4:m1')

  const secondSync = await synchronizeRoomAccess(payload, { ...room, targetMemberIds: ['m2'] }, { now: new Date('2026-08-30T11:00:00.000Z') })
  assert.deepEqual(secondSync.removed, ['m1'])
  assert.equal(await isRoomMemberEntitled(payload, room, 'm1'), false)
  assert.equal(await isRoomMemberEntitled(payload, { ...room, targetMemberIds: ['m1'] }, 'm1'), false, 'revoked ledger rows must override legacy audience changes')

  const notificationRoom = { id: 'room-5', title: 'Office hours', scheduledAt: '2026-08-30T12:00:00.000Z' }
  const recipient = { memberId: 'm2', email: 'two@example.com', displayName: 'Two', sources: ['selected' as const] }
  await notifyRoomMember(payload, notificationRoom, recipient)
  await notifyRoomMember(payload, notificationRoom, recipient)
  assert.equal(payload.collections.payload_email_events.length, 1)
  assert.equal(payload.collections.payload_member_notifications.length, 1)
  assert.equal(payload.collections.payload_member_notifications[0].type, 'room_invitation')
  assert.equal(payload.collections.payload_member_notifications[0].eventKey, 'room-invitation:room-5:m2')

  assert.deepEqual(roomLiveKitPermissions({ isHost: true, audience: 'all', courseSession: true, spaceSession: false }), { canPublish: true, canPublishData: true, canSubscribe: true, roomAdmin: true })
  assert.equal(roomLiveKitPermissions({ isHost: false, audience: 'groups', courseSession: false, spaceSession: false }).canPublish, true)
  assert.equal(roomLiveKitPermissions({ isHost: false, audience: 'enrolled', courseSession: true, spaceSession: false }).canPublish, false)

  const jwt = buildLiveKitToken({ identity: 'payload_members:m1:opaque', name: 'Member', grant: { room: 'room-5', roomJoin: true, canPublish: true, canSubscribe: true } }, { apiKey: 'key', apiSecret: 'secret', wsUrl: 'wss://example.test' })
  const claims = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8')) as Record<string, unknown>
  assert.equal(claims.name, 'Member')
  assert.equal(String(claims.name).includes('@'), false)
}

run().then(() => console.log('rooms.test.ts passed')).catch((error) => { console.error(error); process.exit(1) })
