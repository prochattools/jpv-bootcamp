import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type {
  PayloadCourseWriteAPI,
  PayloadDocument,
  PayloadId,
} from '../src/lib/payloadCourse/accessService'
import {
  getCommunityModerationCapability,
  getMemberCommunitySubmissions,
  getPendingCommunityModerationItems,
  moderatePendingCommunityItem,
} from '../src/lib/payloadCourse/communityModeration'
import {
  resolveCommunityModerationRecipients,
  queueCommunityModerationOutcomeNotification,
  queuePendingCommunityModerationNotifications,
} from '../src/lib/payloadCourse/communityModerationNotifications'
import {
  resolveModerationCommunityFileDownload,
} from '../src/lib/payloadCourse/communityFiles'

type CollectionMap = Record<string, PayloadDocument[]>

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
  return false
}

function matchesWhere(doc: PayloadDocument, where?: Record<string, unknown>): boolean {
  if (!where) return true
  if (Array.isArray(where.and)) {
    return where.and.every((entry) =>
      matchesWhere(doc, entry as Record<string, unknown>)
    )
  }

  return Object.entries(where).every(([field, condition]) => {
    if (field === 'and') return true
    return matchesCondition(doc[field], condition)
  })
}

class FakePayload implements PayloadCourseWriteAPI {
  private nextId = 1000

  constructor(
    protected readonly collections: CollectionMap,
    private readonly failEmailEvents = false
  ) {}

  async find(args: {
    collection: string
    where?: Record<string, unknown>
    limit?: number
    sort?: string
  }) {
    let docs = [...(this.collections[args.collection] ?? [])].filter((doc) =>
      matchesWhere(doc, args.where)
    )

    if (args.sort) {
      const descending = args.sort.startsWith('-')
      const field = args.sort.replace(/^-/, '')
      docs.sort((a, b) =>
        String(a[field] ?? '').localeCompare(String(b[field] ?? '')) *
        (descending ? -1 : 1)
      )
    }

    return { docs: docs.slice(0, args.limit ?? docs.length) }
  }

  async findByID(args: { collection: string; id: PayloadId }) {
    const document = (this.collections[args.collection] ?? []).find(
      (item) => String(item.id) === String(args.id)
    )
    if (!document) throw new Error(`missing ${args.collection}:${args.id}`)
    return document
  }

  async create(args: { collection: string; data: Record<string, unknown> }) {
    if (this.failEmailEvents && args.collection === 'payload_email_events') {
      throw new Error('email queue unavailable')
    }

    const document: PayloadDocument = {
      id: `${args.collection}_${this.nextId++}`,
      createdAt: new Date().toISOString(),
      ...args.data,
    }
    this.collections[args.collection] = this.collections[args.collection] ?? []
    this.collections[args.collection].push(document)
    return document
  }

  async update(args: {
    collection: string
    id: PayloadId
    data: Record<string, unknown>
  }) {
    const documents = this.collections[args.collection] ?? []
    const index = documents.findIndex(
      (document) => String(document.id) === String(args.id)
    )
    if (index < 0) throw new Error(`missing ${args.collection}:${args.id}`)
    documents[index] = { ...documents[index], ...args.data }
    return documents[index]
  }

  docs(collection: string): PayloadDocument[] {
    return this.collections[collection] ?? []
  }
}

const richText = (text: string) => ({
  root: {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: [{ type: 'text', text }],
      },
    ],
  },
})

