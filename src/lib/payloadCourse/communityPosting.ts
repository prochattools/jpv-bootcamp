import type {
  PayloadCourseWriteAPI,
  PayloadDocument,
  PayloadId,
} from '@/lib/payloadCourse/accessService'
import {
  createAuditEvent,
  queueAndAttemptEmailEvent,
} from '@/lib/payloadCourse/events'

type ActorInput = {
  type: 'admin' | 'member' | 'system' | 'migration'
  id?: PayloadId | null
}

type ModerationStatus = 'visible' | 'pending_review' | 'hidden' | 'deleted'
type SpaceRole = 'member' | 'moderator' | 'admin'

type RateLimitInput = {
  windowMs?: number
  maxCreates?: number
}

type CreateSpacePostInput = {
  memberId: PayloadId
  spaceId: PayloadId
  title: string
  body: Record<string, unknown>
  postType?: 'discussion' | 'question' | 'announcement'
  rateLimit?: RateLimitInput
  adminEmail?: string | null
}

type CreateSpaceCommentInput = {
  memberId: PayloadId
  postId: PayloadId
  displayName?: string | null
  body: Record<string, unknown>
  rateLimit?: RateLimitInput
  adminEmail?: string | null
}

type ModerateSpacePostInput = {
  actor: ActorInput
  postId: PayloadId
  moderationStatus: ModerationStatus
  reason?: string | null
}

type ModerateSpaceCommentInput = {
  actor: ActorInput
  commentId: PayloadId
  moderationStatus: ModerationStatus
  reason?: string | null
}

type CommunityWriteResult = {
  document: PayloadDocument
  auditEvent: PayloadDocument
  emailEvents: PayloadDocument[]
}

const defaultRateLimit = {
  windowMs: 60_000,
  maxCreates: 5,
}

function asString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value
  if (typeof value === 'number') return String(value)
  return null
}

function asRelationshipId(value: PayloadId): number | string {
  if (typeof value === 'number') return value
  const trimmed = String(value).trim()
  if (!trimmed) throw new Error('Relationship ID is required but was empty.')
  const num = Number(trimmed)
  return Number.isFinite(num) ? num : trimmed
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null
  return value as Record<string, unknown>
}

function getDocumentId(value: unknown): string | null {
  const direct = asString(value)
  if (direct) return direct

  const record = asRecord(value)
  if (!record) return null

  return asString(record.id)
}

function normalizeModerationStatus(value: ModerationStatus): ModerationStatus {
  if (
    value === 'visible' ||
    value === 'pending_review' ||
    value === 'hidden' ||
    value === 'deleted'
  ) {
    return value
  }

  throw new Error(`Unsupported moderation status: ${value}`)
}

function normalizePostType(value: CreateSpacePostInput['postType']) {
  if (value === 'question' || value === 'announcement') return value
  return 'discussion'
}

function assertText(value: string, label: string, maxLength: number) {
  const trimmed = value.trim()
  if (!trimmed) throw new Error(`${label} is required.`)
  if (trimmed.length > maxLength) throw new Error(`${label} is too long.`)
  return trimmed
}

function assertBody(body: Record<string, unknown>) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Body must be a Payload rich text object.')
  }
}

async function findOne(
  payload: PayloadCourseWriteAPI,
  collection: string,
  where: Record<string, unknown>,
  sort?: string
) {
  const result = await payload.find({
    collection,
    where,
    limit: 1,
    depth: 0,
    sort,
    overrideAccess: true,
  })

  return result.docs[0] ?? null
}

async function findByIdSafe(
  payload: PayloadCourseWriteAPI,
  collection: string,
  id: PayloadId | null | undefined
) {
  if (!id) return null

  try {
    return await payload.findByID({
      collection,
      id,
      depth: 0,
      overrideAccess: true,
    })
  } catch {
    return null
  }
}

async function findSpace(payload: PayloadCourseWriteAPI, spaceId: PayloadId) {
  return findByIdSafe(payload, 'payload_spaces', spaceId)
}

async function findPost(payload: PayloadCourseWriteAPI, postId: PayloadId) {
  return findByIdSafe(payload, 'payload_space_posts', postId)
}

async function findComment(payload: PayloadCourseWriteAPI, commentId: PayloadId) {
  return findByIdSafe(payload, 'payload_space_comments', commentId)
}

async function findMembership(
  payload: PayloadCourseWriteAPI,
  memberId: PayloadId,
  spaceId: PayloadId
) {
  return findOne(payload, 'payload_space_memberships', {
    and: [
      { member: { equals: String(memberId) } },
      { space: { equals: String(spaceId) } },
    ],
  })
}

function membershipRole(membership: PayloadDocument | null): SpaceRole | null {
  const role = asString(membership?.role)
  if (role === 'member' || role === 'moderator' || role === 'admin') return role
  return null
}

const approvedPublishingRoles: readonly SpaceRole[] = ['member', 'moderator', 'admin']

