import {
  evaluatePayloadLessonAccess,
  evaluatePayloadSpaceAccess,
  type PayloadCourseAccessAPI,
  type PayloadCourseWriteAPI,
  type PayloadDocument,
  type PayloadId,
} from '@/lib/payloadCourse/accessService'
import { createAuditEvent } from '@/lib/payloadCourse/events'
import { isEligibleCurrentMember } from '@/lib/members/currentMember'
import { normalizeRelationshipId, relationshipId } from '@/lib/domain/relationships'
import { memberCanAccessContent } from '@/lib/payloadContent/audience'

export const REACTION_COLLECTION = 'payload_engagement_reactions' as const

export const reactionTypes = ['helpful', 'insightful', 'celebrate'] as const
export type ReactionType = (typeof reactionTypes)[number]

export const reactionTargetKinds = ['space_post', 'space_comment', 'lesson_comment', 'content_post', 'content_page'] as const
export type ReactionTargetKind = (typeof reactionTargetKinds)[number]

export type ReactionTarget = {
  kind: ReactionTargetKind
  id: PayloadId
}

export type ReactionCount = {
  reactionType: ReactionType
  label: string
  count: number
}

export type ReactionSummary = {
  target: ReactionTarget
  counts: ReactionCount[]
  totalCount: number
  viewerReaction: ReactionType | null
  canReact: boolean
}

export type ReactionMutation = {
  operation: 'created' | 'changed' | 'removed'
  reaction: ReactionType | null
}

export type ReactionErrorCode =
  | 'unauthenticated'
  | 'ineligible'
  | 'target_not_found'
  | 'target_inaccessible'
  | 'target_hidden'
  | 'target_not_supported'
  | 'invalid_reaction'
  | 'rate_limited'
  | 'conflict'
  | 'service_unavailable'

export class ReactionServiceError extends Error {
  readonly code: ReactionErrorCode

  constructor(code: ReactionErrorCode, message: string) {
    super(message)
    this.name = 'ReactionServiceError'
    this.code = code
  }
}

export type PayloadReactionWriteAPI = PayloadCourseWriteAPI & {
  delete(args: {
    collection: string
    id: PayloadId
    overrideAccess?: boolean
  }): Promise<PayloadDocument>
}

type ReactionDocument = PayloadDocument & {
  member?: PayloadId | Record<string, unknown> | null
  reactionType?: string | null
  targetKind?: string | null
  targetPost?: PayloadId | Record<string, unknown> | null
  targetSpaceComment?: PayloadId | Record<string, unknown> | null
  targetLessonComment?: PayloadId | Record<string, unknown> | null
  targetContentPost?: PayloadId | Record<string, unknown> | null
  targetContentPage?: PayloadId | Record<string, unknown> | null
  createdAt?: string | null
  updatedAt?: string | null
}

const reactionLabels: Record<ReactionType, string> = {
  helpful: 'Helpful',
  insightful: 'Insightful',
  celebrate: 'Celebrate',
}

const targetFieldByKind: Record<ReactionTargetKind, keyof ReactionDocument> = {
  space_post: 'targetPost',
  space_comment: 'targetSpaceComment',
  lesson_comment: 'targetLessonComment',
  content_post: 'targetContentPost',
  content_page: 'targetContentPage',
}

const supportedMutationTargets = new Set<ReactionTargetKind>([
  'space_post',
  'space_comment',
  'lesson_comment',
  'content_post',
  'content_page',
])

function asString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number') return String(value)
  return null
}

function normalizeReactionType(value: unknown): ReactionType {
  if (value === 'helpful' || value === 'insightful' || value === 'celebrate') return value
  throw new ReactionServiceError('invalid_reaction', 'That reaction type is not available.')
}

function normalizeTarget(target: ReactionTarget): ReactionTarget {
  if (!target || !reactionTargetKinds.includes(target.kind)) {
    throw new ReactionServiceError('target_not_found', 'Reaction target was not found.')
  }

  const id = asString(target.id)
  if (!id) throw new ReactionServiceError('target_not_found', 'Reaction target was not found.')

  return { kind: target.kind, id }
}

