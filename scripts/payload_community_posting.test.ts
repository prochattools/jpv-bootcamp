import assert from 'node:assert/strict'

import type {
  PayloadCourseWriteAPI,
  PayloadDocument,
  PayloadId,
} from '../src/lib/payloadCourse/accessService'
import { getMemberCommunitySpaceDetail } from '../src/lib/payloadCourse/communityPortal'
import {
  createSpaceComment,
  createSpacePost,
  moderateSpaceComment,
  moderateSpacePost,
} from '../src/lib/payloadCourse/communityPosting'

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
      createdAt: new Date().toISOString(),
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

const richTextBody = {
  root: {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: [{ type: 'text', text: 'Community body' }],
      },
    ],
  },
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
      {
        id: 'member_moderator',
        email: 'moderator@example.com',
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
    ],
    payload_access_groups: [],
    payload_access_grants: [],
    payload_billing_accounts: [],
    payload_subscriptions: [],
    payload_space_memberships: [
      {
        id: 'membership_member',
        displayName: 'member_active:private',
        member: 'member_active',
        space: 'space_private',
        role: 'member',
        status: 'active',
      },
      {
        id: 'membership_moderator',
        displayName: 'member_moderator:private',
        member: 'member_moderator',
        space: 'space_private',
        role: 'moderator',
        status: 'active',
      },
    ],
    payload_space_posts: [
      {
        id: 'post_visible',
        title: 'Visible Post',
        space: 'space_private',
        author: 'member_active',
        postType: 'discussion',
        body: richTextBody,
        moderationStatus: 'visible',
        locked: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'post_locked',
        title: 'Locked Post',
        space: 'space_private',
        author: 'member_active',
        postType: 'discussion',
        body: richTextBody,
        moderationStatus: 'visible',
        locked: true,
        createdAt: '2026-01-02T00:00:00.000Z',
      },
    ],
    payload_space_comments: [
      {
        id: 'comment_visible',
        displayName: 'Visible Comment',
        post: 'post_visible',
        author: 'member_active',
        body: richTextBody,
        moderationStatus: 'visible',
      },
    ],
    payload_audit_events: [],
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
    const result = await createSpacePost(payload, {
      memberId: 'member_active',
      spaceId: 'space_private',
      title: 'New private discussion',
      body: richTextBody,
      adminEmail: 'admin@example.com',
    })

    assert.equal(result.document.moderationStatus, 'pending_review')
    assert.equal(payload.countDocs('payload_space_posts'), 3)
    assert.equal(payload.countDocs('payload_audit_events'), 1)
    assert.equal(payload.countDocs('payload_email_events'), 1)

    const detail = await getMemberCommunitySpaceDetail(payload, 'member_active', 'private-space')
    assert.equal(detail?.posts.some((post) => post.title === 'New private discussion'), false)
  }

  {
    const payload = buildPayload({
      payload_space_posts: [
        {
          id: 'recent_post',
          title: 'Recent',
          space: 'space_private',
          author: 'member_active',
          postType: 'discussion',
          body: richTextBody,
          moderationStatus: 'pending_review',
          createdAt: new Date().toISOString(),
        },
      ],
    })

    await assert.rejects(
      () => createSpacePost(payload, {
        memberId: 'member_active',
        spaceId: 'space_private',
        title: 'Too soon',
        body: richTextBody,
        rateLimit: { maxCreates: 1, windowMs: 60_000 },
      }),
      /rate limit/
    )
  }

  {
    const payload = buildPayload({
      payload_space_memberships: [
        {
          id: 'membership_muted',
          displayName: 'member_active:private',
          member: 'member_active',
          space: 'space_private',
          role: 'member',
          status: 'muted',
        },
      ],
    })

    await assert.rejects(
      () => createSpacePost(payload, {
        memberId: 'member_active',
        spaceId: 'space_private',
        title: 'Muted post',
        body: richTextBody,
      }),
      /Space access denied/
    )
  }

  {
    const payload = buildPayload()
    const result = await createSpaceComment(payload, {
      memberId: 'member_active',
      postId: 'post_visible',
      body: richTextBody,
      adminEmail: 'admin@example.com',
    })

    assert.equal(result.document.moderationStatus, 'pending_review')
    assert.equal(payload.countDocs('payload_space_comments'), 2)
    assert.equal(payload.countDocs('payload_audit_events'), 1)
    assert.equal(payload.countDocs('payload_email_events'), 1)
  }

  {
    const payload = buildPayload()

    await assert.rejects(
      () => createSpaceComment(payload, {
        memberId: 'member_active',
        postId: 'post_locked',
        body: richTextBody,
      }),
      /locked/
    )
  }

  {
    const payload = buildPayload()
    const result = await moderateSpacePost(payload, {
      actor: { type: 'member', id: 'member_moderator' },
      postId: 'post_visible',
      moderationStatus: 'hidden',
      reason: 'Needs review',
    })

    assert.equal(result.document.moderationStatus, 'hidden')
    assert.equal(payload.countDocs('payload_audit_events'), 1)
  }

  {
    const payload = buildPayload()

    await assert.rejects(
      () => moderateSpacePost(payload, {
        actor: { type: 'member', id: 'member_active' },
        postId: 'post_visible',
        moderationStatus: 'hidden',
      }),
      /Moderator or space admin/
    )
  }

  {
    const payload = buildPayload()
    const result = await moderateSpaceComment(payload, {
      actor: { type: 'admin', id: 'admin_1' },
      commentId: 'comment_visible',
      moderationStatus: 'deleted',
      reason: 'Administrative cleanup',
    })

    assert.equal(result.document.moderationStatus, 'deleted')
    assert.equal(payload.countDocs('payload_audit_events'), 1)
  }
}

run()
  .then(() => {
    console.log('payload_community_posting.test.ts passed')
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