function membershipAllowsWrite(membership: PayloadDocument | null) {
  const role = membershipRole(membership)
  return (
    membership?.status === 'active' &&
    role !== null &&
    approvedPublishingRoles.includes(role)
  )
}

function membershipAllowsModeration(membership: PayloadDocument | null) {
  const role = membershipRole(membership)
  return membership?.status === 'active' && (role === 'moderator' || role === 'admin')
}

async function assertSpaceWriteAccess(
  payload: PayloadCourseWriteAPI,
  memberId: PayloadId,
  spaceId: PayloadId
) {
  const [space, membership] = await Promise.all([
    findSpace(payload, spaceId),
    findMembership(payload, memberId, spaceId),
  ])

  if (!space || space.status !== 'published') {
    throw new Error('Space is not published.')
  }

  if (!membershipAllowsWrite(membership)) {
    throw new Error('Active space membership is required before posting.')
  }

  return { space, membership }
}

async function assertModeratorAccess(
  payload: PayloadCourseWriteAPI,
  actor: ActorInput,
  spaceId: PayloadId
) {
  if (actor.type === 'admin' || actor.type === 'system' || actor.type === 'migration') {
    return
  }

  if (!actor.id) throw new Error('Moderator member id is required.')
  const membership = await findMembership(payload, actor.id, spaceId)
  if (!membershipAllowsModeration(membership)) {
    throw new Error('Moderator or space admin role is required.')
  }
}

async function assertCreateRateLimit(
  payload: PayloadCourseWriteAPI,
  args: {
    collection: 'payload_space_posts' | 'payload_space_comments'
    authorId: PayloadId
    rateLimit?: RateLimitInput
  }
) {
  const windowMs = args.rateLimit?.windowMs ?? defaultRateLimit.windowMs
  const maxCreates = args.rateLimit?.maxCreates ?? defaultRateLimit.maxCreates
  const cutoff = Date.now() - windowMs
  const result = await payload.find({
    collection: args.collection,
    where: {
      author: { equals: String(args.authorId) },
    },
    limit: 25,
    depth: 0,
    sort: '-createdAt',
    overrideAccess: true,
  })

  const recentCreates = result.docs.filter((doc) => {
    const createdAt = asString(doc.createdAt)
    if (!createdAt) return false
    return new Date(createdAt).getTime() >= cutoff
  })

  if (recentCreates.length >= maxCreates) {
    throw new Error('Community posting rate limit exceeded.')
  }
}

async function queueModerationEmail(
  payload: PayloadCourseWriteAPI,
  args: {
    adminEmail?: string | null
    action: string
    document: PayloadDocument
    spaceId: PayloadId
    memberId?: PayloadId | null
  }
) {
  const { queuePendingCommunityModerationNotifications } = await import(
    '@/lib/payloadCourse/communityModerationNotifications'
  )
  await queuePendingCommunityModerationNotifications(payload, {
    kind: args.action === 'space-post-created' ? 'post' : 'comment',
    recordId: args.document.id,
    spaceId: args.spaceId,
  })

  if (!args.adminEmail) return []

  const { event } = await queueAndAttemptEmailEvent(payload, {
    toEmail: args.adminEmail,
    templateKey: 'admin-notification',
    dedupeKey: `admin-notification:${args.action}:${args.document.id}`,
    metadata: {
      action: args.action,
      documentId: String(args.document.id),
      spaceId: String(args.spaceId),
      memberId: args.memberId ? String(args.memberId) : null,
    },
  })

  return [event]
}

export async function createSpacePost(
  payload: PayloadCourseWriteAPI,
  input: CreateSpacePostInput
): Promise<CommunityWriteResult> {
  const title = assertText(input.title, 'Title', 160)
  assertBody(input.body)

  await assertCreateRateLimit(payload, {
    collection: 'payload_space_posts',
    authorId: input.memberId,
    rateLimit: input.rateLimit,
  })
  await assertSpaceWriteAccess(payload, input.memberId, input.spaceId)

  const post = await payload.create({
    collection: 'payload_space_posts',
    data: {
      title,
      space: asRelationshipId(input.spaceId),
      author: asRelationshipId(input.memberId),
      postType: normalizePostType(input.postType),
      body: input.body,
      moderationStatus: 'visible',
      pinned: false,
      locked: false,
      metadata: {
        createdByService: 'communityPosting.createSpacePost',
      },
    },
    overrideAccess: true,
  })

  const auditEvent = await createAuditEvent(payload, {
    actorType: 'member',
    actorId: input.memberId,
    action: 'space_post.created',
    targetCollection: 'payload_space_posts',
    targetId: post.id,
    after: post,
    metadata: {
      spaceId: String(input.spaceId),
      moderationStatus: 'visible',
    },
  })

  const emailEvents = await queueModerationEmail(payload, {
    adminEmail: input.adminEmail,
    action: 'space-post-created',
    document: post,
    spaceId: input.spaceId,
    memberId: input.memberId,
  })

  return {
    document: post,
    auditEvent,
    emailEvents,
  }
}

