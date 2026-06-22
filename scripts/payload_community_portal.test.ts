import assert from 'node:assert/strict'

import type {
  PayloadCourseAccessAPI,
  PayloadDocument,
  PayloadId,
} from '../src/lib/payloadCourse/accessService'
import {
  getMemberCommunityDashboard,
  getMemberCommunitySpaceDetail,
} from '../src/lib/payloadCourse/communityPortal'

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

class FakePayload implements PayloadCourseAccessAPI {
  readonly findCalls: Array<{ collection: string; where?: Record<string, unknown> }> = []

  constructor(private readonly collections: CollectionMap) {}

  async find(args: {
    collection: string
    where?: Record<string, unknown>
    limit?: number
    sort?: string
  }) {
    this.findCalls.push({ collection: args.collection, where: args.where })
    let docs = [...(this.collections[args.collection] ?? [])].filter((doc) => matchesWhere(doc, args.where))
    if (args.sort) {
      const direction = args.sort.startsWith('-') ? -1 : 1
      const field = args.sort.replace(/^-/, '')
      docs = docs.sort((a, b) => {
        const aValue = a[field]
        const bValue = b[field]
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return (aValue - bValue) * direction
        }
        return String(aValue ?? '').localeCompare(String(bValue ?? '')) * direction
      })
    }
    return { docs: docs.slice(0, args.limit ?? docs.length) }
  }

  async findByID(args: { collection: string; id: PayloadId }) {
    const doc = (this.collections[args.collection] ?? []).find((item) => String(item.id) === String(args.id))
    if (!doc) throw new Error(`missing ${args.collection}:${args.id}`)
    return doc
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
    payload_courses: [
      {
        id: 'course_pro',
        title: 'Pro Lab',
        slug: 'pro-lab',
        status: 'published',
      },
      {
        id: 'course_vip',
        title: 'VIP Lab',
        slug: 'vip-lab',
        status: 'published',
      },
    ],
    payload_access_groups: [
      {
        id: 'group_pro',
        name: 'Pro Courses',
        slug: 'pro-courses',
        status: 'active',
        members: ['member_active'],
      },
    ],
    payload_subscriptions: [
      {
        id: 'subscription_pro',
        member: 'member_active',
        status: 'active',
        plan: 'pro',
        cancelAtPeriodEnd: false,
        updatedAt: '2026-01-05T00:00:00.000Z',
      },
    ],
    payload_billing_accounts: [
      {
        id: 'billing_1',
        member: 'member_active',
        billingStatus: 'active',
        updatedAt: '2026-01-04T00:00:00.000Z',
      },
    ],
    payload_access_grants: [],
    payload_spaces: [
      {
        id: 'space_announcements',
        name: 'Announcements',
        slug: 'announcements',
        status: 'published',
        spaceType: 'announcement',
        visibility: 'public',
        description: 'Public announcements.',
        sortOrder: 10,
      },
      {
        id: 'space_pro',
        name: 'Pro Community',
        slug: 'pro-community',
        status: 'published',
        spaceType: 'discussion',
        visibility: 'private',
        description: 'Private Pro discussion.',
        linkedCourse: 'course_pro',
        sortOrder: 20,
      },
      {
        id: 'space_vip',
        name: 'VIP Mastermind',
        slug: 'vip-mastermind',
        status: 'published',
        spaceType: 'chat',
        visibility: 'secret',
        description: 'Secret VIP discussion.',
        linkedCourse: 'course_vip',
        sortOrder: 30,
      },
      {
        id: 'space_draft',
        name: 'Draft Space',
        slug: 'draft-space',
        status: 'draft',
        spaceType: 'discussion',
        visibility: 'public',
        sortOrder: 40,
      },
    ],
    payload_access_policies: [
      {
        id: 'policy_announcements',
        resourceType: 'space',
        resourceId: 'space_announcements',
        status: 'active',
        privacy: 'public',
        requireActiveBilling: false,
        priority: 10,
      },
      {
        id: 'policy_pro',
        resourceType: 'space',
        resourceId: 'space_pro',
        status: 'active',
        privacy: 'private',
        allowedPlans: ['pro', 'vip'],
        requiredGroups: ['group_pro'],
        requireActiveBilling: true,
        priority: 20,
      },
      {
        id: 'policy_vip',
        resourceType: 'space',
        resourceId: 'space_vip',
        status: 'active',
        privacy: 'secret',
        allowedPlans: ['vip'],
        requiredGroups: ['group_vip'],
        requireActiveBilling: true,
        priority: 30,
      },
    ],
    payload_space_memberships: [],
    payload_space_posts: [
      {
        id: 'post_announcements',
        title: 'Public update',
        space: 'space_announcements',
        postType: 'announcement',
        moderationStatus: 'visible',
        pinned: true,
        createdAt: '2026-01-02T00:00:00.000Z',
      },
      {
        id: 'post_pro_visible',
        title: 'Pro operating thread',
        space: 'space_pro',
        postType: 'discussion',
        moderationStatus: 'visible',
        createdAt: '2026-01-03T00:00:00.000Z',
      },
      {
        id: 'post_pro_hidden',
        title: 'Hidden moderation thread',
        space: 'space_pro',
        postType: 'discussion',
        moderationStatus: 'hidden',
        createdAt: '2026-01-04T00:00:00.000Z',
      },
      {
        id: 'post_vip_visible',
        title: 'VIP operating thread',
        space: 'space_vip',
        postType: 'discussion',
        moderationStatus: 'visible',
        createdAt: '2026-01-05T00:00:00.000Z',
      },
    ],
    payload_space_comments: [
      {
        id: 'comment_visible',
        post: 'post_pro_visible',
        moderationStatus: 'visible',
      },
      {
        id: 'comment_hidden',
        post: 'post_pro_visible',
        moderationStatus: 'hidden',
      },
    ],
  }

  return new FakePayload({
    ...base,
    ...overrides,
  })
}

