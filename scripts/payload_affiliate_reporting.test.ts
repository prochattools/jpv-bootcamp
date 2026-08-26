import assert from 'node:assert/strict'

import type {
  PayloadCourseAccessAPI,
  PayloadDocument,
  PayloadId,
} from '../src/lib/payloadCourse/accessService'
import { getAffiliateSummary } from '../src/lib/payloadCourse/affiliateReporting'
import {
  buildAffiliateReportingMigrationUpSql,
  getAffiliateReportingMigrationSchema,
} from '../src/lib/affiliateReportingMigrationSql'
import { shouldRegisterPayloadProdMigrations } from '../src/lib/payloadMigrations'

type CollectionMap = Record<string, PayloadDocument[]>

type ReadCall = {
  operation: 'find' | 'findByID'
  collection: string
  where?: Record<string, unknown>
  id?: PayloadId
  overrideAccess?: boolean
}

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
  return false
}

function matchesWhere(document: PayloadDocument, where?: Record<string, unknown>): boolean {
  if (!where) return true
  if (Array.isArray(where.and)) {
    return where.and.every((condition) =>
      matchesWhere(document, condition as Record<string, unknown>)
    )
  }
  return Object.entries(where).every(([field, condition]) => {
    if (field === 'and') return true
    return matchesCondition(document[field], condition)
  })
}

class FakePayload implements PayloadCourseAccessAPI {
  readonly calls: ReadCall[] = []

  constructor(private readonly collections: CollectionMap) {}

  async find(args: {
    collection: string
    where?: Record<string, unknown>
    limit?: number
    overrideAccess?: boolean
  }) {
    this.calls.push({
      operation: 'find',
      collection: args.collection,
      where: args.where,
      overrideAccess: args.overrideAccess,
    })
    const docs = (this.collections[args.collection] ?? []).filter((document) =>
      matchesWhere(document, args.where)
    )
    return { docs: docs.slice(0, args.limit ?? docs.length) }
  }

  async findByID(args: {
    collection: string
    id: PayloadId
    overrideAccess?: boolean
  }): Promise<PayloadDocument> {
    this.calls.push({
      operation: 'findByID',
      collection: args.collection,
      id: args.id,
      overrideAccess: args.overrideAccess,
    })
    const document = (this.collections[args.collection] ?? []).find(
      (candidate) => String(candidate.id) === String(args.id)
    )
    if (!document) throw new Error(`missing ${args.collection}:${String(args.id)}`)
    return document
  }
}

function buildPayload(overrides: Partial<CollectionMap> = {}): FakePayload {
  const base: CollectionMap = {
    payload_members: [
      { id: 'member_active', accountStatus: 'active' },
      { id: 'member_blocked', accountStatus: 'blocked' },
      { id: 'member_suspended', accountStatus: 'suspended' },
      { id: 'member_other', accountStatus: 'active' },
    ],
    payload_affiliates: [
      {
        id: 'affiliate_active',
        member: 'member_active',
        status: 'active',
        referralCode: 'ACTIVE123',
        metadata: { token: 'must-not-return' },
      },
      {
        id: 'affiliate_pending',
        member: 'member_other',
        status: 'pending',
        referralCode: 'PENDING123',
      },
      {
        id: 'affiliate_suspended',
        member: 'member_suspended',
        status: 'suspended',
        referralCode: 'SUSPENDED123',
      },
    ],
    payload_affiliate_referrals: [
      { id: 'ref_tracked', affiliate: 'affiliate_active', status: 'tracked' },
      { id: 'ref_converted', affiliate: 'affiliate_active', status: 'converted' },
      { id: 'ref_rejected', affiliate: 'affiliate_active', status: 'rejected' },
      { id: 'ref_other', affiliate: 'affiliate_other', status: 'converted' },
    ],
    payload_affiliate_commissions: [
      {
        id: 'commission_pending_one',
        affiliate: 'affiliate_active',
        referral: 'ref_tracked',
        amountMinor: 1250,
        currency: 'USD',
        status: 'pending',
      },
      {
        id: 'commission_pending_two',
        affiliate: 'affiliate_active',
        referral: 'ref_converted',
        amountMinor: 750,
        currency: 'usd',
        status: 'pending',
      },
      {
        id: 'commission_approved',
        affiliate: 'affiliate_active',
        referral: 'ref_converted',
        amountMinor: 3000,
        currency: 'USD',
        status: 'approved',
      },
      {
        id: 'commission_void',
        affiliate: 'affiliate_active',
        referral: 'ref_rejected',
        amountMinor: 999999,
        currency: 'EUR',
        status: 'void',
        payoutToken: 'must-not-return',
      },
      {
        id: 'commission_other',
        affiliate: 'affiliate_other',
        referral: 'ref_other',
        amountMinor: 8000,
        currency: 'USD',
        status: 'approved',
      },
    ],
  }

  return new FakePayload({ ...base, ...overrides })
}

