import assert from 'node:assert/strict'

import type { PayloadCourseWriteAPI, PayloadDocument, PayloadId } from '@/lib/payloadCourse/accessService'
import { sweepExpiredPaymentGrace } from '@/lib/billing/delinquencySweep'

class FakePayload implements PayloadCourseWriteAPI {
  private nextId = 1
  readonly findPages: number[] = []
  constructor(readonly data: Record<string, PayloadDocument[]>) {}

  async find(args: { collection: string; limit?: number; page?: number }) {
    const rows = this.data[args.collection] ?? []
    const limit = args.limit ?? rows.length
    const page = args.page ?? 1
    if (args.collection === 'payload_subscriptions') this.findPages.push(page)
    const start = (page - 1) * limit
    return {
      docs: rows.slice(start, start + limit),
      hasNextPage: start + limit < rows.length,
    }
  }
  async findByID(args: { collection: string; id: PayloadId }) {
    const doc = (this.data[args.collection] ?? []).find((row) => String(row.id) === String(args.id))
    if (!doc) throw new Error('missing')
    return doc
  }
  async create(args: { collection: string; data: Record<string, unknown> }) {
    const doc = { id: `${args.collection}-${this.nextId++}`, ...args.data }
    ;(this.data[args.collection] ??= []).push(doc)
    return doc
  }
  async update(args: { collection: string; id: PayloadId; data: Record<string, unknown> }) {
    const rows = this.data[args.collection] ?? []
    const index = rows.findIndex((row) => String(row.id) === String(args.id))
    if (index < 0) throw new Error('missing')
    rows[index] = { ...rows[index], ...args.data }
    return rows[index]
  }
}

async function run() {
  const payload = new FakePayload({
    payload_subscriptions: [
      { id: 'sub-1', member: 'member-1', status: 'past_due', paymentGraceEndsAt: '2026-08-24T00:00:00Z' },
      { id: 'sub-2', member: 'member-2', status: 'past_due', paymentGraceEndsAt: '2026-08-24T00:00:00Z' },
      { id: 'sub-3', member: 'member-3', status: 'unpaid', paymentGraceEndsAt: '2026-08-24T00:00:00Z' },
    ],
    payload_members: [
      { id: 'member-1', email: 'one@example.com', accountStatus: 'active' },
      { id: 'member-2', email: 'two@example.com', accountStatus: 'suspended' },
      { id: 'member-3', email: 'three@example.com', accountStatus: 'blocked', billingHoldReason: 'past_due' },
    ],
    payload_audit_events: [],
    payload_member_security_events: [],
    payload_email_events: [],
  })

  const result = await sweepExpiredPaymentGrace({
    payload,
    now: new Date('2026-08-25T00:00:00Z'),
    limit: 2,
  })

  assert.deepEqual(result, {
    examined: 3,
    blocked: 1,
    alreadyBlocked: 1,
    skippedManualStatus: 1,
    failed: 0,
  })
  assert.equal(payload.data.payload_members[0]?.accountStatus, 'blocked')
  assert.equal(payload.data.payload_members[0]?.billingHoldReason, 'payment_overdue')
  assert.equal(payload.data.payload_members[1]?.accountStatus, 'suspended')
  assert.equal(payload.data.payload_email_events.length, 1)
  assert.equal(payload.data.payload_member_security_events.length, 1)
  assert.deepEqual(payload.findPages, [1, 2])

  console.log('Delinquency sweep contract: PASS')
}

void run()
