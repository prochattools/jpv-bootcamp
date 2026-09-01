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
import { getPayloadMigrationSchemaSqlPrefix } from '@/lib/payloadMigrationSchema'

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

const targetColumnByKind: Record<ReactionTargetKind, string> = {
  space_post: 'target_post_id',
  space_comment: 'target_space_comment_id',
  lesson_comment: 'target_lesson_comment_id',
  content_post: 'target_content_post_id',
  content_page: 'target_content_page_id',
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

function isReactionType(value: unknown): value is ReactionType {
  return value === 'helpful' || value === 'insightful' || value === 'celebrate'
}

function isUsableReactionDocument(value: unknown): value is ReactionDocument {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const document = value as ReactionDocument
  return asString(document.id) !== null && isReactionType(document.reactionType)
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

function withUsableReactionTypeWhere(where: Record<string, unknown>): Record<string, unknown> {
  return {
    and: [
      where,
      { reactionType: { in: [...reactionTypes] } },
    ],
  }
}

async function findOne(
  payload: PayloadCourseAccessAPI,
  collection: string,
  where: Record<string, unknown>,
): Promise<PayloadDocument | null> {
  const result = await payload.find({
    collection,
    where: withUsableReactionTypeWhere(where),
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return result.docs.find(isUsableReactionDocument) ?? null
}

type ReactionPoolRow = Record<string, unknown>

function numericId(value: unknown): number | null {
  const normalized = asString(value)
  if (!normalized || !/^\d+$/.test(normalized)) return null
  const parsed = Number(normalized)
  return Number.isSafeInteger(parsed) ? parsed : null
}

function reactionDocumentFromPoolRow(row: ReactionPoolRow): ReactionDocument {
  return {
    id: row.id as PayloadId,
    member: row.member_id as PayloadId,
    reactionType: typeof row.reaction_type === 'string' ? row.reaction_type : null,
    targetKind: typeof row.target_kind === 'string' ? row.target_kind : null,
    targetPost: row.target_post_id as PayloadId | null,
    targetSpaceComment: row.target_space_comment_id as PayloadId | null,
    targetLessonComment: row.target_lesson_comment_id as PayloadId | null,
    targetContentPost: row.target_content_post_id as PayloadId | null,
    targetContentPage: row.target_content_page_id as PayloadId | null,
    createdAt: typeof row.created_at === 'string' ? row.created_at : null,
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
  }
}

function reactionPool(payload: PayloadCourseAccessAPI) {
  return payload.db?.pool ?? null
}

/**
 * Payload's relationship adapter has historically attempted to hydrate
 * malformed legacy rows before the query-level reactionType filter ran. The
 * reaction table is deliberately narrow, so use its SQL shape as a fallback
 * when that adapter cannot read or write it. The schema name is validated by
 * getPayloadMigrationSchemaSqlPrefix; values remain parameterized.
 */
async function findReactionRowsWithPool(
  payload: PayloadCourseAccessAPI,
  filter: { kind: ReactionTargetKind; ids: readonly string[] },
  memberId?: PayloadId,
): Promise<ReactionDocument[] | undefined> {
  const pool = reactionPool(payload)
  const column = targetColumnByKind[filter.kind]
  const ids = filter.ids.map(numericId).filter((id): id is number => id !== null)
  if (!pool || ids.length !== filter.ids.length || ids.length === 0) return undefined

  const values: unknown[] = [filter.kind, ...ids]
  let memberClause = ''
  if (memberId !== undefined) {
    const resolvedMemberId = numericId(memberId)
    if (resolvedMemberId === null) return undefined
    values.push(resolvedMemberId)
    memberClause = ` AND "member_id" = $${values.length}`
  }

  const placeholders = ids.map((_, index) => `$${index + 2}`).join(', ')
  const schema = getPayloadMigrationSchemaSqlPrefix()
  try {
    const result = await pool.query({
      text: `SELECT "id", "member_id", "reaction_type", "target_kind", "target_post_id", "target_space_comment_id", "target_lesson_comment_id", "target_content_post_id", "target_content_page_id", "created_at", "updated_at" FROM ${schema}."payload_engagement_reactions" WHERE "target_kind" = $1 AND "${column}" IN (${placeholders}) AND "reaction_type" IN ('helpful', 'insightful', 'celebrate')${memberClause} ORDER BY "id" ASC LIMIT 500`,
      values,
      statement_timeout: 3000,
    })
    return result.rows.map(reactionDocumentFromPoolRow).filter(isUsableReactionDocument)
  } catch (error) {
    console.error('JPV_REACTION_SQL_FALLBACK_UNAVAILABLE', {
      error: error instanceof Error ? error.message : String(error),
    })
    return undefined
  }
}

async function updateReactionWithPool(
  payload: PayloadCourseAccessAPI,
  memberId: PayloadId,
  target: ReactionTarget,
  reactionId: PayloadId,
  reactionType: ReactionType,
): Promise<boolean> {
  const pool = reactionPool(payload)
  const member = numericId(memberId)
  const id = numericId(reactionId)
  const targetId = numericId(target.id)
  if (!pool || member === null || id === null || targetId === null) return false

  const schema = getPayloadMigrationSchemaSqlPrefix()
  const column = targetColumnByKind[target.kind]
  try {
    const result = await pool.query({
      text: `UPDATE ${schema}."payload_engagement_reactions" SET "reaction_type" = $1, "metadata" = $2::jsonb, "updated_at" = now() WHERE "id" = $3 AND "member_id" = $4 AND "target_kind" = $5 AND "${column}" = $6 RETURNING "id"`,
      values: [reactionType, JSON.stringify({ source: 'member_portal', operation: 'changed' }), id, member, target.kind, targetId],
      statement_timeout: 3000,
    })
    return result.rows.length > 0
  } catch (error) {
    console.error('JPV_REACTION_SQL_UPDATE_UNAVAILABLE', {
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

async function createReactionWithPool(
  payload: PayloadCourseAccessAPI,
  memberId: PayloadId,
  target: ReactionTarget,
  reactionType: ReactionType,
): Promise<ReactionDocument | null | undefined> {
  const pool = reactionPool(payload)
  const member = numericId(memberId)
  const targetId = numericId(target.id)
  if (!pool || member === null || targetId === null) return undefined

  const schema = getPayloadMigrationSchemaSqlPrefix()
  const column = targetColumnByKind[target.kind]
  try {
    const result = await pool.query({
      text: `INSERT INTO ${schema}."payload_engagement_reactions" ("member_id", "reaction_type", "target_kind", "${column}", "metadata") VALUES ($1, $2, $3, $4, $5::jsonb) ON CONFLICT DO NOTHING RETURNING "id", "member_id", "reaction_type", "target_kind", "target_post_id", "target_space_comment_id", "target_lesson_comment_id", "target_content_post_id", "target_content_page_id", "created_at", "updated_at"`,
      values: [member, reactionType, target.kind, targetId, JSON.stringify({ source: 'member_portal', operation: 'created' })],
      statement_timeout: 3000,
    })
    if (result.rows.length > 0) return reactionDocumentFromPoolRow(result.rows[0])
    const existing = await findReactionRowsWithPool(payload, { kind: target.kind, ids: [String(target.id)] }, memberId)
    return existing?.[0] ?? null
  } catch (error) {
    console.error('JPV_REACTION_SQL_CREATE_UNAVAILABLE', {
      error: error instanceof Error ? error.message : String(error),
    })
    return undefined
  }
}

async function deleteReactionWithPool(
  payload: PayloadCourseAccessAPI,
  memberId: PayloadId,
  target: ReactionTarget,
  reactionId: PayloadId,
): Promise<boolean> {
  const pool = reactionPool(payload)
  const member = numericId(memberId)
  const id = numericId(reactionId)
  const targetId = numericId(target.id)
  if (!pool || member === null || id === null || targetId === null) return false

  const schema = getPayloadMigrationSchemaSqlPrefix()
  const column = targetColumnByKind[target.kind]
  try {
    const result = await pool.query({
      text: `DELETE FROM ${schema}."payload_engagement_reactions" WHERE "id" = $1 AND "member_id" = $2 AND "target_kind" = $3 AND "${column}" = $4 RETURNING "id"`,
      values: [id, member, target.kind, targetId],
      statement_timeout: 3000,
    })
    return result.rows.length > 0
  } catch (error) {
    console.error('JPV_REACTION_SQL_DELETE_UNAVAILABLE', {
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
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

async function findViewerReaction(
  payload: PayloadCourseAccessAPI,
  memberId: PayloadId,
  target: ReactionTarget,
): Promise<ReactionDocument | null> {
  const sqlRows = await findReactionRowsWithPool(payload, { kind: target.kind, ids: [String(target.id)] }, memberId)
  if (sqlRows) return sqlRows[0] ?? null

  try {
    return await findOne(payload, REACTION_COLLECTION, {
      and: [findMemberWhere(memberId), targetWhere(target)],
    }) as ReactionDocument | null
  } catch (error) {
    console.error('JPV_REACTION_PAYLOAD_READ_FAILED', {
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

function buildReactionSummary(
  target: ReactionTarget,
  memberId: PayloadId,
  reactions: readonly ReactionDocument[],
): ReactionSummary {
  const usableReactions = reactions.filter(isUsableReactionDocument)
  const counts = reactionTypes.map((reactionType) => ({
    reactionType,
    label: reactionLabels[reactionType],
    count: usableReactions.filter((reaction) => reaction.reactionType === reactionType).length,
  }))
  const viewerReaction = usableReactions.find((reaction) => relationshipId(reaction.member) === String(memberId))
  const normalizedViewerReaction = viewerReaction && reactionTypes.includes(viewerReaction.reactionType as ReactionType)
    ? viewerReaction.reactionType as ReactionType
    : null

  return {
    target,
    counts,
    totalCount: usableReactions.length,
    viewerReaction: normalizedViewerReaction,
    canReact: true,
  }
}

async function findAllReactionRows(
  payload: PayloadCourseAccessAPI,
  where: Record<string, unknown>,
  sqlFilter?: { kind: ReactionTargetKind; ids: readonly string[] },
): Promise<ReactionDocument[]> {
  if (sqlFilter) {
    const sqlRows = await findReactionRowsWithPool(payload, sqlFilter)
    if (sqlRows) return sqlRows
  }

  const rows: ReactionDocument[] = []
  const pageSize = 500

  for (let page = 1; page <= 100; page += 1) {
    let result: { docs: any[]; hasNextPage?: boolean }
    try {
      result = await payload.find({
        collection: REACTION_COLLECTION,
        where: withUsableReactionTypeWhere(where),
        limit: pageSize,
        page,
        depth: 0,
        overrideAccess: true,
      })
    } catch (error) {
      if (!sqlFilter) throw error
      const sqlRows = await findReactionRowsWithPool(payload, sqlFilter)
      if (sqlRows) return sqlRows
      throw error
    }
    rows.push(...result.docs.filter(isUsableReactionDocument))
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
  }, { kind: 'lesson_comment', ids: [...visibleIds] })
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
  }, { kind: 'space_comment', ids: [...visibleIds] })
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

  // Project one sanitized row set for both counts and the viewer state. This
  // keeps malformed/null rows from causing the post-mutation response to fail
  // after the reaction itself was already saved.
  const reactions = await findAllReactionRows(payload, targetWhere(target), { kind: target.kind, ids: [String(target.id)] })
  return buildReactionSummary(target, memberId, reactions)
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
    } catch (error) {
      const updated = await updateReactionWithPool(payload, memberId, target, existing.id, reactionType)
      if (!updated) {
        console.error('JPV_REACTION_UPDATE_FAILED', {
          error: error instanceof Error ? error.message : String(error),
        })
        throw new ReactionServiceError('conflict', 'The reaction changed concurrently. Please try again.')
      }
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
    let created: PayloadDocument
    try {
      created = await payload.create({
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
    } catch (error) {
      const fallback = await createReactionWithPool(payload, memberId, target, reactionType)
      if (!fallback) {
        console.error('JPV_REACTION_CREATE_FAILED', {
          error: error instanceof Error ? error.message : String(error),
        })
        throw new ReactionServiceError('conflict', 'The reaction changed concurrently. Please try again.')
      }
      created = fallback
    }

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
  try {
    await payload.delete({
      collection: REACTION_COLLECTION,
      id: existing.id,
      overrideAccess: true,
    })
  } catch (error) {
    const deleted = await deleteReactionWithPool(payload, memberId, target, existing.id)
    if (!deleted) {
      console.error('JPV_REACTION_DELETE_FAILED', {
        error: error instanceof Error ? error.message : String(error),
      })
      throw new ReactionServiceError('conflict', 'The reaction changed concurrently. Please try again.')
    }
  }

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
