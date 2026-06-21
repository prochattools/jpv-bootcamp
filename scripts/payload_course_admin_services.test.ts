import assert from 'node:assert/strict'

import { blockMember, restoreMember } from '../src/lib/members/accountStatus'
import { grantAccess, revokeAccess } from '../src/lib/payloadCourse/adminGrants'
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

  async find(args: { collection: string; where?: Record<string, unknown>; limit?: number }) {
    const docs = [...(this.collections[args.collection] ?? [])].filter((doc) => matchesWhere(doc, args.where))
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

  count(collection: string) {
    return (this.collections[collection] ?? []).length
  }

  docs(collection: string) {
    return this.collections[collection] ?? []
  }
}

function buildPayload() {
  return new FakePayload({
    payload_members: [
      {
        id: 'member_1',
        email: 'student@example.com',
        accountStatus: 'active',
        billingHoldReason: null,
      },
    ],
    payload_access_grants: [],
    payload_audit_events: [],
    payload_entitlement_events: [],
    payload_email_events: [],
    payload_member_security_events: [],
  })
}

async function run() {
  {
    const payload = buildPayload()
    const result = await grantAccess(payload, {
      actor: { type: 'admin', id: 'admin_1' },
      memberId: 'member_1',
      resourceType: 'course',
      resourceId: 'course_1',
      reason: 'Manual test grant',
      adminEmail: 'admin@example.com',
    })

    assert.equal(result.changed, true)
    assert.equal(result.grant?.status, 'active')
    assert.equal(payload.count('payload_access_grants'), 1)
    assert.equal(payload.count('payload_audit_events'), 1)
    assert.equal(payload.count('payload_entitlement_events'), 1)
    assert.equal(payload.count('payload_email_events'), 2)
  }

  {
    const payload = buildPayload()
    const grant = await grantAccess(payload, {
      actor: { type: 'admin', id: 'admin_1' },
      memberId: 'member_1',
      resourceType: 'course',
      resourceId: 'course_1',
      reason: 'Manual test grant',
    })

    const result = await revokeAccess(payload, {
      actor: { type: 'admin', id: 'admin_1' },
      memberId: 'member_1',
      grantId: grant.grant?.id,
      resourceType: 'course',
      resourceId: 'course_1',
      reason: 'Manual test revoke',
    })

    assert.equal(result.changed, true)
    assert.equal(result.grant?.status, 'revoked')
    assert.equal(payload.count('payload_access_grants'), 1)
    assert.equal(payload.count('payload_audit_events'), 2)
    assert.equal(payload.count('payload_entitlement_events'), 2)
  }

  {
    const payload = buildPayload()
    const result = await blockMember(payload, {
      actor: { type: 'stripe', id: 'evt_payment_failed' },
      memberId: 'member_1',
      reason: 'payment_failed',
      eventId: 'evt_payment_failed',
      adminEmail: 'admin@example.com',
    })

    assert.equal(result.changed, true)
    assert.equal(result.member.accountStatus, 'blocked')
    assert.equal(result.member.billingHoldReason, 'payment_failed')
    assert.equal(payload.count('payload_member_security_events'), 1)
    assert.equal(payload.count('payload_audit_events'), 1)
    assert.equal(payload.count('payload_email_events'), 2)

    const duplicate = await blockMember(payload, {
      actor: { type: 'stripe', id: 'evt_payment_failed' },
      memberId: 'member_1',
      reason: 'payment_failed',
      eventId: 'evt_payment_failed',
      adminEmail: 'admin@example.com',
    })

    assert.equal(duplicate.changed, false)
    assert.equal(payload.count('payload_email_events'), 2)
  }

  {
    const payload = buildPayload()
    await blockMember(payload, {
      actor: { type: 'stripe', id: 'evt_payment_failed' },
      memberId: 'member_1',
      reason: 'payment_failed',
      eventId: 'evt_payment_failed',
    })

    const result = await restoreMember(payload, {
      actor: { type: 'stripe', id: 'evt_invoice_paid' },
      memberId: 'member_1',
      reason: 'payment_recovered',
      eventId: 'evt_invoice_paid',
      adminEmail: 'admin@example.com',
    })

    assert.equal(result.changed, true)
    assert.equal(result.member.accountStatus, 'active')
    assert.equal(result.member.billingHoldReason, null)
    assert.equal(payload.count('payload_member_security_events'), 2)
    assert.equal(payload.count('payload_audit_events'), 2)
    assert.equal(payload.count('payload_email_events'), 3)
  }
}

run()
  .then(() => {
    console.log('payload_course_admin_services.test.ts passed')
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