function baseCollections(): CollectionMap {
  return {
    payload_users: [
      { id: 'admin_1', email: 'Admin@Example.com' },
      { id: 'admin_2', email: 'admin@example.com' },
      { id: 'admin_3', email: 'second@example.com' },
    ],
    payload_members: [
      {
        id: 'member_moderator',
        email: 'moderator@example.com',
        displayName: 'Trusted Moderator',
      },
      {
        id: 'member_admin',
        email: 'space-admin@example.com',
        displayName: 'Space Administrator',
      },
      {
        id: 'member_author',
        email: 'author@example.com',
        displayName: 'Submission Author',
      },
      {
        id: 'member_other',
        email: 'other@example.com',
        displayName: 'Other Member',
      },
    ],
    payload_spaces: [
      {
        id: 'space_private',
        name: 'Private Cohort',
        slug: 'private-cohort',
        privacy: 'private',
        accessPolicy: 'never-project-this',
      },
      {
        id: 'space_secret',
        name: 'Secret Cohort',
        slug: 'secret-cohort',
        privacy: 'secret',
      },
      {
        id: 'space_empty',
        name: 'Empty Moderation Space',
        slug: 'empty-space',
        privacy: 'private',
      },
    ],
    payload_space_memberships: [
      {
        id: 'membership_moderator',
        member: 'member_moderator',
        space: 'space_private',
        role: 'moderator',
        status: 'active',
      },
      {
        id: 'membership_empty',
        member: 'member_moderator',
        space: 'space_empty',
        role: 'moderator',
        status: 'active',
      },
      {
        id: 'membership_admin',
        member: 'member_admin',
        space: 'space_secret',
        role: 'admin',
        status: 'active',
      },
      {
        id: 'membership_regular',
        member: 'member_other',
        space: 'space_private',
        role: 'member',
        status: 'active',
      },
    ],
    payload_space_posts: [
      {
        id: 'post_private_pending',
        title: 'Private pending post',
        body: richText('Private pending body'),
        postType: 'discussion',
        author: 'member_author',
        space: 'space_private',
        moderationStatus: 'pending_review',
        createdAt: '2026-06-20T10:00:00.000Z',
        metadata: { moderationReason: 'must not leak' },
      },
      {
        id: 'post_private_visible',
        title: 'Published post',
        body: richText('Published body'),
        author: 'member_author',
        space: 'space_private',
        moderationStatus: 'visible',
        createdAt: '2026-06-19T10:00:00.000Z',
      },
      {
        id: 'post_secret_pending',
        title: 'Secret pending post',
        body: richText('Secret body'),
        author: 'member_author',
        space: 'space_secret',
        moderationStatus: 'pending_review',
        createdAt: '2026-06-21T10:00:00.000Z',
      },
      {
        id: 'post_other_visible',
        title: 'Other member post',
        body: richText('Other body'),
        author: 'member_other',
        space: 'space_private',
        moderationStatus: 'visible',
        createdAt: '2026-06-18T10:00:00.000Z',
      },
    ],
    payload_space_comments: [
      {
        id: 'comment_private_pending',
        post: 'post_private_pending',
        author: 'member_author',
        displayName: 'Submission Author',
        body: richText('Pending reply'),
        moderationStatus: 'pending_review',
        createdAt: '2026-06-20T11:00:00.000Z',
      },
      {
        id: 'comment_private_hidden',
        post: 'post_private_visible',
        author: 'member_author',
        body: richText('Hidden reply'),
        moderationStatus: 'hidden',
        createdAt: '2026-06-19T11:00:00.000Z',
      },
      {
        id: 'comment_other_visible',
        post: 'post_private_visible',
        author: 'member_other',
        body: richText('Other reply'),
        moderationStatus: 'visible',
        createdAt: '2026-06-19T12:00:00.000Z',
      },
    ],
    payload_private_media: [
      {
        id: 'media_pending',
        filename: 'pending-guide.pdf',
        mimeType: 'application/pdf',
        filesize: 2048,
        path: '/private/never-project-this',
        url: 'https://private.example/never-project-this',
      },
      {
        id: 'media_visible',
        filename: 'published-guide.pdf',
        mimeType: 'application/pdf',
        filesize: 4096,
      },
    ],
    payload_space_files: [
      {
        id: 'file_private_pending',
        title: 'Pending guide',
        space: 'space_private',
        uploadedBy: 'member_author',
        protectedFile: 'media_pending',
        moderationStatus: 'pending_review',
        createdAt: '2026-06-20T12:00:00.000Z',
        metadata: { storageReference: 'must-not-leak' },
      },
      {
        id: 'file_private_visible',
        title: 'Published guide',
        space: 'space_private',
        uploadedBy: 'member_author',
        protectedFile: 'media_visible',
        moderationStatus: 'visible',
        createdAt: '2026-06-18T12:00:00.000Z',
      },
      {
        id: 'file_private_hidden',
        title: 'Hidden guide',
        space: 'space_private',
        uploadedBy: 'member_author',
        protectedFile: 'media_pending',
        moderationStatus: 'hidden',
        createdAt: '2026-06-17T12:00:00.000Z',
      },
      {
        id: 'file_other_visible',
        title: 'Other member guide',
        space: 'space_private',
        uploadedBy: 'member_other',
        protectedFile: 'media_visible',
        moderationStatus: 'visible',
        createdAt: '2026-06-16T12:00:00.000Z',
      },
    ],
    payload_audit_events: [],
    payload_email_events: [],
  }
}