export async function createSpaceComment(
  payload: PayloadCourseWriteAPI,
  input: CreateSpaceCommentInput
): Promise<CommunityWriteResult> {
  assertBody(input.body)

  const post = await findPost(payload, input.postId)
  if (!post) throw new Error(`Missing space post: ${input.postId}`)
  if (post.moderationStatus !== 'visible') {
    throw new Error('Comments can only be created on visible posts.')
  }
  if (post.locked === true) {
    throw new Error('Comments are locked for this post.')
  }

  const spaceId = getDocumentId(post.space)
  if (!spaceId) throw new Error('Post is missing its space relationship.')

  await assertCreateRateLimit(payload, {
    collection: 'payload_space_comments',
    authorId: input.memberId,
    rateLimit: input.rateLimit,
  })
  await assertSpaceWriteAccess(payload, input.memberId, spaceId)

  const comment = await payload.create({
    collection: 'payload_space_comments',
    data: {
      displayName: input.displayName ?? `member:${input.memberId} -> post:${input.postId}`,
      post: asRelationshipId(input.postId),
      author: asRelationshipId(input.memberId),
      body: input.body,
      moderationStatus: 'visible',
      metadata: {
        createdByService: 'communityPosting.createSpaceComment',
        spaceId,
      },
    },
    overrideAccess: true,
  })

  const auditEvent = await createAuditEvent(payload, {
    actorType: 'member',
    actorId: input.memberId,
    action: 'space_comment.created',
    targetCollection: 'payload_space_comments',
    targetId: comment.id,
    after: comment,
    metadata: {
      postId: String(input.postId),
      spaceId,
      moderationStatus: 'visible',
    },
  })

  const emailEvents = await queueModerationEmail(payload, {
    adminEmail: input.adminEmail,
    action: 'space-comment-created',
    document: comment,
    spaceId,
    memberId: input.memberId,
  })

  return {
    document: comment,
    auditEvent,
    emailEvents,
  }
}

export async function moderateSpacePost(
  payload: PayloadCourseWriteAPI,
  input: ModerateSpacePostInput
): Promise<CommunityWriteResult> {
  const post = await findPost(payload, input.postId)
  if (!post) throw new Error(`Missing space post: ${input.postId}`)

  const spaceId = getDocumentId(post.space)
  if (!spaceId) throw new Error('Post is missing its space relationship.')
  await assertModeratorAccess(payload, input.actor, spaceId)

  const moderationStatus = normalizeModerationStatus(input.moderationStatus)
  const updated = await payload.update({
    collection: 'payload_space_posts',
    id: post.id,
    data: {
      moderationStatus,
      metadata: {
        ...(typeof post.metadata === 'object' && post.metadata ? post.metadata : {}),
        moderationReason: input.reason ?? null,
        moderatedBy: input.actor.id ? String(input.actor.id) : input.actor.type,
      },
    },
    overrideAccess: true,
  })

  const auditEvent = await createAuditEvent(payload, {
    actorType: input.actor.type,
    actorId: input.actor.id,
    action: 'space_post.moderated',
    targetCollection: 'payload_space_posts',
    targetId: updated.id,
    before: post,
    after: updated,
    metadata: {
      spaceId,
      moderationStatus,
      reason: input.reason ?? null,
    },
  })

  return {
    document: updated,
    auditEvent,
    emailEvents: [],
  }
}

export async function moderateSpaceComment(
  payload: PayloadCourseWriteAPI,
  input: ModerateSpaceCommentInput
): Promise<CommunityWriteResult> {
  const comment = await findComment(payload, input.commentId)
  if (!comment) throw new Error(`Missing space comment: ${input.commentId}`)

  const postId = getDocumentId(comment.post)
  if (!postId) throw new Error('Comment is missing its post relationship.')

  const post = await findPost(payload, postId)
  if (!post) throw new Error(`Missing space post: ${postId}`)
  const spaceId = getDocumentId(post.space)
  if (!spaceId) throw new Error('Post is missing its space relationship.')
  await assertModeratorAccess(payload, input.actor, spaceId)

  const moderationStatus = normalizeModerationStatus(input.moderationStatus)
  const updated = await payload.update({
    collection: 'payload_space_comments',
    id: comment.id,
    data: {
      moderationStatus,
      metadata: {
        ...(typeof comment.metadata === 'object' && comment.metadata ? comment.metadata : {}),
        moderationReason: input.reason ?? null,
        moderatedBy: input.actor.id ? String(input.actor.id) : input.actor.type,
      },
    },
    overrideAccess: true,
  })

  const auditEvent = await createAuditEvent(payload, {
    actorType: input.actor.type,
    actorId: input.actor.id,
    action: 'space_comment.moderated',
    targetCollection: 'payload_space_comments',
    targetId: updated.id,
    before: comment,
    after: updated,
    metadata: {
      postId,
      spaceId,
      moderationStatus,
      reason: input.reason ?? null,
    },
  })

  return {
    document: updated,
    auditEvent,
    emailEvents: [],
  }
}