async function testAuthorizedAggregation(): Promise<void> {
  const payload = buildPayload()
  const summary = await getAffiliateSummary(payload, 'member_active')

  assert.deepEqual(summary, {
    referralCount: 3,
    pendingCommissionTotalMinor: 2000,
    approvedCommissionTotalMinor: 3000,
    currency: 'USD',
  })

  for (const call of payload.calls) assert.equal(call.overrideAccess, true)

  const referralCall = payload.calls.find(
    (call) => call.collection === 'payload_affiliate_referrals'
  )
  const commissionCall = payload.calls.find(
    (call) => call.collection === 'payload_affiliate_commissions'
  )
  assert.deepEqual(referralCall?.where, { affiliate: { equals: 'affiliate_active' } })
  assert.deepEqual(commissionCall?.where, { affiliate: { equals: 'affiliate_active' } })

  assert.doesNotMatch(
    JSON.stringify(summary),
    /rows|metadata|payout|bank|credential|token|secret|stripe|referralCode|member/i
  )
}

async function testAuthorizationDenials(): Promise<void> {
  await assert.rejects(
    getAffiliateSummary(buildPayload(), 'member_missing'),
    /Affiliate summary was not found/
  )
  await assert.rejects(
    getAffiliateSummary(buildPayload(), 'member_blocked'),
    /Affiliate summary was not found/
  )
  await assert.rejects(
    getAffiliateSummary(buildPayload(), 'member_suspended'),
    /Affiliate summary was not found/
  )
  await assert.rejects(
    getAffiliateSummary(buildPayload(), 'member_other'),
    /Affiliate summary was not found/
  )

  const pendingOwnedPayload = buildPayload({
    payload_affiliates: [
      { id: 'affiliate_pending_owned', member: 'member_active', status: 'pending' },
    ],
  })
  await assert.rejects(
    getAffiliateSummary(pendingOwnedPayload, 'member_active'),
    /Affiliate summary was not found/
  )

  const suspendedOwnedPayload = buildPayload({
    payload_affiliates: [
      { id: 'affiliate_suspended_owned', member: 'member_active', status: 'suspended' },
    ],
  })
  await assert.rejects(
    getAffiliateSummary(suspendedOwnedPayload, 'member_active'),
    /Affiliate summary was not found/
  )
}

async function testMalformedAmounts(): Promise<void> {
  for (const amountMinor of [-1, 1.5, '100']) {
    const payload = buildPayload({
      payload_affiliate_commissions: [
        {
          id: 'commission_invalid',
          affiliate: 'affiliate_active',
          referral: 'ref_tracked',
          amountMinor,
          currency: 'USD',
          status: 'pending',
        },
      ],
    })
    await assert.rejects(
      getAffiliateSummary(payload, 'member_active'),
      /Affiliate summary was not found/
    )
  }
}