async function testInboxAuthorizationAndProjection() {
  const payload = new FakePayload(baseCollections())
  const moderatorInbox = await getPendingCommunityModerationItems(payload, {
    type: 'member',
    id: 'member_moderator',
  })
  assert.equal(moderatorInbox.actorRole, 'moderator')
  assert.deepEqual(
    [...new Set(moderatorInbox.items.map((item) => item.space.name))],
    ['Private Cohort']
  )
  assert.equal(
    moderatorInbox.items.some((item) => item.kind === 'post'),
    true
  )
  assert.equal(
    moderatorInbox.items.some((item) => item.kind === 'comment'),
    true
  )
  assert.equal(
    moderatorInbox.items.some((item) => item.kind === 'file'),
    true
  )

  const serialized = JSON.stringify(moderatorInbox)
  for (const forbidden of [
    'author@example.com',
    'member_author',
    'moderationReason',
    'accessPolicy',
    'storageReference',
    '/private/',
    'private.example',
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden)
  }
  assert.equal(serialized.includes('post_private_visible'), false)
  assert.equal(serialized.includes('post_secret_pending'), false)

  const adminInbox = await getPendingCommunityModerationItems(payload, {
    type: 'admin',
    id: 'admin_1',
  })
  assert.equal(adminInbox.actorRole, 'platform_admin')
  assert.equal(
    adminInbox.items.some((item) => item.space.name === 'Secret Cohort'),
    true
  )

  const spaceAdminInbox = await getPendingCommunityModerationItems(payload, {
    type: 'member',
    id: 'member_admin',
  })
  assert.equal(spaceAdminInbox.actorRole, 'space_admin')
  assert.deepEqual(
    [...new Set(spaceAdminInbox.items.map((item) => item.space.name))],
    ['Secret Cohort']
  )

  const unrelated = await getPendingCommunityModerationItems(payload, {
    type: 'member',
    id: 'member_other',
  })
  assert.equal(unrelated.actorRole, null)
  assert.deepEqual(unrelated.items, [])
}

async function testEmptyInboxAndMembershipStates() {
  const collections = baseCollections()
  collections.payload_space_posts = []
  collections.payload_space_comments = []
  collections.payload_space_files = []
  const payload = new FakePayload(collections)

  const inbox = await getPendingCommunityModerationItems(payload, {
    type: 'member',
    id: 'member_moderator',
  })
  assert.equal(inbox.actorRole, 'moderator')
  assert.deepEqual(inbox.items, [])

  for (const status of ['pending', 'muted', 'blocked', 'removed']) {
    const state = baseCollections()
    state.payload_space_memberships = [
      {
        id: `membership_${status}`,
        member: 'member_other',
        space: 'space_private',
        role: 'moderator',
        status,
      },
    ]
    const denied = await getCommunityModerationCapability(
      new FakePayload(state),
      { type: 'member', id: 'member_other' },
      'space_private'
    )
    assert.equal(denied.allowed, false, status)
  }
}