function targetWhere(target: ReactionTarget): Record<string, unknown> {
  const field = targetFieldByKind[target.kind]
  return {
    targetKind: { equals: target.kind },
    [field]: { equals: target.id },
  }
}

function findMemberWhere(memberId: PayloadId): Record<string, unknown> {
  return { member: { equals: String(memberId) } }
}

async function findOne(
  payload: PayloadCourseAccessAPI,
  collection: string,
  where: Record<string, unknown>,
): Promise<PayloadDocument | null> {
  const result = await payload.find({
    collection,
    where,
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return result.docs[0] ?? null
}

async function findById(
  payload: PayloadCourseAccessAPI,
  collection: string,
  id: PayloadId,
): Promise<PayloadDocument | null> {
  try {
    return await payload.findByID({ collection, id, depth: 0, overrideAccess: true })
  } catch {
    return null
  }
}

async function requireEligibleMember(
  payload: PayloadCourseAccessAPI,
  memberId: PayloadId,
): Promise<void> {
  const member = await findById(payload, 'payload_members', memberId)
  if (!member) throw new ReactionServiceError('unauthenticated', 'Authentication is required.')

  if (!isEligibleCurrentMember({
    accountStatus: asString(member.accountStatus),
    emailVerifiedAt: typeof member.emailVerifiedAt === 'string' || member.emailVerifiedAt instanceof Date
      ? member.emailVerifiedAt
      : null,
    source: asString(member.source),
  })) {
    throw new ReactionServiceError('ineligible', 'This account cannot react right now.')
  }
}

async function assertVisibleTarget(
  payload: PayloadCourseAccessAPI,
  memberId: PayloadId,
  target: ReactionTarget,
): Promise<PayloadDocument> {
  if (!supportedMutationTargets.has(target.kind)) {
    throw new ReactionServiceError('target_not_supported', 'This target does not support reactions yet.')
  }

  if (target.kind === 'space_post') {
    const post = await findById(payload, 'payload_space_posts', target.id)
    if (!post) throw new ReactionServiceError('target_not_found', 'Reaction target was not found.')
    if (post.moderationStatus !== 'visible') {
      throw new ReactionServiceError('target_hidden', 'This target is not available for reactions.')
    }

    const spaceId = relationshipId(post.space)
    if (!spaceId) throw new ReactionServiceError('target_inaccessible', 'This target is not available for reactions.')

    const access = await evaluatePayloadSpaceAccess(payload, {
      memberId,
      spaceId,
    })
    if (!access.decision.allowed) {
      throw new ReactionServiceError('target_inaccessible', 'This target is not available for reactions.')
    }

    return post
  }

  if (target.kind === 'space_comment') {
    const comment = await findById(payload, 'payload_space_comments', target.id)
    if (!comment) throw new ReactionServiceError('target_not_found', 'Reaction target was not found.')
    if (comment.moderationStatus !== 'visible') {
      throw new ReactionServiceError('target_hidden', 'This target is not available for reactions.')
    }

    const postId = relationshipId(comment.post)
    if (!postId) throw new ReactionServiceError('target_inaccessible', 'This target is not available for reactions.')

    const post = await findById(payload, 'payload_space_posts', postId)
    if (!post) throw new ReactionServiceError('target_not_found', 'Reaction target was not found.')
    if (post.moderationStatus !== 'visible') {
      throw new ReactionServiceError('target_hidden', 'This target is not available for reactions.')
    }

    const spaceId = relationshipId(post.space)
    if (!spaceId) throw new ReactionServiceError('target_inaccessible', 'This target is not available for reactions.')

    const access = await evaluatePayloadSpaceAccess(payload, {
      memberId,
      spaceId,
    })
    if (!access.decision.allowed) {
      throw new ReactionServiceError('target_inaccessible', 'This target is not available for reactions.')
    }

    return comment
  }

  if (target.kind === 'content_post' || target.kind === 'content_page') {
    const collection = target.kind === 'content_post' ? 'payload_posts' : 'payload_pages'
    const content = await findById(payload, collection, target.id)
    if (!content) throw new ReactionServiceError('target_not_found', 'Reaction target was not found.')
    if (content.status !== 'published') {
      throw new ReactionServiceError('target_hidden', 'This target is not available for reactions.')
    }
    if (!await memberCanAccessContent(payload, content, String(memberId))) {
      throw new ReactionServiceError('target_inaccessible', 'This target is not available for reactions.')
    }
    return content
  }

  const comment = await findById(payload, 'payload_lesson_comments', target.id)
  if (!comment) throw new ReactionServiceError('target_not_found', 'Reaction target was not found.')
  if (comment.moderationStatus !== 'visible') {
    throw new ReactionServiceError('target_hidden', 'This target is not available for reactions.')
  }
  if (relationshipId(comment.parent)) {
    throw new ReactionServiceError(
      'target_not_supported',
      'Nested lesson discussion comments do not support reactions in v1.',
    )
  }

  const lessonId = relationshipId(comment.lesson)
  if (!lessonId) throw new ReactionServiceError('target_inaccessible', 'This target is not available for reactions.')

  const access = await evaluatePayloadLessonAccess(payload, {
    memberId,
    lessonId,
  })
  if (!access.decision.allowed) {
    throw new ReactionServiceError('target_inaccessible', 'This target is not available for reactions.')
  }

  return comment
}

async function notifyReactionTargetAuthor(
  payload: PayloadCourseWriteAPI,
  memberId: PayloadId,
  target: ReactionTarget,
  targetDocument: PayloadDocument,
  reactionType: ReactionType,
): Promise<void> {
  const authorId = relationshipId(targetDocument.author)
  if (!authorId || authorId === String(memberId)) return

  let actorName = 'A member'
  try {
    const profiles = await payload.find({
      collection: 'payload_member_profiles',
      where: { member: { equals: String(memberId) } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    actorName = asString(profiles.docs[0]?.displayName) ?? actorName
  } catch {
    // Notification delivery is best-effort and must not affect the reaction.
  }

  try {
    await payload.create({
      collection: 'payload_member_notifications',
      data: {
        member: authorId,
        type: 'system',
        actorName,
        title: `reacted ${reactionLabels[reactionType]} to your ${target.kind === 'space_post' || target.kind === 'content_post' || target.kind === 'content_page' ? 'post' : 'comment'}`,
        href: null,
        read: false,
      },
      overrideAccess: true,
    })
  } catch {
    // Notification delivery is best-effort and must not affect the reaction.
  }
}

type ReactionAuditInput = Parameters<typeof createAuditEvent>[1]

/**
 * Reaction persistence is the user-facing mutation. Audit and notification
 * records are operational side effects and must not turn a successful
 * reaction into a false error when their table or schema is unavailable.
 */
async function recordReactionAudit(
  payload: PayloadCourseWriteAPI,
  input: ReactionAuditInput,
): Promise<void> {
  try {
    await createAuditEvent(payload, input)
  } catch (error) {
    console.error('JPV_REACTION_AUDIT_FAILED', {
      action: input.action,
      targetCollection: input.targetCollection,
      targetId: input.targetId ? String(input.targetId) : null,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

async function countReactions(
  payload: PayloadCourseAccessAPI,
  target: ReactionTarget,
  reactionType: ReactionType,
): Promise<number> {
  const where = {
    and: [
      targetWhere(target),
      { reactionType: { equals: reactionType } },
    ],
  }

  if (typeof payload.count === 'function') {
    try {
      const result = await payload.count({
        collection: REACTION_COLLECTION,
        where,
        overrideAccess: true,
      })
      return Number.isFinite(result.totalDocs) ? result.totalDocs : 0
    } catch {
      // Older production snapshots may not expose Payload's count helper for
      // this collection. Fall through to the portable find-based projection.
    }
  }

  const result = await payload.find({
    collection: REACTION_COLLECTION,
    where,
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  })
  return result.docs.length
}

async function findViewerReaction(
  payload: PayloadCourseAccessAPI,
  memberId: PayloadId,
  target: ReactionTarget,
): Promise<ReactionDocument | null> {
  return findOne(payload, REACTION_COLLECTION, {
    and: [findMemberWhere(memberId), targetWhere(target)],
  }) as Promise<ReactionDocument | null>
}

function buildReactionSummary(
  target: ReactionTarget,
  memberId: PayloadId,
  reactions: readonly ReactionDocument[],
): ReactionSummary {
  const counts = reactionTypes.map((reactionType) => ({
    reactionType,
    label: reactionLabels[reactionType],
    count: reactions.filter((reaction) => reaction.reactionType === reactionType).length,
  }))
  const viewerReaction = reactions.find((reaction) => relationshipId(reaction.member) === String(memberId))
  const normalizedViewerReaction = viewerReaction && reactionTypes.includes(viewerReaction.reactionType as ReactionType)
    ? viewerReaction.reactionType as ReactionType
    : null

  return {
    target,
    counts,
    totalCount: reactions.length,
    viewerReaction: normalizedViewerReaction,
    canReact: true,
  }
}

async function findAllReactionRows(
  payload: PayloadCourseAccessAPI,
  where: Record<string, unknown>,
): Promise<ReactionDocument[]> {
  const rows: ReactionDocument[] = []
  const pageSize = 500

  for (let page = 1; page <= 100; page += 1) {
    const result = await payload.find({
      collection: REACTION_COLLECTION,
      where,
      limit: pageSize,
      page,
      depth: 0,
      overrideAccess: true,
    })
    rows.push(...(result.docs as ReactionDocument[]))
    if (result.docs.length < pageSize || result.hasNextPage === false) return rows
  }

  throw new ReactionServiceError('service_unavailable', 'Reaction counts are temporarily unavailable.')
}

/**
 * Batch projection for one already-loaded lesson discussion. The caller still
 * supplies target IDs, but this service independently rechecks member
 * eligibility, lesson entitlement, and visible comments before returning any
 * reaction state. It avoids one count/viewer query set per comment.
 */
export async function getLessonCommentReactionSummaries(
  payload: PayloadCourseAccessAPI,
  memberId: PayloadId,
  lessonId: PayloadId,
  rawCommentIds: readonly PayloadId[],
): Promise<ReadonlyMap<string, ReactionSummary>> {
  const resolvedLessonId = asString(lessonId)
  const requestedIds = new Set(rawCommentIds.map(asString).filter((id): id is string => Boolean(id)))
  const summaries = new Map<string, ReactionSummary>()
  if (!resolvedLessonId || requestedIds.size === 0) return summaries

  await requireEligibleMember(payload, memberId)
  const access = await evaluatePayloadLessonAccess(payload, {
    memberId,
    lessonId: resolvedLessonId,
  })
  if (!access.decision.allowed) {
    throw new ReactionServiceError('target_inaccessible', 'This target is not available for reactions.')
  }

  const visibleComments = await payload.find({
    collection: 'payload_lesson_comments',
    where: {
      and: [
        { lesson: { equals: resolvedLessonId } },
        { moderationStatus: { equals: 'visible' } },
      ],
    },
    limit: 500,
    depth: 0,
    overrideAccess: true,
  })
  const visibleIds = new Set(
    visibleComments.docs
      .filter((comment) => !relationshipId(comment.parent))
      .map((comment) => asString(comment.id))
      .filter((id): id is string => Boolean(id && requestedIds.has(id))),
  )
  if (visibleIds.size === 0) return summaries

  const reactionRows = await findAllReactionRows(payload, {
    and: [
      { targetKind: { equals: 'lesson_comment' } },
      { targetLessonComment: { in: [...visibleIds] } },
    ],
  })
  for (const id of visibleIds) {
    const target: ReactionTarget = { kind: 'lesson_comment', id }
    const targetRows = reactionRows.filter((reaction) => relationshipId(reaction.targetLessonComment) === id)
    summaries.set(id, buildReactionSummary(target, memberId, targetRows))
  }
  return summaries
}

/**
 * Batch projection for visible comments on one already-accessible community
 * post. The post access check is performed once, while comment moderation and
 * post ownership are rechecked before any reaction rows are projected.
 */
export async function getSpaceCommentReactionSummaries(
  payload: PayloadCourseAccessAPI,
  memberId: PayloadId,
  postId: PayloadId,
  rawCommentIds: readonly PayloadId[],
): Promise<ReadonlyMap<string, ReactionSummary>> {
  const resolvedPostId = asString(postId)
  const requestedIds = new Set(rawCommentIds.map(asString).filter((id): id is string => Boolean(id)))
  const summaries = new Map<string, ReactionSummary>()
  if (!resolvedPostId || requestedIds.size === 0) return summaries

  await requireEligibleMember(payload, memberId)
  await assertVisibleTarget(payload, memberId, { kind: 'space_post', id: resolvedPostId })

  const visibleComments = await payload.find({
    collection: 'payload_space_comments',
    where: {
      and: [
        { post: { equals: resolvedPostId } },
        { moderationStatus: { equals: 'visible' } },
      ],
    },
    limit: 500,
    depth: 0,
    overrideAccess: true,
  })
  const visibleIds = new Set(
    visibleComments.docs
      .map((comment) => asString(comment.id))
      .filter((id): id is string => Boolean(id && requestedIds.has(id))),
  )
  if (visibleIds.size === 0) return summaries

  const reactionRows = await findAllReactionRows(payload, {
    and: [
      { targetKind: { equals: 'space_comment' } },
      { targetSpaceComment: { in: [...visibleIds] } },
    ],
  })
  for (const id of visibleIds) {
    const target: ReactionTarget = { kind: 'space_comment', id }
    const targetRows = reactionRows.filter((reaction) => relationshipId(reaction.targetSpaceComment) === id)
    summaries.set(id, buildReactionSummary(target, memberId, targetRows))
  }
  return summaries
}

async function assertRateLimit(
  payload: PayloadCourseWriteAPI,
  memberId: PayloadId,
  rateLimit?: { windowMs?: number; maxMutations?: number },
): Promise<void> {
  const windowMs = rateLimit?.windowMs ?? 60_000
  const maxMutations = rateLimit?.maxMutations ?? 30
  const cutoff = new Date(Date.now() - windowMs).toISOString()

  let result: { docs: readonly PayloadDocument[] }
  try {
    result = await payload.find({
      collection: 'payload_audit_events',
      where: {
        and: [
          { actorType: { equals: 'member' } },
          { actorId: { equals: String(memberId) } },
          {
            or: [
              { action: { equals: 'reaction_created' } },
              { action: { equals: 'reaction_changed' } },
              { action: { equals: 'reaction_removed' } },
            ],
          },
          { createdAt: { greater_than_equal: cutoff } },
        ],
      },
      limit: maxMutations + 1,
      depth: 0,
      sort: '-createdAt',
      overrideAccess: true,
    })
  } catch (error) {
    // Rate limiting is a guardrail, not the reaction's source of truth. A
    // missing/unavailable audit projection must not make member reactions
    // impossible to save; the unique reaction index still prevents duplicate
    // member/target rows. Keep an explicit operational signal for repair.
    console.error('JPV_REACTION_RATE_LIMIT_UNAVAILABLE', {
      memberId: String(memberId),
      error: error instanceof Error ? error.message : String(error),
    })
    return
  }

  if (result.docs.length >= maxMutations) {
    throw new ReactionServiceError('rate_limited', 'Reaction activity is temporarily rate limited.')
  }
}

export async function getReactionSummary(
  payload: PayloadCourseAccessAPI,
  memberId: PayloadId,
  rawTarget: ReactionTarget,
): Promise<ReactionSummary> {
  const target = normalizeTarget(rawTarget)
  await requireEligibleMember(payload, memberId)
  await assertVisibleTarget(payload, memberId, target)

  const [helpful, insightful, celebrate, viewerReaction] = await Promise.all([
    countReactions(payload, target, 'helpful'),
    countReactions(payload, target, 'insightful'),
    countReactions(payload, target, 'celebrate'),
    findViewerReaction(payload, memberId, target),
  ])

  const counts = [
    { reactionType: 'helpful' as const, label: reactionLabels.helpful, count: helpful },
    { reactionType: 'insightful' as const, label: reactionLabels.insightful, count: insightful },
    { reactionType: 'celebrate' as const, label: reactionLabels.celebrate, count: celebrate },
  ]

  return {
    target,
    counts,
    totalCount: counts.reduce((total, entry) => total + entry.count, 0),
    viewerReaction: viewerReaction && reactionTypes.includes(viewerReaction.reactionType as ReactionType)
      ? viewerReaction.reactionType as ReactionType
      : null,
    canReact: true,
  }
}

export async function setReaction(
  payload: PayloadReactionWriteAPI,
  memberId: PayloadId,
  rawTarget: ReactionTarget,
  rawReactionType: unknown,
  rateLimit?: { windowMs?: number; maxMutations?: number },
): Promise<ReactionMutation> {
  const target = normalizeTarget(rawTarget)
  const reactionType = normalizeReactionType(rawReactionType)
  await requireEligibleMember(payload, memberId)
  const targetDocument = await assertVisibleTarget(payload, memberId, target)
  await assertRateLimit(payload, memberId, rateLimit)

  const existing = await findViewerReaction(payload, memberId, target)
  const targetField = targetFieldByKind[target.kind]

  if (existing) {
    const previous = normalizeReactionType(existing.reactionType)

    if (previous === reactionType) {
      await removeReaction(payload, memberId, target, { skipRateLimit: true })
      return { operation: 'removed', reaction: null }
    }

    try {
      await payload.update({
        collection: REACTION_COLLECTION,
        id: existing.id,
        data: {
          reactionType,
          metadata: { source: 'member_portal', operation: 'changed' },
        },
        overrideAccess: true,
      })
    } catch {
      throw new ReactionServiceError('conflict', 'The reaction changed concurrently. Please try again.')
    }

    await recordReactionAudit(payload, {
      actorType: 'member',
      actorId: memberId,
      action: 'reaction_changed',
      targetCollection: REACTION_COLLECTION,
      targetId: existing.id,
      before: { reactionType: previous, targetKind: target.kind, targetId: target.id },
      after: { reactionType, targetKind: target.kind, targetId: target.id },
    })
    await notifyReactionTargetAuthor(payload, memberId, target, targetDocument, reactionType)

    return { operation: 'changed', reaction: reactionType }
  }

  try {
    const created = await payload.create({
      collection: REACTION_COLLECTION,
      data: {
        member: normalizeRelationshipId(memberId),
        reactionType,
        targetKind: target.kind,
        [targetField]: normalizeRelationshipId(target.id),
        metadata: { source: 'member_portal', operation: 'created' },
      },
      overrideAccess: true,
    })

    await recordReactionAudit(payload, {
      actorType: 'member',
      actorId: memberId,
      action: 'reaction_created',
      targetCollection: REACTION_COLLECTION,
      targetId: created.id,
      after: { reactionType, targetKind: target.kind, targetId: target.id },
    })
    await notifyReactionTargetAuthor(payload, memberId, target, targetDocument, reactionType)
  } catch (error) {
    if (error instanceof ReactionServiceError) throw error
    throw new ReactionServiceError('conflict', 'The reaction changed concurrently. Please try again.')
  }

  return { operation: 'created', reaction: reactionType }
}

export async function removeReaction(
  payload: PayloadReactionWriteAPI,
  memberId: PayloadId,
  rawTarget: ReactionTarget,
  options?: { skipRateLimit?: boolean },
): Promise<ReactionMutation> {
  const target = normalizeTarget(rawTarget)
  await requireEligibleMember(payload, memberId)
  await assertVisibleTarget(payload, memberId, target)
  if (!options?.skipRateLimit) await assertRateLimit(payload, memberId)

  const existing = await findViewerReaction(payload, memberId, target)
  if (!existing) return { operation: 'removed', reaction: null }

  const previous = normalizeReactionType(existing.reactionType)
  await payload.delete({
    collection: REACTION_COLLECTION,
    id: existing.id,
    overrideAccess: true,
  })

  await recordReactionAudit(payload, {
    actorType: 'member',
    actorId: memberId,
    action: 'reaction_removed',
    targetCollection: REACTION_COLLECTION,
    targetId: existing.id,
    before: { reactionType: previous, targetKind: target.kind, targetId: target.id },
  })

  return { operation: 'removed', reaction: null }
}
