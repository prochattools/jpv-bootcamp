import assert from 'node:assert/strict'

import type {
  PayloadCourseWriteAPI,
  PayloadDocument,
  PayloadId,
} from '../src/lib/payloadCourse/accessService'
import { evaluatePayloadSpaceAccess } from '../src/lib/payloadCourse/accessService'
import {
  addSpaceMembership,
  removeSpaceMembership,
  requestSpaceAccess,
} from '../src/lib/payloadCourse/spaceMemberships'

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

  async find(args: {
    collection: string
    where?: Record<string, unknown>
    limit?: number
    sort?: string
  }) {
    let docs = [...(this.collections[args.collection] ?? [])].filter((doc) => matchesWhere(doc, args.where))
    if (args.sort) {
      const direction = args.sort.startsWith('-') ? -1 : 1
      const field = args.sort.replace(/^-/, '')
      docs = docs.sort((a, b) => String(a[field] ?? '').localeCompare(String(b[field] ?? '')) * direction)
    }
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

  countDocs(collection: string) {
    return (this.collections[collection] ?? []).length
  }

  docs(collection: string) {
    return this.collections[collection] ?? []
  }
}

function buildPayload(overrides: Partial<CollectionMap> = {}) {
  const base: CollectionMap = {
    payload_members: [
      {
        id: 'member_active',
        email: 'student@example.com',
        accountStatus: 'active',
        emailVerifiedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    payload_spaces: [
      {
        id: 'space_private',
        name: 'Private Space',
        slug: 'private-space',
        status: 'published',
        visibility: 'private',
      },
      {
        id: 'space_secret',
        name: 'Secret Space',
        slug: 'secret-space',
        status: 'published',
        visibility: 'secret',
      },
    ],
    payload_access_policies: [
      {
        id: 'policy_private',
        resourceType: 'space',
        resourceId: 'space_private',
        status: 'active',
        privacy: 'private',
        requireActiveBilling: false,
        priority: 10,
      },
      {
        id: 'policy_secret',
        resourceType: 'space',
        resourceId: 'space_secret',
        status: 'active',
        privacy: 'secret',
        requireActiveBilling: false,
        priority: 20,
      },
    ],
    payload_access_groups: [],
    payload_access_grants: [],
    payload_billing_accounts: [],
    payload_subscriptions: [],
    payload_space_memberships: [],
    payload_audit_events: [],
    payload_entitlement_events: [],
    payload_email_events: [],
  }

  return new FakePayload({
    ...base,
    ...overrides,
  })
}

async function run() {
  {
    const payload = buildPayload()
    const result = await requestSpaceAccess(payload, {
      memberId: 'member_active',
      spaceId: 'space_private',
      reason: 'Please approve me',
      adminEmail: 'admin@example.com',
    })

    assert.equal(result.changed, true)
    assert.equal(result.membership?.status, 'pending')
    assert.equal(payload.countDocs('payload_space_memberships'), 1)
    assert.equal(payload.countDocs('payload_audit_events'), 1)
    assert.equal(payload.countDocs('payload_entitlement_events'), 0)
    assert.equal(payload.countDocs('payload_email_events'), 1)

    const access = await evaluatePayloadSpaceAccess(payload, {
      memberId: 'member_active',
      spaceId: 'space_private',
    })
    assert.equal(access.decision.allowed, false)
    assert.equal(access.decision.reason, 'no_matching_entitlement')
  }

  {
    const payload = buildPayload()
    const result = await addSpaceMembership(payload, {
      actor: { type: 'admin', id: 'admin_1' },
      memberId: 'member_active',
      spaceId: 'space_private',
      role: 'moderator',
      reason: 'Approved manually',
      adminEmail: 'admin@example.com',
    })

    assert.equal(result.changed, true)
    assert.equal(result.membership?.status, 'active')
    assert.equal(result.membership?.role, 'moderator')
    assert.equal(payload.countDocs('payload_space_memberships'), 1)
    assert.equal(payload.countDocs('payload_audit_events'), 1)
    assert.equal(payload.countDocs('payload_entitlement_events'), 1)
    assert.equal(payload.countDocs('payload_email_events'), 2)

    const access = await evaluatePayloadSpaceAccess(payload, {
      memberId: 'member_active',
      spaceId: 'space_private',
    })
    assert.equal(access.decision.allowed, true)
    assert.equal(access.decision.reason, 'direct_grant')
  }

  {
    const payload = buildPayload({
      payload_space_memberships: [
        {
          id: 'membership_existing',
          displayName: 'member_active:private',
          member: 'member_active',
          space: 'space_private',
          role: 'member',
          status: 'active',
        },
      ],
    })
    const result = await removeSpaceMembership(payload, {
      actor: { type: 'admin', id: 'admin_1' },
      memberId: 'wrong_member',
      spaceId: 'wrong_space',
      membershipId: 'membership_existing',
      reason: 'No longer eligible',
      adminEmail: 'admin@example.com',
    })

    assert.equal(result.changed, true)
    assert.equal(result.membership?.status, 'removed')
    assert.equal(payload.countDocs('payload_space_memberships'), 1)
    assert.equal(payload.countDocs('payload_audit_events'), 1)
    assert.equal(payload.countDocs('payload_entitlement_events'), 1)
    assert.equal(payload.docs('payload_entitlement_events')[0]?.member, 'member_active')
    assert.equal(payload.docs('payload_entitlement_events')[0]?.resourceId, 'space_private')
    assert.equal(payload.countDocs('payload_email_events'), 2)
  }

  {
    const payload = buildPayload()

    await assert.rejects(
      () => requestSpaceAccess(payload, {
        memberId: 'member_active',
        spaceId: 'space_secret',
        adminEmail: 'admin@example.com',
      }),
      /published private spaces/
    )
  }

  {
    const payload = buildPayload({
      payload_space_memberships: [
        {
          id: 'membership_blocked',
          displayName: 'member_active:private',
          member: 'member_active',
          space: 'space_private',
          role: 'member',
          status: 'blocked',
        },
      ],
    })

    await assert.rejects(
      () => requestSpaceAccess(payload, {
        memberId: 'member_active',
        spaceId: 'space_private',
        adminEmail: 'admin@example.com',
      }),
      /blocked from this space/
    )
  }

  {
    const payload = buildPayload()

    await assert.rejects(
      () => addSpaceMembership(payload, {
        actor: { type: 'member', id: 'member_active' },
        memberId: 'member_active',
        spaceId: 'space_private',
      }),
      /cannot directly mutate/
    )
  }
}

run()
  .then(() => {
    console.log('payload_space_memberships.test.ts passed')
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