async function testPendingFilePreview() {
  const payload = new FakePayload(baseCollections())
  const allowed = await resolveModerationCommunityFileDownload(
    payload,
    { type: 'member', id: 'member_moderator' },
    'file_private_pending'
  )
  assert.equal(allowed.allowed, true)
  if (allowed.allowed) {
    assert.equal(allowed.filename, 'pending-guide.pdf')
    assert.equal(allowed.downloadUrl, '/learn/community/files/file_private_pending')
    assert.equal(JSON.stringify(allowed).includes('/private/'), false)
  }

  const unrelated = await resolveModerationCommunityFileDownload(
    payload,
    { type: 'member', id: 'member_other' },
    'file_private_pending'
  )
  assert.deepEqual(unrelated, { allowed: false, reason: 'not_found' })

  for (const id of ['file_private_visible', 'file_private_hidden']) {
    const denied = await resolveModerationCommunityFileDownload(
      payload,
      { type: 'member', id: 'member_moderator' },
      id
    )
    assert.deepEqual(denied, { allowed: false, reason: 'not_found' })
  }
}

async function testAuditedModerationAndNotificationIsolation() {
  const state = baseCollections()
  const payload = new FakePayload(state, true)
  const approved = await moderatePendingCommunityItem(payload, {
    actor: { type: 'member', id: 'member_moderator' },
    kind: 'file',
    id: 'file_private_pending',
    decision: 'approve',
  })
  assert.deepEqual(approved, {
    allowed: true,
    status: 'visible',
    changed: true,
  })
  assert.equal(
    state.payload_space_files.find((item) => item.id === 'file_private_pending')
      ?.moderationStatus,
    'visible'
  )
  assert.equal(
    payload.docs('payload_audit_events').some(
      (event) => event.action === 'space_file.moderated'
    ),
    true
  )

  const rejectState = baseCollections()
  const rejectPayload = new FakePayload(rejectState)
  const missingReason = await moderatePendingCommunityItem(rejectPayload, {
    actor: { type: 'member', id: 'member_moderator' },
    kind: 'file',
    id: 'file_private_pending',
    decision: 'reject',
  })
  assert.deepEqual(missingReason, { allowed: false, reason: 'not_found' })
  assert.equal(
    rejectState.payload_space_files.find(
      (item) => item.id === 'file_private_pending'
    )?.moderationStatus,
    'pending_review'
  )

  const rejected = await moderatePendingCommunityItem(rejectPayload, {
    actor: { type: 'member', id: 'member_moderator' },
    kind: 'file',
    id: 'file_private_pending',
    decision: 'reject',
    reason: 'This file requires revision.',
  })
  assert.equal(rejected.allowed, true)
  assert.equal(
    rejectState.payload_space_files.find(
      (item) => item.id === 'file_private_pending'
    )?.moderationStatus,
    'hidden'
  )
}

