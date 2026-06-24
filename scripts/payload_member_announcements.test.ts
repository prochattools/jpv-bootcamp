import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import type {
  PayloadCourseAccessAPI,
  PayloadDocument,
  PayloadId,
} from '../src/lib/payloadCourse/accessService'
import { getMemberAnnouncements } from '../src/lib/payloadCourse/communityPortal'

type CollectionMap = Record<string, PayloadDocument[]>

type ReadCall = {
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

  if ('in' in record && Array.isArray(record.in)) {
    return record.in.map(String).includes(relationValue(value))
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
  readonly readCalls: ReadCall[] = []

  constructor(private readonly collections: CollectionMap) {}

  async find(args: {
    collection: string
    where?: Record<string, unknown>
    limit?: number
    sort?: string
    overrideAccess?: boolean
  }) {
    this.readCalls.push({
      collection: args.collection,
      where: args.where,
      overrideAccess: args.overrideAccess,
    })
    let docs = [...(this.collections[args.collection] ?? [])].filter((document) =>
      matchesWhere(document, args.where)
    )
    if (args.sort) {
      const direction = args.sort.startsWith('-') ? -1 : 1
      const field = args.sort.replace(/^-/, '')
      docs = docs.sort(
        (a, b) =>
          String(a[field] ?? '').localeCompare(String(b[field] ?? '')) * direction
      )
    }
    return { docs: docs.slice(0, args.limit ?? docs.length) }
  }

  async findByID(args: {
    collection: string
    id: PayloadId
    overrideAccess?: boolean
  }): Promise<PayloadDocument> {
    this.readCalls.push({
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

function space(
  id: string,
  visibility: 'public' | 'members' | 'private' | 'secret',
  status = 'published',
  spaceType = 'announcement'
): PayloadDocument {
  return {
    id,
    name: id.replace(/_/g, ' '),
    slug: id,
    status,
    spaceType,
    visibility,
    requiredAccessGroups: [],
    sortOrder: 0,
  }
}

function post(
  id: string,
  spaceId: string,
  createdAt: string,
  options: {
    pinned?: boolean
    moderationStatus?: string
    postType?: string
  } = {}
): PayloadDocument {
  return {
    id,
    title: id.replace(/_/g, ' '),
    space: spaceId,
    author: 'member_active',
    postType: options.postType ?? 'announcement',
    moderationStatus: options.moderationStatus ?? 'visible',
    pinned: options.pinned ?? false,
    createdAt,
  }
}

function buildPayload(): FakePayload {
  return new FakePayload({
    payload_members: [
      {
        id: 'member_active',
        collection: 'payload_members',
        accountStatus: 'active',
        emailVerifiedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    payload_billing_accounts: [
      {
        id: 'billing_active',
        member: 'member_active',
        billingStatus: 'active',
      },
    ],
    payload_subscriptions: [
      {
        id: 'subscription_active',
        member: 'member_active',
        plan: 'pro',
        status: 'active',
        cancelAtPeriodEnd: false,
      },
    ],
    payload_access_grants: [],
    payload_access_groups: [],
    payload_space_memberships: [],
    payload_spaces: [
      space('space_public', 'public'),
      space('space_members', 'members'),
      space('space_private', 'private'),
      space('space_secret', 'secret'),
      space('space_draft', 'public', 'draft'),
      space('space_archived', 'public', 'archived'),
      space('space_discussion', 'public', 'published', 'discussion'),
    ],
    payload_space_posts: [
      post('public_pinned_old', 'space_public', '2026-01-01T00:00:00.000Z', {
        pinned: true,
      }),
      post('public_new', 'space_public', '2026-06-01T00:00:00.000Z'),
      post('members_visible', 'space_members', '2026-05-01T00:00:00.000Z'),
      post('public_hidden', 'space_public', '2026-06-02T00:00:00.000Z', {
        moderationStatus: 'hidden',
      }),
      post('public_deleted', 'space_public', '2026-06-03T00:00:00.000Z', {
        moderationStatus: 'deleted',
      }),
      post('public_pending', 'space_public', '2026-06-04T00:00:00.000Z', {
        moderationStatus: 'pending_review',
      }),
      post('public_discussion', 'space_public', '2026-06-05T00:00:00.000Z', {
        postType: 'discussion',
      }),
      post('private_visible', 'space_private', '2026-06-06T00:00:00.000Z'),
      post('secret_visible', 'space_secret', '2026-06-07T00:00:00.000Z'),
      post('draft_visible', 'space_draft', '2026-06-08T00:00:00.000Z'),
      post('archived_visible', 'space_archived', '2026-06-09T00:00:00.000Z'),
      post('discussion_space_announcement', 'space_discussion', '2026-06-10T00:00:00.000Z'),
    ],
  })
}

async function testAuthorizedAnnouncementsAndFiltering(): Promise<void> {
  const payload = buildPayload()
  const announcements = await getMemberAnnouncements(payload, 'member_active')

  assert.deepEqual(
    announcements.map((announcement) => announcement.id),
    ['public_pinned_old', 'public_new', 'members_visible']
  )
  assert.equal(announcements[0]?.spaceId, 'space_public')
  assert.equal(announcements[2]?.spaceId, 'space_members')

  const spaceQuery = payload.readCalls.find(
    (call) => call.collection === 'payload_spaces' && call.where
  )
  assert.deepEqual(spaceQuery?.where, {
    and: [
      { status: { equals: 'published' } },
      { spaceType: { equals: 'announcement' } },
    ],
  })

  const postQueries = payload.readCalls.filter(
    (call) => call.collection === 'payload_space_posts'
  )
  const serializedPostQueries = JSON.stringify(postQueries)
  assert.match(serializedPostQueries, /space_public/)
  assert.match(serializedPostQueries, /space_members/)
  assert.doesNotMatch(serializedPostQueries, /space_private/)
  assert.doesNotMatch(serializedPostQueries, /space_secret/)
  assert.doesNotMatch(serializedPostQueries, /space_draft/)
  assert.doesNotMatch(serializedPostQueries, /space_archived/)
  assert.doesNotMatch(serializedPostQueries, /space_discussion/)

  assert(payload.readCalls.length > 0)
  for (const call of payload.readCalls) {
    assert.equal(call.overrideAccess, true)
  }

  const memberReads = payload.readCalls.filter(
    (call) =>
      call.collection === 'payload_members' ||
      JSON.stringify(call.where ?? {}).includes('member_active')
  )
  assert(memberReads.length > 0)
}

function testNoBrowserSelectableAnnouncementAccess(): void {
  const pageSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/app/(frontend)/learn/community/page.tsx'),
    'utf8'
  )

  assert.match(pageSource, /getMemberAnnouncements\(payload, member\.id\)/)
  assert.doesNotMatch(pageSource, /searchParams/)
  assert.doesNotMatch(pageSource, /FormData/)
  assert.doesNotMatch(pageSource, /<form/i)
  assert.doesNotMatch(pageSource, /<input/i)
  assert.doesNotMatch(pageSource, /type=['"]hidden['"]/i)
}

async function main(): Promise<void> {
  await testAuthorizedAnnouncementsAndFiltering()
  testNoBrowserSelectableAnnouncementAccess()
  console.log('payload member announcements tests passed')
}

void main()