async function run() {
  {
    const payload = buildPayload()
    const dashboard = await getMemberCommunityDashboard(payload, 'member_active')

    assert.deepEqual(
      dashboard.spaces.map((space) => space.slug),
      ['announcements', 'pro-community']
    )

    const announcements = dashboard.spaces.find((space) => space.slug === 'announcements')
    assert.equal(announcements?.allowed, true)
    assert.equal(announcements?.postCount, 1)

    const pro = dashboard.spaces.find((space) => space.slug === 'pro-community')
    assert.equal(pro?.allowed, true)
    assert.equal(pro?.decisionReason, 'required_group')
    assert.equal(pro?.postCount, 1)
    assert.equal(pro?.linkedCourseSlug, 'pro-lab')
  }

  {
    const payload = buildPayload({
      payload_access_groups: [],
      payload_subscriptions: [
        {
          id: 'subscription_free',
          member: 'member_active',
          status: 'active',
          plan: 'free',
          updatedAt: '2026-01-05T00:00:00.000Z',
        },
      ],
    })
    const dashboard = await getMemberCommunityDashboard(payload, 'member_active')
    const pro = dashboard.spaces.find((space) => space.slug === 'pro-community')

    assert.equal(pro?.allowed, false)
    assert.equal(pro?.postCount, null)
    assert.match(pro?.lockReason ?? '', /does not currently include/)

    const proPostFetch = payload.findCalls.find((call) => {
      return (
        call.collection === 'payload_space_posts' &&
        JSON.stringify(call.where).includes('space_pro')
      )
    })
    assert.equal(proPostFetch, undefined)
  }

  {
    const payload = buildPayload()
    const detail = await getMemberCommunitySpaceDetail(payload, 'member_active', 'pro-community')

    assert.equal(detail?.allowed, true)
    assert.equal(detail?.posts.length, 1)
    assert.equal(detail?.posts[0]?.title, 'Pro operating thread')
    assert.equal(detail?.posts[0]?.commentCount, 1)
  }

  {
    const payload = buildPayload()
    const detail = await getMemberCommunitySpaceDetail(payload, 'member_active', 'vip-mastermind')

    assert.equal(detail, null)
  }

  {
    const payload = buildPayload({
      payload_space_memberships: [
        {
          id: 'membership_vip',
          displayName: 'member_active:vip',
          member: 'member_active',
          space: 'space_vip',
          role: 'member',
          status: 'active',
          joinedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    })
    const dashboard = await getMemberCommunityDashboard(payload, 'member_active')
    const vip = dashboard.spaces.find((space) => space.slug === 'vip-mastermind')
    const detail = await getMemberCommunitySpaceDetail(payload, 'member_active', 'vip-mastermind')

    assert.equal(vip?.allowed, true)
    assert.equal(vip?.decisionReason, 'direct_grant')
    assert.equal(vip?.membership?.role, 'member')
    assert.equal(detail?.posts[0]?.title, 'VIP operating thread')
  }
}

run()
  .then(() => {
    console.log('payload_community_portal.test.ts passed')
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
