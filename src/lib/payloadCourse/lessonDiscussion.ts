import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

import {
  evaluatePayloadLessonAccess,
  type PayloadCourseWriteAPI,
  type PayloadDocument,
  type PayloadId,
} from '@/lib/payloadCourse/accessService'
import { createAuditEvent } from '@/lib/payloadCourse/events'

type RateLimitInput = {
  windowMs?: number
  maxCreates?: number
}

export type LessonDiscussionComment = {
  id: string
  lessonId: string
  authorId: string
  parentId: string | null
  displayName: string
  body: SerializedEditorState
  createdAt: string
  sourceCreatedAt: string | null
  legacyCommentId: string | null
}

export type LessonDiscussionResult = {
  allowed: boolean
  lessonId: string | null
  comments: LessonDiscussionComment[]
}

export type CreateLessonCommentInput = {
  memberId: PayloadId
  lessonId: PayloadId
  body: Record<string, unknown>
  displayName?: string | null
  parentId?: PayloadId | null
  rateLimit?: RateLimitInput
}

const defaultRateLimit = {
  windowMs: 60_000,
  maxCreates: 5,
}

function asString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number') return String(value)
  return null
}

function relationshipId(value: unknown): string | null {
  const direct = asString(value)
  if (direct) return direct
  if (!value || typeof value !== 'object') return null
  return asString((value as { id?: unknown }).id)
}

function asRelationshipId(value: PayloadId): number | string {
  if (typeof value === 'number') return value
  const trimmed = String(value).trim()
  if (!trimmed) throw new Error('Relationship ID is required but was empty.')
  const numeric = Number(trimmed)
  return Number.isFinite(numeric) ? numeric : trimmed
}

function assertRichBody(body: Record<string, unknown>) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Body must be a Payload rich text object.')
  }
  const root = body.root
  if (!root || typeof root !== 'object') throw new Error('Body must be a Payload rich text object.')
}

async function requireLessonAccess(
  payload: PayloadCourseWriteAPI,
  memberId: PayloadId,
  lessonId: PayloadId,
): Promise<string> {
  const access = await evaluatePayloadLessonAccess(payload, {
    memberId,
    lessonId,
  })
  if (!access.decision.allowed || !access.resource?.id) {
    throw new Error('Lesson discussion is unavailable for this member.')
  }
  return String(access.resource.id)
}

