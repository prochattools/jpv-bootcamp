import assert from 'node:assert/strict'

import type { PayloadCourseWriteAPI, PayloadDocument, PayloadId } from '../src/lib/payloadCourse/accessService'
import { partnerCollections } from '../src/collections/partners'
import { buildPartnerAdminReport, serializePartnerReportCsv } from '../src/lib/partnerAffiliateReporting'
import { listMemberApplications } from '../src/lib/payloadCourse/partnerApplications'
import {
  recordPartnerEvent,
  retryPartnerDelivery,
  transitionPartnerApplicationDelivery,
} from '../src/lib/payloadCourse/partnerDelivery'

type CollectionMap = Record<string, PayloadDocument[]>

class FakePayload implements PayloadCourseWriteAPI {
  readonly calls: Array<{ op: string; collection: string; data?: Record<string, unknown> }> = []

  constructor(public readonly collections: CollectionMap) {}

  async find(args: { collection: string; where?: Record<string, unknown>; limit?: number; overrideAccess?: boolean }) {
    this.calls.push({ op: 'find', collection: args.collection })
    const docs = this.collections[args.collection] ?? []
    return { docs: docs.slice(0, args.limit ?? docs.length) }
  }

  async findByID(args: { collection: string; id: PayloadId; overrideAccess?: boolean }) {
    this.calls.push({ op: 'findByID', collection: args.collection })
    const doc = (this.collections[args.collection] ?? []).find((item) => String(item.id) === String(args.id))
    if (!doc) throw new Error(`missing ${args.collection}:${String(args.id)}`)
    return doc
  }

  async create(args: { collection: string; data: Record<string, unknown>; overrideAccess?: boolean }) {
    this.calls.push({ op: 'create', collection: args.collection, data: args.data })
    const doc = { id: `${args.collection}_${(this.collections[args.collection] ?? []).length + 1}`, ...args.data }
    this.collections[args.collection] = [...(this.collections[args.collection] ?? []), doc]
    return doc
  }

  async update(args: { collection: string; id: PayloadId; data: Record<string, unknown>; overrideAccess?: boolean }) {
    this.calls.push({ op: 'update', collection: args.collection, data: args.data })
    const docs = this.collections[args.collection] ?? []
    const index = docs.findIndex((item) => String(item.id) === String(args.id))
    if (index < 0) throw new Error(`missing ${args.collection}:${String(args.id)}`)
    const updated = { ...docs[index], ...args.data }
    docs[index] = updated
    this.collections[args.collection] = docs
    return updated
  }
}

function buildPayload(overrides: Partial<CollectionMap> = {}): FakePayload {
  const base: CollectionMap = {
    payload_members: [{ id: 'member_1', email: 'member@example.com', displayName: 'Member One', accountStatus: 'active' }],
    payload_partner_affiliates: [{ id: 'partner_1', slug: 'partner-one', name: 'Partner One', category: 'education', applicationMode: 'email', status: 'active' }],
    payload_partner_applications: [
      {
        id: 'app_1',
        member: 'member_1',
        partner: 'partner_1',
        partnerSlugSnapshot: 'partner-one',
        partnerNameSnapshot: 'Partner One',
        deliveryMethod: 'email',
        status: 'delivery_failed',
        deliveryAttempts: 1,
        submittedAt: '2026-07-03T00:00:00.000Z',
        companySnapshot: '=cmd',
        countrySnapshot: 'UK',
        experienceSnapshot: '10 years',
        messageSnapshot: '+danger',
      },
    ],
    payload_partner_events: [
      { id: 'event_1', eventType: 'partner_viewed', partner: 'partner_1', application: 'app_1', member: 'member_1' },
      { id: 'event_2', eventType: 'affiliate_link_clicked', partner: 'partner_1', application: null, member: 'member_1' },
      { id: 'event_3', eventType: 'partner_application_submitted', partner: 'partner_1', application: 'app_1', member: 'member_1' },
    ],
    payload_email_events: [],
    payload_audit_events: [],
  }
  return new FakePayload({ ...base, ...overrides })
}

async function main(): Promise<void> {
  assert.deepEqual(
    partnerCollections.map((collection) => collection.slug),
    ['payload_partner_affiliates', 'payload_partner_applications', 'payload_partner_events']
  )
  assert.match(
    JSON.stringify(partnerCollections.map((collection) => collection.admin?.defaultColumns ?? [])),
    /partner|application|event/
  )
  const partnerApplications = partnerCollections[1]
  assert.ok(partnerApplications?.access && typeof partnerApplications.access === 'object')
  const namedFields = partnerApplications.fields.flatMap((field) =>
    'name' in field && typeof field.name === 'string' ? [field.name] : []
  )
  assert.match(
    JSON.stringify(namedFields),
    /lastDeliveryError|trustedDestinationSnapshot|internalNotes|recipientEmails|webhookEndpoint/
  )

  const payload = buildPayload()
  const applications = await listMemberApplications(payload, 'member_1')
  assert.equal(applications.length, 1)
  assert.equal(applications[0].partnerSlug, 'partner-one')

  const report = await buildPartnerAdminReport(payload, {})
  assert.equal(report.totals.views, 1)
  assert.equal(report.totals.clicks, 1)
  assert.equal(report.totals.submissions, 1)
  assert.equal(report.totals.failed, 1)
  assert.doesNotMatch(JSON.stringify(report), /webhook|recipient|destination|error|secret|token|customer/i)

  const csv = serializePartnerReportCsv(report.rows)
  assert.ok(csv.startsWith('partner,application,member,status,deliveryMethod'))
  assert.match(csv, /"'=cmd"/)
  assert.match(csv, /"'\+danger"/)

  await recordPartnerEvent(payload, {
    partnerId: 'partner_1',
    applicationId: 'app_1',
    memberId: 'member_1',
    eventType: 'partner_application_retried',
    sourceRoute: '/admin/partner-applications',
  })
  assert.equal(payload.calls.filter((call) => call.op === 'create' && call.collection === 'payload_partner_events').length >= 1, true)

  const transitioned = await transitionPartnerApplicationDelivery(payload, 'app_1', 'delivery_pending', {
    actorType: 'admin',
    actorId: 'member_1',
  })
  assert.equal(transitioned.status, 'delivery_pending')
  const failed = await transitionPartnerApplicationDelivery(payload, 'app_1', 'delivery_failed', {
    actorType: 'admin',
    actorId: 'member_1',
    error: 'boom',
  })
  assert.equal(failed.lastDeliveryError, 'boom')

  const retried = await retryPartnerDelivery(payload, 'app_1', 'member_1')
  assert.equal(retried.status, 'delivery_pending')

  payload.collections.payload_partner_applications[0].status = 'delivered'
  await assert.rejects(retryPartnerDelivery(payload, 'app_1', 'member_1'), /partner_application_already_delivered/)

  console.log('payload partner operations tests passed')
}

main().catch((error) => {
  console.error('payload partner operations tests failed', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