async function testRecipientsAndDedupeKeys() {
  const state = baseCollections()
  const payload = new FakePayload(state)
  const previous = process.env.COMMUNITY_MODERATION_NOTIFICATION_EMAILS
  process.env.COMMUNITY_MODERATION_NOTIFICATION_EMAILS =
    'admin@example.com; configured@example.com;CONFIGURED@example.com'

  try {
    const recipients = await resolveCommunityModerationRecipients(payload)
    assert.deepEqual(recipients, [
      'admin@example.com',
      'configured@example.com',
      'second@example.com',
    ])

    await queuePendingCommunityModerationNotifications(payload, {
      kind: 'post',
      recordId: 'post_private_pending',
      spaceId: 'space_private',
    })
    await queuePendingCommunityModerationNotifications(payload, {
      kind: 'post',
      recordId: 'post_private_pending',
      spaceId: 'space_private',
    })

    const pendingEvents = payload
      .docs('payload_email_events')
      .filter((event) =>
        String(event.dedupeKey).startsWith(
          'community-moderation:pending:post:post_private_pending:'
        )
      )
    assert.equal(pendingEvents.length, 3)

    await queueCommunityModerationOutcomeNotification(payload, {
      kind: 'file',
      recordId: 'file_private_pending',
      spaceId: 'space_private',
      authorId: 'member_author',
      outcome: 'visible',
    })
    await queueCommunityModerationOutcomeNotification(payload, {
      kind: 'file',
      recordId: 'file_private_pending',
      spaceId: 'space_private',
      authorId: 'member_author',
      outcome: 'visible',
    })

    const outcomeEvents = payload
      .docs('payload_email_events')
      .filter(
        (event) =>
          event.dedupeKey ===
          'community-moderation:outcome:file:file_private_pending:visible'
      )
    assert.equal(outcomeEvents.length, 1)
  } finally {
    if (previous === undefined) {
      delete process.env.COMMUNITY_MODERATION_NOTIFICATION_EMAILS
    } else {
      process.env.COMMUNITY_MODERATION_NOTIFICATION_EMAILS = previous
    }
  }
}

async function testMemberSubmissionProjection() {
  const payload = new FakePayload(baseCollections())
  const submissions = await getMemberCommunitySubmissions(
    payload,
    'member_author'
  )
  assert.equal(submissions.length, 8)
  assert.equal(
    submissions.some((item) => item.title === 'Other member post'),
    false
  )
  assert.equal(
    submissions.some((item) => item.title === 'Other member guide'),
    false
  )

  const visibleFile = submissions.find(
    (item) => item.title === 'Published guide'
  )
  assert.equal(visibleFile?.status, 'Published')
  assert.equal(
    visibleFile?.downloadUrl,
    '/learn/community/files/file_private_visible'
  )

  for (const item of submissions.filter(
    (submission) =>
      submission.kind === 'file' && submission.status !== 'Published'
  )) {
    assert.equal(item.downloadUrl, null)
  }

  const serialized = JSON.stringify(submissions)
  for (const forbidden of [
    'author@example.com',
    'member_author',
    'moderationReason',
    'metadata',
    'accessPolicy',
    'storageReference',
    '/private/',
    'private.example',
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden)
  }
}

async function testSourceContracts() {
  const root = process.cwd()
  const files = [
    'src/lib/payloadCourse/communityModeration.ts',
    'src/lib/payloadCourse/communityModerationNotifications.ts',
    'src/lib/payloadCourse/communityFiles.ts',
    'src/lib/payloadCourse/communityPosting.ts',
    'src/app/(frontend)/learn/community/files/[fileId]/route.ts',
    'src/app/(frontend)/learn/community/moderation/page.tsx',
    'src/app/(frontend)/learn/community/submissions/page.tsx',
  ]
  const sources = await Promise.all(
    files.map((file) => readFile(path.join(root, file), 'utf8'))
  )
  const joined = sources.join('\n')

  assert.equal(joined.includes('dangerouslySetInnerHTML'), false)
  assert.equal(joined.includes('.graphifyignore'), false)
  assert.equal(joined.includes('graphify-out/'), false)
  assert.match(joined, /resolveModerationCommunityFileDownload/)
  assert.match(joined, /queueCommunityModerationOutcomeNotification/)
  assert.match(joined, /getMemberCommunitySubmissions/)
  assert.match(joined, /\?moderation=preview/)
}

async function main() {
  await testInboxAuthorizationAndProjection()
  await testEmptyInboxAndMembershipStates()
  await testPendingFilePreview()
  await testAuditedModerationAndNotificationIsolation()
  await testRecipientsAndDedupeKeys()
  await testMemberSubmissionProjection()
  await testSourceContracts()
  console.log('payload community moderation tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