async function testMalformedAndMixedCurrencies(): Promise<void> {
  for (const currency of ['US', 'US12', 123]) {
    const payload = buildPayload({
      payload_affiliate_commissions: [
        {
          id: 'commission_invalid_currency',
          affiliate: 'affiliate_active',
          referral: 'ref_tracked',
          amountMinor: 100,
          currency,
          status: 'pending',
        },
      ],
    })
    await assert.rejects(
      getAffiliateSummary(payload, 'member_active'),
      /Affiliate summary was not found/
    )
  }

  const mixed = buildPayload({
    payload_affiliate_commissions: [
      {
        id: 'commission_usd',
        affiliate: 'affiliate_active',
        referral: 'ref_tracked',
        amountMinor: 100,
        currency: 'USD',
        status: 'pending',
      },
      {
        id: 'commission_eur',
        affiliate: 'affiliate_active',
        referral: 'ref_converted',
        amountMinor: 200,
        currency: 'EUR',
        status: 'approved',
      },
    ],
  })
  await assert.rejects(
    getAffiliateSummary(mixed, 'member_active'),
    /Affiliate summary was not found/
  )
}

function testAffiliateMigrationSchemaSelection(): void {
  assert.equal(getAffiliateReportingMigrationSchema(undefined), 'jpvbootcamp')
  assert.equal(getAffiliateReportingMigrationSchema(''), 'jpvbootcamp')

  assert.throws(
    () => getAffiliateReportingMigrationSchema('not-a-url'),
    /Malformed DATABASE_URL/
  )

  const stagingUrl =
    'postgresql://tenant:password@example.com:5432/postgres?schema=jpvbootcamp_staging'
  const productionUrl = 'postgresql://tenant:password@example.com:5432/postgres?schema=jpvbootcamp'

  assert.equal(getAffiliateReportingMigrationSchema(stagingUrl), 'jpvbootcamp_staging')
  assert.equal(getAffiliateReportingMigrationSchema(productionUrl), 'jpvbootcamp')
  assert.equal(getAffiliateReportingMigrationSchema('postgresql://tenant:password@example.com:5432/postgres'), 'jpvbootcamp')

  for (const schema of ['bad-schema', '1bad', 'bad.schema', 'bad schema', 'bad"schema']) {
    assert.throws(
      () =>
        getAffiliateReportingMigrationSchema(
          `postgresql://tenant:password@example.com:5432/postgres?schema=${encodeURIComponent(
            schema
          )}`
        ),
      /Invalid Payload migration schema/
    )
  }

  const stagingSql = buildAffiliateReportingMigrationUpSql(stagingUrl)
  assert.match(stagingSql, /"jpvbootcamp_staging"\."payload_affiliates"/)
  assert.match(stagingSql, /"jpvbootcamp_staging"\."payload_affiliate_referrals"/)
  assert.match(stagingSql, /"jpvbootcamp_staging"\."payload_affiliate_commissions"/)
  assert.match(stagingSql, /"jpvbootcamp_staging"\."payload_locked_documents_rels"/)
  assert.match(stagingSql, /payload_affiliate_commissions_amount_minor_check/)
  assert.match(stagingSql, /ON DELETE restrict/)
  assert.match(stagingSql, /ON DELETE set null/)
  assert.doesNotMatch(stagingSql, /"jpvbootcamp"\./)
}

function testPayloadMigrationRegistrationGate(): void {
  assert.equal(shouldRegisterPayloadProdMigrations(['node', 'next', 'start']), false)
  assert.equal(shouldRegisterPayloadProdMigrations(['node', 'next', 'build']), false)
  assert.equal(shouldRegisterPayloadProdMigrations(['node', 'next', 'dev']), false)
  assert.equal(shouldRegisterPayloadProdMigrations(['node', 'payload', 'migrate']), true)
  assert.equal(shouldRegisterPayloadProdMigrations(['node', 'payload', 'migrate:create']), true)
  assert.equal(shouldRegisterPayloadProdMigrations(['node', 'payload', 'migrate:status']), true)
  assert.equal(shouldRegisterPayloadProdMigrations(['node', 'script', '--migration-file']), false)
  assert.equal(shouldRegisterPayloadProdMigrations(['node', 'script', 'migration']), false)
}

async function main(): Promise<void> {
  await testAuthorizedAggregation()
  await testAuthorizationDenials()
  await testMalformedAmounts()
  await testMalformedAndMixedCurrencies()
  testAffiliateMigrationSchemaSelection()
  testPayloadMigrationRegistrationGate()
  console.log('payload affiliate reporting tests passed')
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