async function memberDisplayName(payload: PayloadCourseWriteAPI, memberId: PayloadId): Promise<string> {
  const profiles = await payload.find({
    collection: 'payload_member_profiles',
    where: { member: { equals: String(memberId) } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const displayName = asString(profiles.docs[0]?.displayName)
  if (displayName) return displayName

  const member = await payload.findByID({
    collection: 'payload_members',
    id: memberId,
    depth: 0,
    overrideAccess: true,
  })
  const email = asString(member?.email)
  return email?.split('@')[0] || `Member ${memberId}`
}

async function assertCreateRateLimit(
  payload: PayloadCourseWriteAPI,
  memberId: PayloadId,
  rateLimit?: RateLimitInput,
) {
  const windowMs = rateLimit?.windowMs ?? defaultRateLimit.windowMs
  const maxCreates = rateLimit?.maxCreates ?? defaultRateLimit.maxCreates
  const cutoff = Date.now() - windowMs
  const result = await payload.find({
    collection: 'payload_lesson_comments',
    where: { author: { equals: String(memberId) } },
    limit: 25,
    depth: 0,
    sort: '-createdAt',
    overrideAccess: true,
  })
  const recentCreates = result.docs.filter((doc) => {
    const createdAt = asString(doc.createdAt)
    return Boolean(createdAt && new Date(createdAt).getTime() >= cutoff)
  })
  if (recentCreates.length >= maxCreates) {
    throw new Error('Lesson discussion rate limit exceeded.')
  }
}

async function validateParent(
  payload: PayloadCourseWriteAPI,
  parentId: PayloadId | null | undefined,
  lessonId: string,
): Promise<PayloadDocument | null> {
  if (!parentId) return null
  let parent: PayloadDocument | null = null
  try {
    parent = await payload.findByID({
      collection: 'payload_lesson_comments',
      id: parentId,
      depth: 0,
      overrideAccess: true,
    })
  } catch {
    parent = null
  }
  if (!parent) throw new Error('Reply parent comment was not found.')
  if (relationshipId(parent.lesson) !== lessonId) {
    throw new Error('Reply parent must belong to the same lesson.')
  }
  if (parent.moderationStatus !== 'visible') {
    throw new Error('Replies can only be created under visible comments.')
  }
  return parent
}

export async function listLessonDiscussion(
  payload: PayloadCourseWriteAPI,
  memberId: PayloadId,
  lessonId: PayloadId,
): Promise<LessonDiscussionResult> {
  let resolvedLessonId: string
  try {
    resolvedLessonId = await requireLessonAccess(payload, memberId, lessonId)
  } catch {
    return { allowed: false, lessonId: null, comments: [] }
  }

  const result = await payload.find({
    collection: 'payload_lesson_comments',
    where: {
      and: [
        { lesson: { equals: resolvedLessonId } },
        { moderationStatus: { equals: 'visible' } },
      ],
    },
    limit: 500,
    depth: 0,
    sort: 'sourceCreatedAt',
    overrideAccess: true,
  })

  const comments = result.docs.map((doc): LessonDiscussionComment => ({
    id: String(doc.id),
    lessonId: relationshipId(doc.lesson) ?? resolvedLessonId,
    authorId: relationshipId(doc.author) ?? '',
    parentId: relationshipId(doc.parent),
    displayName: asString(doc.displayName) ?? 'Member',
    body: doc.body as SerializedEditorState,
    createdAt: asString(doc.createdAt) ?? '',
    sourceCreatedAt: asString(doc.sourceCreatedAt),
    legacyCommentId: asString(doc.legacyCommentId),
  }))

  comments.sort((a, b) => {
    const aTime = new Date(a.sourceCreatedAt || a.createdAt).getTime()
    const bTime = new Date(b.sourceCreatedAt || b.createdAt).getTime()
    if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) return aTime - bTime
    return a.id.localeCompare(b.id, undefined, { numeric: true })
  })

  return { allowed: true, lessonId: resolvedLessonId, comments }
}

export async function createLessonComment(
  payload: PayloadCourseWriteAPI,
  input: CreateLessonCommentInput,
): Promise<{ document: PayloadDocument; auditEvent: PayloadDocument }> {
  assertRichBody(input.body)
  const lessonId = await requireLessonAccess(payload, input.memberId, input.lessonId)
  await assertCreateRateLimit(payload, input.memberId, input.rateLimit)
  const parent = await validateParent(payload, input.parentId, lessonId)
  const displayName = input.displayName?.trim() || await memberDisplayName(payload, input.memberId)

  const comment = await payload.create({
    collection: 'payload_lesson_comments',
    data: {
      displayName,
      lesson: asRelationshipId(lessonId),
      author: asRelationshipId(input.memberId),
      parent: parent ? asRelationshipId(parent.id) : undefined,
      body: input.body,
      moderationStatus: 'visible',
      metadata: {
        createdByService: 'lessonDiscussion.createLessonComment',
        ...(parent ? { replyToCommentId: String(parent.id) } : {}),
      },
    },
    overrideAccess: true,
  })

  const auditEvent = await createAuditEvent(payload, {
    actorType: 'member',
    actorId: input.memberId,
    action: parent ? 'lesson_comment.reply.created' : 'lesson_comment.created',
    targetCollection: 'payload_lesson_comments',
    targetId: comment.id,
    after: comment,
    metadata: {
      lessonId,
      parentId: parent ? String(parent.id) : null,
      moderationStatus: 'visible',
    },
  })

  return { document: comment, auditEvent }
}

export function plainTextLessonCommentBody(value: string): SerializedEditorState {
  const paragraphs = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 100)

  return {
    root: {
      type: 'root',
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
      children: paragraphs.map((line) => ({
        type: 'paragraph',
        format: '',
        indent: 0,
        version: 1,
        textFormat: 0,
        textStyle: '',
        children: [
          {
            type: 'text',
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: line,
            version: 1,
          },
        ],
      })),
    },
  } as SerializedEditorState
}
