import assert from 'node:assert/strict'

import type { PayloadCourseWriteAPI, PayloadDocument, PayloadId } from '../src/lib/payloadCourse/accessService'
import { getAffiliateSummary } from '../src/lib/payloadCourse/affiliateReporting'
import {
  getPartnerApplicationDetail,
  listActivePartners,
  listMemberApplications,
  submitPartnerApplication,
} from '../src/lib/payloadCourse/partnerApplications'

type CollectionMap = Record<string, PayloadDocument[]>

type Call =
  | { op: 'find'; collection: string; where?: Record<string, unknown>; overrideAccess?: boolean }
  | { op: 'findByID'; collection: string; id: PayloadId; overrideAccess?: boolean }
  | { op: 'create'; collection: string; data: Record<string, unknown>; overrideAccess?: boolean }

function relationValue(value: unknown): string {
  if (value && typeof value === 'object' && 'id' in value) return String((value as { id: PayloadId }).id)
  return String(value)
}

function matchesWhere(document: PayloadDocument, where?: Record<string, unknown>): boolean {
  if (!where) return true
  if (Array.isArray(where.and)) {
    return where.and.every((condition) => matchesWhere(document, condition as Record<string, unknown>))
  }
  return Object.entries(where).every(([field, condition]) => {
    if (!condition || typeof condition !== 'object') return relationValue(document[field]) === String(condition)
    const record = condition as Record<string, unknown>
    if ('equals' in record) return relationValue(document[field]) === String(record.equals)
    return true
  })
}

class FakePayload implements PayloadCourseWriteAPI {
  readonly calls: Call[] = []

  constructor(private readonly collections: CollectionMap) {}

  async find(args: {
    collection: string
    where?: Record<string, unknown>
    limit?: number
    overrideAccess?: boolean
  }) {
    this.calls.push({ op: 'find', collection: args.collection, where: args.where, overrideAccess: args.overrideAccess })
    const docs = (this.collections[args.collection] ?? []).filter((document) => matchesWhere(document, args.where))
    return { docs: docs.slice(0, args.limit ?? docs.length) }
  }

  async findByID(args: { collection: string; id: PayloadId; overrideAccess?: boolean }) {
    this.calls.push({ op: 'findByID', collection: args.collection, id: args.id, overrideAccess: args.overrideAccess })
    const document = (this.collections[args.collection] ?? []).find((candidate) => String(candidate.id) === String(args.id))
    if (!document) throw new Error(`missing ${args.collection}:${String(args.id)}`)
    return document
  }

  async create(args: { collection: string; data: Record<string, unknown>; overrideAccess?: boolean }) {
    this.calls.push({ op: 'create', collection: args.collection, data: args.data, overrideAccess: args.overrideAccess })
    const doc = { id: `${args.collection}_${this.collections[args.collection]?.length ?? 0}`, ...args.data }
    this.collections[args.collection] = [...(this.collections[args.collection] ?? []), doc]
    return doc
  }

  async update(): Promise<PayloadDocument> {
    throw new Error('not implemented')
  }
}

