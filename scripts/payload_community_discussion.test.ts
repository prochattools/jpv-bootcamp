import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import type {
  PayloadCourseAccessAPI,
  PayloadDocument,
  PayloadId,
} from '../src/lib/payloadCourse/accessService'
import {
  getMemberCommunityPostDetail,
  projectCommunityRichText,
} from '../src/lib/payloadCourse/communityDiscussion'

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

  if ('equals' in record) {
    const expected = String(record.equals)
    if (Array.isArray(value)) {
      return value.some((item) => relationValue(item) === expected)
    }
    return relationValue(value) === expected
  }

  if ('contains' in record && Array.isArray(value)) {
    return value.some((item) => relationValue(item) === String(record.contains))
  }

  return false
}

function matchesWhere(
  document: PayloadDocument,
  where?: Record<string, unknown>
): boolean {
  if (!where) return true
  if (Array.isArray(where.and)) {
    return where.and.every((condition) =>
      matchesWhere(document, condition as Record<string, unknown>)
    )
  }
  if (Array.isArray(where.or)) {
    return where.or.some((condition) =>
      matchesWhere(document, condition as Record<string, unknown>)
    )
  }

  return Object.entries(where).every(([field, condition]) => {
    if (field === 'and' || field === 'or') return true
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
    sort?: string
    overrideAccess?: boolean
  }) {
    this.calls.push({
      operation: 'find',
      collection: args.collection,
      where: args.where,
      overrideAccess: args.overrideAccess,
    })

    let documents = [...(this.collections[args.collection] ?? [])].filter((document) =>
      matchesWhere(document, args.where)
    )
    if (args.sort) {
      const direction = args.sort.startsWith('-') ? -1 : 1
      const field = args.sort.replace(/^-/, '')
      documents = documents.sort(
        (a, b) =>
          String(a[field] ?? '').localeCompare(String(b[field] ?? '')) * direction
      )
    }

    return { docs: documents.slice(0, args.limit ?? documents.length) }
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

const safeBody = {
  root: {
    type: 'root',
    children: [
      {
        type: 'heading',
        tag: 'h2',
        children: [{ type: 'text', text: 'Heading', format: 1 }],
      },
      {
        type: 'paragraph',
        children: [
          { type: 'text', text: 'Paragraph ', format: 2 },
          {
            type: 'link',
            url: 'https://example.com/resource',
            children: [{ type: 'text', text: 'safe link', format: 8 }],
          },
        ],
      },
      {
        type: 'list',
        listType: 'bullet',
        children: [
          {
            type: 'listitem',
            children: [{ type: 'text', text: 'Item', format: 16 }],
          },
        ],
      },
      {
        type: 'quote',
        children: [{ type: 'text', text: 'Quote', format: 0 }],
      },
    ],
  },
}

function member(id: string, displayName: string): PayloadDocument {
  return {
    id,
    displayName,
    email: `${id}@private.example`,
    accountStatus: 'active',
    emailVerifiedAt: '2026-01-01T00:00:00.000Z',
  }
}

function membership(
  id: string,
  memberId: string,
  spaceId: string,
  role: 'member' | 'moderator' | 'admin',
  status: 'pending' | 'active' | 'muted' | 'blocked' | 'removed'
): PayloadDocument {
  return {
    id,
    displayName: `${memberId}:${spaceId}`,
    member: memberId,
    space: spaceId,
    role,
    status,
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

function buildPayload(
  membershipOverrides?: PayloadDocument[]
): FakePayload {
  return new FakePayload({
    payload_members: [
      member('member_mod', 'Moderator Name'),
      member('member_admin', 'Administrator Name'),
      member('member_regular', 'Regular Name'),
      member('member_outsider', 'Outsider Name'),
      member('author_post', 'Post Author'),
      member('author_comment', 'Comment Author'),
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
      {
        id: 'space_other',
        name: 'Other Space',
        slug: 'other-space',
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
      {
        id: 'policy_secret',
        resourceType: 'space',
        resourceId: 'space_secret',
        status: 'active',
        privacy: 'secret',
        requireActiveBilling: false,
        priority: 10,
      },
      {
        id: 'policy_other',
        resourceType: 'space',
        resourceId: 'space_other',
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
    payload_space_memberships:
      membershipOverrides ??
      [
        membership('membership_mod', 'member_mod', 'space_private', 'moderator', 'active'),
        membership('membership_admin', 'member_admin', 'space_private', 'admin', 'active'),
        membership('membership_regular', 'member_regular', 'space_private', 'member', 'active'),
        membership('membership_secret_mod', 'member_mod', 'space_secret', 'moderator', 'active'),
        membership('membership_other_mod', 'member_mod', 'space_other', 'moderator', 'active'),
      ],
    payload_space_posts: [
      {
        id: 'post_visible',
        title: 'Visible discussion',
        space: 'space_private',
        author: 'author_post',
        postType: 'discussion',
        body: safeBody,
        moderationStatus: 'visible',
        pinned: true,
        locked: false,
        createdAt: '2026-01-03T00:00:00.000Z',
      },
      {
        id: 'post_secret',
        title: 'Secret discussion',
        space: 'space_secret',
        author: 'author_post',
        body: safeBody,
        moderationStatus: 'visible',
      },
      {
        id: 'post_other',
        title: 'Other discussion',
        space: 'space_other',
        author: 'author_post',
        body: safeBody,
        moderationStatus: 'visible',
      },
      {
        id: 'post_pending',
        title: 'Pending discussion',
        space: 'space_private',
        author: 'author_post',
        body: safeBody,
        moderationStatus: 'pending_review',
      },
      {
        id: 'post_hidden',
        title: 'Hidden discussion',
        space: 'space_private',
        author: 'author_post',
        body: safeBody,
        moderationStatus: 'hidden',
      },
      {
        id: 'post_deleted',
        title: 'Deleted discussion',
        space: 'space_private',
        author: 'author_post',
        body: safeBody,
        moderationStatus: 'deleted',
      },
    ],
    payload_space_comments: [
      {
        id: 'comment_second',
        displayName: 'Second Commenter',
        post: 'post_visible',
        author: 'author_comment',
        body: safeBody,
        moderationStatus: 'visible',
        createdAt: '2026-01-05T00:00:00.000Z',
      },
      {
        id: 'comment_first',
        displayName: 'First Commenter',
        post: 'post_visible',
        author: 'author_comment',
        body: safeBody,
        moderationStatus: 'visible',
        createdAt: '2026-01-04T00:00:00.000Z',
      },
      {
        id: 'comment_pending',
        post: 'post_visible',
        author: 'author_comment',
        body: safeBody,
        moderationStatus: 'pending_review',
      },
      {
        id: 'comment_hidden',
        post: 'post_visible',
        author: 'author_comment',
        body: safeBody,
        moderationStatus: 'hidden',
      },
      {
        id: 'comment_deleted',
        post: 'post_visible',
        author: 'author_comment',
        body: safeBody,
        moderationStatus: 'deleted',
      },
    ],
  })
}

async function testAuthorizedProjection(): Promise<void> {
  const payload = buildPayload()
  const result = await getMemberCommunityPostDetail(
    payload,
    'member_mod',
    'private-space',
    'post_visible'
  )

  assert.equal(result.allowed, true)
  if (!result.allowed) throw new Error('Expected visible discussion access.')

  assert.equal(result.post.authorName, 'Post Author')
  assert.equal(result.post.canPublish, true)
  assert.equal(result.post.canComment, true)
  assert.deepEqual(
    result.post.comments.map((comment) => comment.id),
    ['comment_first', 'comment_second']
  )
  assert.deepEqual(result.post.attachments, [])

  const serialized = JSON.stringify(result)
  assert.doesNotMatch(serialized, /member_mod|author_post|author_comment|@private\.example/i)

  const callLog = JSON.stringify(payload.calls)
  assert.match(callLog, /member_mod/)
  assert.doesNotMatch(callLog, /member_outsider/)
  assert.ok(payload.calls.every((call) => call.overrideAccess === true))
}

async function testDeniedAndModerationBoundaries(): Promise<void> {
  for (const [spaceSlug, postId] of [
    ['private-space', 'post_visible'],
    ['secret-space', 'post_secret'],
  ] as const) {
    const denied = await getMemberCommunityPostDetail(
      buildPayload(),
      'member_outsider',
      spaceSlug,
      postId
    )
    assert.deepEqual(denied, { allowed: false, reason: 'not_found' })
  }

  for (const postId of ['post_pending', 'post_hidden', 'post_deleted']) {
    const denied = await getMemberCommunityPostDetail(
      buildPayload(),
      'member_mod',
      'private-space',
      postId
    )
    assert.deepEqual(denied, { allowed: false, reason: 'not_found' })
  }

  const mismatch = await getMemberCommunityPostDetail(
    buildPayload(),
    'member_mod',
    'private-space',
    'post_other'
  )
  assert.deepEqual(mismatch, { allowed: false, reason: 'not_found' })
}

async function testPublishingCapabilities(): Promise<void> {
  for (const memberId of ['member_mod', 'member_admin']) {
    const result = await getMemberCommunityPostDetail(
      buildPayload(),
      memberId,
      'private-space',
      'post_visible'
    )
    assert.equal(result.allowed, true)
    if (result.allowed) assert.equal(result.post.canPublish, true)
  }

  const regular = await getMemberCommunityPostDetail(
    buildPayload(),
    'member_regular',
    'private-space',
    'post_visible'
  )
  assert.equal(regular.allowed, true)
  if (regular.allowed) {
    assert.equal(regular.post.canPublish, false)
    assert.equal(regular.post.canComment, false)
  }

  for (const status of ['pending', 'muted', 'blocked', 'removed'] as const) {
    const payload = buildPayload([
      membership(`membership_${status}`, 'member_mod', 'space_private', 'moderator', status),
    ])
    const result = await getMemberCommunityPostDetail(
      payload,
      'member_mod',
      'private-space',
      'post_visible'
    )
    if (result.allowed) assert.equal(result.post.canPublish, false)
    else assert.deepEqual(result, { allowed: false, reason: 'not_found' })
  }

  const missing = await getMemberCommunityPostDetail(
    buildPayload([]),
    'member_mod',
    'private-space',
    'post_visible'
  )
  if (missing.allowed) assert.equal(missing.post.canPublish, false)
  else assert.deepEqual(missing, { allowed: false, reason: 'not_found' })
}

function testRichTextProjection(): void {
  const projected = projectCommunityRichText({
    root: {
      type: 'root',
      children: [
        ...safeBody.root.children,
        ...[
          'javascript:alert(1)',
          'data:text/html,unsafe',
          'file:///tmp/private',
          'blob:https://example.com/id',
          'not a url',
          'https://user:pass@example.com/private',
        ].map((url) => ({
          type: 'link',
          url,
          children: [{ type: 'text', text: url, format: 0 }],
        })),
        { type: 'html', html: '<script>alert(1)</script>' },
        { type: 'script', children: [{ type: 'text', text: 'script', format: 0 }] },
        { type: 'style', children: [{ type: 'text', text: 'style', format: 0 }] },
        { type: 'iframe', src: 'https://example.com' },
        { type: 'embed', url: 'https://example.com' },
        { type: 'component', name: 'ExecutableWidget' },
      ],
    },
  })

  const serialized = JSON.stringify(projected)
  assert.match(serialized, /"type":"heading"/)
  assert.match(serialized, /"type":"paragraph"/)
  assert.match(serialized, /"type":"list"/)
  assert.match(serialized, /"type":"quote"/)
  assert.match(serialized, /https:\/\/example\.com\/resource/)
  assert.match(serialized, /"bold":true/)
  assert.match(serialized, /"italic":true/)
  assert.match(serialized, /"underline":true/)
  assert.match(serialized, /"code":true/)
  assert.doesNotMatch(
    serialized,
    /javascript:|data:|file:|blob:|user:pass|<script|"type":"script"|"type":"style"|"type":"iframe"|"type":"embed"|ExecutableWidget/i
  )
}

function testPageActionAndPostingSources(): void {
  const renderer = fs.readFileSync(
    path.resolve(
      process.cwd(),
      'src/app/(frontend)/learn/community/CommunityRichText.tsx'
    ),
    'utf8'
  )
  assert.doesNotMatch(renderer, /dangerouslySetInnerHTML/)
  assert.match(renderer, /rel='noopener noreferrer'/)
  assert.match(renderer, /target='_blank'/)

  const spacePage = fs.readFileSync(
    path.resolve(
      process.cwd(),
      'src/app/(frontend)/learn/community/[spaceSlug]/page.tsx'
    ),
    'utf8'
  )
  assert.match(
    spacePage,
    /href=\{`\/learn\/community\/\$\{encodedSpaceSlug\}\/posts\/\$\{encodeURIComponent\(post\.id\)\}`\}/
  )
  assert.match(spacePage, /detail\.membership\?\.status === 'active'/)
  assert.match(spacePage, /name='title'/)
  assert.match(spacePage, /name='body'/)
  assert.doesNotMatch(spacePage, /name=['"](?:memberId|author|role|status|visibility|moderationStatus|rateLimit|audit)/)

  const postPage = fs.readFileSync(
    path.resolve(
      process.cwd(),
      'src/app/(frontend)/learn/community/[spaceSlug]/posts/[postId]/page.tsx'
    ),
    'utf8'
  )
  assert.match(postPage, /post\.canComment &&/)
  assert.match(postPage, /name='body'/)
  assert.doesNotMatch(postPage, /name=['"](?:memberId|author|role|status|visibility|moderationStatus|rateLimit|audit)/)

  const actions = fs.readFileSync(
    path.resolve(process.cwd(), 'src/app/(frontend)/learn/community/actions.ts'),
    'utf8'
  )
  assert.match(actions, /getCurrentPayloadMember\(\)/)
  assert.match(actions, /memberId: member\.id/)
  assert.match(actions, /plainTextRichText\(bodyText\)/)
  assert.doesNotMatch(
    actions,
    /formData\.get\(['"](?:memberId|author|role|status|visibility|moderationStatus|rateLimit|audit)/
  )
  const postCatch = actions.indexOf('export async function submitCommunityPost')
  const postAuthRedirect = actions.indexOf('redirect(`/learn/login', postCatch)
  const postTry = actions.indexOf('try {', postCatch)
  assert.ok(postAuthRedirect > postCatch && postAuthRedirect < postTry)
  const successRedirect = actions.indexOf('redirect(`${destination}?submission=pending`)', postTry)
  const catchEnd = actions.lastIndexOf('}', successRedirect)
  assert.ok(successRedirect > catchEnd)

  const posting = fs.readFileSync(
    path.resolve(process.cwd(), 'src/lib/payloadCourse/communityPosting.ts'),
    'utf8'
  )
  assert.match(posting, /assertCreateRateLimit/)
  assert.match(posting, /createAuditEvent/)
  assert.match(posting, /queueModerationEmail/)
  assert.match(posting, /moderationStatus: 'pending_review'/)
  assert.match(posting, /space_post\.created/)
  assert.match(posting, /space_comment\.created/)
}

async function main(): Promise<void> {
  await testAuthorizedProjection()
  await testDeniedAndModerationBoundaries()
  await testPublishingCapabilities()
  testRichTextProjection()
  testPageActionAndPostingSources()
  console.log('payload community discussion tests passed')
}

void main()
