import assert from 'node:assert/strict'

import { reconcilePayloadEntitlements } from '../src/lib/payloadCourse/reconcileEntitlements'
import type {
  PayloadCourseAccessAPI,
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
    return relationValue(value) === String(record.equals)
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

class FakePayload implements PayloadCourseAccessAPI {
  constructor(private readonly collections: CollectionMap) {}

  async find(args: { collection: string; where?: Record<string, unknown>; limit?: number; sort?: string }) {
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
}

function baseCollections(overrides: Partial<CollectionMap> = {}): CollectionMap {
  return {
    payload_members: [
      { id: 'member_active', accountStatus: 'active', emailVerifiedAt: '2026-01-01T00:00:00.000Z' },
    ],
    payload_courses: [
      { id: 'course_pro', slug: 'pro-course', status: 'published', visibility: 'restricted', sortOrder: 10 },
    ],
    payload_access_policies: [
      {
        id: 'policy_pro',
        status: 'active',
        resourceType: 'course',
        resourceId: 'course_pro',
        privacy: 'private',
        allowedPlans: ['pro'],
        requiredGroups: [],
        requireActiveBilling: true,
        allowPreviewLessons: false,
      },
    ],
    payload_subscriptions: [
      {
        id: 'sub_pro',
        member: 'member_active',
        status: 'active',
        plan: 'pro',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    payload_access_grants: [],
    payload_access_groups: [],
    payload_billing_accounts: [],
    payload_lesson_progress: [],
    ...overrides,
  }
}

async function run() {
  {
    const report = await reconcilePayloadEntitlements(new FakePayload(baseCollections()), {
      now: '2026-01-01T00:00:00.000Z',
    })
    assert.equal(report.totals.decisions, 1)
    assert.equal(report.totals.issues, 0)
  }

  {
    const report = await reconcilePayloadEntitlements(
      new FakePayload(
        baseCollections({
          payload_members: [
            { id: 'member_active', accountStatus: 'blocked', emailVerifiedAt: '2026-01-01T00:00:00.000Z' },
          ],
        })
      ),
      {
        now: '2026-01-01T00:00:00.000Z',
      }
    )
    assert.equal(report.totals.issues, 1)
    assert.equal(report.issues[0].code, 'subscription_expected_allow_denied')
  }

  {
    const report = await reconcilePayloadEntitlements(
      new FakePayload(
        baseCollections({
          payload_access_grants: [
            {
              id: 'grant_missing_course',
              member: 'member_active',
              resourceType: 'course',
              resourceId: 'course_missing',
              status: 'active',
            },
          ],
        })
      ),
      {
        now: '2026-01-01T00:00:00.000Z',
      }
    )
    assert.equal(report.issues.some((issue) => issue.code === 'orphan_grant_resource_missing'), true)
  }

  {
    const report = await reconcilePayloadEntitlements(
      new FakePayload(
        baseCollections({
          payload_subscriptions: [
            {
              id: 'sub_canceling',
              member: 'member_active',
              status: 'active',
              plan: 'pro',
              cancelAtPeriodEnd: true,
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        })
      ),
      {
        now: '2026-01-01T00:00:00.000Z',
      }
    )
    assert.equal(report.totals.issues, 0)
  }
}

run()
  .then(() => {
    console.log('payload_course_reconciliation.test.ts passed')
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