function buildPayload(overrides: Partial<CollectionMap> = {}): FakePayload {
  const base: CollectionMap = {
    payload_members: [
      { id: 'member_active', email: 'member@example.com', displayName: 'Member One', accountStatus: 'active' },
      { id: 'member_blocked', email: 'blocked@example.com', displayName: 'Blocked Member', accountStatus: 'blocked' },
      { id: 'member_other', email: 'other@example.com', displayName: 'Other Member', accountStatus: 'active' },
    ],
    payload_partner_affiliates: [
      {
        id: 'partner_active',
        slug: 'acme',
        name: 'Acme Partner',
        category: 'education',
        summary: 'Safe summary',
        logo: 'logo.png',
        applicationMode: 'email',
        privacyNotice: 'We share the submitted application with this partner.',
        status: 'active',
      },
      {
        id: 'partner_paused',
        slug: 'paused',
        name: 'Paused Partner',
        category: 'education',
        summary: 'Hidden',
        logo: null,
        applicationMode: 'redirect',
        privacyNotice: null,
        status: 'paused',
      },
    ],
    payload_partner_applications: [
      {
        id: 'application_existing',
        member: 'member_active',
        partner: 'partner_active',
        partnerSlugSnapshot: 'acme',
        partnerNameSnapshot: 'Acme Partner',
        deliveryMethod: 'email',
        status: 'submitted',
        createdAt: '2026-07-03T00:00:00.000Z',
        submittedAt: '2026-07-03T00:00:00.000Z',
        deliveryAttempts: 1,
      },
    ],
    payload_affiliates: [
      { id: 'affiliate_active', member: 'member_active', status: 'active', referralCode: 'REF123' },
    ],
    payload_affiliate_referrals: [
      { id: 'ref_1', affiliate: 'affiliate_active', status: 'tracked' },
      { id: 'ref_2', affiliate: 'affiliate_active', status: 'converted' },
    ],
    payload_affiliate_commissions: [
      { id: 'commission_pending', affiliate: 'affiliate_active', referral: 'ref_1', amountMinor: 500, currency: 'USD', status: 'pending' },
      { id: 'commission_approved', affiliate: 'affiliate_active', referral: 'ref_2', amountMinor: 1500, currency: 'USD', status: 'approved' },
    ],
    payload_email_events: [],
    payload_audit_events: [],
  }

  return new FakePayload({ ...base, ...overrides })
}

async function testPartnerDirectoryAndDetail(): Promise<void> {
  const payload = buildPayload()
  const partners = await listActivePartners(payload)
  assert.deepEqual(partners.map((partner) => partner.slug), ['acme'])
  assert.match(JSON.stringify(partners[0]), /Acme Partner/)
  assert.doesNotMatch(JSON.stringify(partners[0]), /affiliateUrl|recipient|webhook|note|error|destination/i)

  await assert.rejects(getPartnerApplicationDetail(payload, 'paused', 'member_active'), /Partner application was not found/)
  const detail = await getPartnerApplicationDetail(payload, 'acme', 'member_active')
  assert.equal(detail.applicationMode, 'email')
}

async function testApplicationSubmissionAndDeduping(): Promise<void> {
  const payload = buildPayload()
  const created = await submitPartnerApplication(payload, {
    memberId: 'member_active',
    partnerSlug: 'acme',
    application: {
      company: '  Example Co  ',
      country: 'UK',
      experience: '10 years',
      message: 'Hello',
      consentAccepted: true,
      trustedDestination: 'https://evil.example',
    },
  })
  assert.equal(created.outcome, 'existing')
  assert.equal(created.applicationId, 'application_existing')

  const callsBefore = payload.calls.length
  const repeat = await submitPartnerApplication(payload, {
    memberId: 'member_active',
    partnerSlug: 'acme',
    application: {
      company: 'Example Co',
      country: 'UK',
      experience: '10 years',
      message: 'Hello',
      consentAccepted: true,
    },
  })
  assert.equal(repeat.outcome, 'existing')
  assert.ok(payload.calls.length > callsBefore)
}

async function testRejectionsAndSafeSummary(): Promise<void> {
  const payload = buildPayload()
  await assert.rejects(
    submitPartnerApplication(payload, {
      memberId: 'member_blocked',
      partnerSlug: 'acme',
      application: { consentAccepted: true },
    }),
    /Partner application was not found/
  )

  const summary = await getAffiliateSummary(payload, 'member_active')
  assert.deepEqual(summary, {
    referralCount: 2,
    pendingCommissionTotalMinor: 500,
    approvedCommissionTotalMinor: 1500,
    currency: 'USD',
  })
  assert.doesNotMatch(JSON.stringify(summary), /email|recipient|webhook|destination|token|secret|customer/i)

  const applications = await listMemberApplications(payload, 'member_active')
  assert.equal(applications.length, 1)
  assert.equal(applications[0].partnerSlug, 'acme')
}

async function main(): Promise<void> {
  await testPartnerDirectoryAndDetail()
  await testApplicationSubmissionAndDeduping()
  await testRejectionsAndSafeSummary()
  console.log('payload partner application tests passed')
}

main().catch((error) => {
  console.error('payload partner application tests failed', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
