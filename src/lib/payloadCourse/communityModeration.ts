import type {
  PayloadCourseAccessAPI,
  PayloadDocument,
  PayloadId,
} from '@/lib/payloadCourse/accessService'
import {
  projectCommunityRichText,
  type SafeCommunityRichTextNode,
} from '@/lib/payloadCourse/communityDiscussion'

export type CommunityModerationActor =
  | {
      type: 'admin'
      id?: PayloadId | null
    }
  | {
      type: 'member'
      id: PayloadId
    }

export type CommunityModerationCapability = {
  allowed: boolean
  role: 'platform_admin' | 'space_admin' | 'moderator' | null
}

export type PendingCommunityModerationPost = {
  kind: 'post'
  id: string
  title: string
  postType: 'discussion' | 'question' | 'announcement'
  authorName: string
  createdAt: string | null
  space: {
    name: string
    slug: string | null
  }
  preview: SafeCommunityRichTextNode
}

export type PendingCommunityModerationComment = {
  kind: 'comment'
  id: string
  postId: string
  postTitle: string
  authorName: string
  createdAt: string | null
  space: {
    name: string
    slug: string | null
  }
  preview: SafeCommunityRichTextNode
}

export type PendingCommunityModerationFile = {
  kind: 'file'
  id: string
  title: string
  filename: string
  mimeType: string
  byteSize: number
  uploaderName: string
  createdAt: string | null
  space: {
    name: string
    slug: string | null
  }
  downloadUrl: string
}

export type PendingCommunityModerationItem =
  | PendingCommunityModerationPost
  | PendingCommunityModerationComment
  | PendingCommunityModerationFile

export type CommunityModerationInbox = {
  actorRole: CommunityModerationCapability['role']
  items: PendingCommunityModerationItem[]
}

export type CommunityModerationDenied = {
  allowed: false
  reason: 'not_found'
}

export type CommunityModerationItemResult =
  | {
      allowed: true
      item: PendingCommunityModerationItem
    }
  | CommunityModerationDenied

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number') return String(value)
  return null
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function asDateString(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString()
  const text = asString(value)
  if (!text) return null
  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function getDocumentId(value: unknown): string | null {
  const direct = asString(value)
  if (direct) return direct
  const record = asRecord(value)
  return record ? asString(record.id) : null
}

function normalizePostType(
  value: unknown
): 'discussion' | 'question' | 'announcement' {
  if (value === 'question' || value === 'announcement') return value
  return 'discussion'
}

function safeRecordId(value: unknown): string | null {
  const id = asString(value)
  if (!id || id.length > 200) return null
  if (!/^[A-Za-z0-9_-]+$/.test(id)) return null
  return id
}

function safeFilename(value: unknown): string | null {
  const filename = asString(value)
  if (!filename || filename.length > 255) return null
  if (filename.includes('\0') || filename.includes('/') || filename.includes('\\')) {
    return null
  }
  if (filename === '.' || filename === '..') return null
  return filename
}

function safeMimeType(value: unknown): string | null {
  const mimeType = asString(value)
  if (!mimeType || mimeType.length > 160) return null
  if (!/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(mimeType)) return null
  return mimeType
}

function displayName(document: PayloadDocument | null): string {
  const direct =
    asString(document?.displayName) ??
    asString(document?.fullName) ??
    asString(document?.name)
  if (direct) return direct.slice(0, 120)

  const firstName = asString(document?.firstName)
  const lastName = asString(document?.lastName)
  const combined = [firstName, lastName].filter(Boolean).join(' ').trim()
  return combined ? combined.slice(0, 120) : 'Community member'
}

function denied(): CommunityModerationDenied {
  return { allowed: false, reason: 'not_found' }
}

async function findAll(
  payload: PayloadCourseAccessAPI,
  collection: string,
  args: {
    where?: Record<string, unknown>
    limit?: number
    sort?: string
  } = {}
): Promise<PayloadDocument[]> {
  const result = await payload.find({
    collection,
    where: args.where,
    limit: args.limit ?? 500,
    depth: 0,
    sort: args.sort,
    overrideAccess: true,
  })
  return result.docs
}

async function findOne(
  payload: PayloadCourseAccessAPI,
  collection: string,
  where: Record<string, unknown>
): Promise<PayloadDocument | null> {
  const documents = await findAll(payload, collection, { where, limit: 1 })
  return documents[0] ?? null
}

async function findByIdSafe(
  payload: PayloadCourseAccessAPI,
  collection: string,
  id: PayloadId | null | undefined
): Promise<PayloadDocument | null> {
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

async function getModeratedSpaceIds(
  payload: PayloadCourseAccessAPI,
  actor: CommunityModerationActor
): Promise<Set<string> | null> {
  if (actor.type === 'admin') return null

  const memberships = await findAll(payload, 'payload_space_memberships', {
    where: {
      and: [
        { member: { equals: String(actor.id) } },
        { status: { equals: 'active' } },
      ],
    },
    limit: 500,
  })

  return new Set(
    memberships
      .filter(
        (membership) =>
          membership.role === 'moderator' || membership.role === 'admin'
      )
      .map((membership) => getDocumentId(membership.space))
      .filter((spaceId): spaceId is string => Boolean(spaceId))
  )
}

export async function getCommunityModerationCapability(
  payload: PayloadCourseAccessAPI,
  actor: CommunityModerationActor,
  spaceIdInput: PayloadId
): Promise<CommunityModerationCapability> {
  if (actor.type === 'admin') {
    return { allowed: true, role: 'platform_admin' }
  }

  const membership = await findOne(payload, 'payload_space_memberships', {
    and: [
      { member: { equals: String(actor.id) } },
      { space: { equals: String(spaceIdInput) } },
      { status: { equals: 'active' } },
    ],
  })

  if (membership?.role === 'admin') {
    return { allowed: true, role: 'space_admin' }
  }
  if (membership?.role === 'moderator') {
    return { allowed: true, role: 'moderator' }
  }

  return { allowed: false, role: null }
}

function spaceProjection(space: PayloadDocument): {
  name: string
  slug: string | null
} {
  return {
    name: (asString(space.name) ?? 'Community space').slice(0, 160),
    slug: asString(space.slug)?.slice(0, 160) ?? null,
  }
}

async function projectPost(
  payload: PayloadCourseAccessAPI,
  post: PayloadDocument,
  space: PayloadDocument
): Promise<PendingCommunityModerationPost | null> {
  const id = safeRecordId(post.id)
  if (!id || post.moderationStatus !== 'pending_review') return null

  const author = await findByIdSafe(
    payload,
    'payload_members',
    getDocumentId(post.author)
  )

  return {
    kind: 'post',
    id,
    title: (asString(post.title) ?? 'Community post').slice(0, 200),
    postType: normalizePostType(post.postType),
    authorName: displayName(author),
    createdAt: asDateString(post.createdAt),
    space: spaceProjection(space),
    preview: projectCommunityRichText(post.body),
  }
}

async function projectComment(
  payload: PayloadCourseAccessAPI,
  comment: PayloadDocument,
  post: PayloadDocument,
  space: PayloadDocument
): Promise<PendingCommunityModerationComment | null> {
  const id = safeRecordId(comment.id)
  const postId = safeRecordId(post.id)
  if (!id || !postId || comment.moderationStatus !== 'pending_review') return null

  const author = await findByIdSafe(
    payload,
    'payload_members',
    getDocumentId(comment.author)
  )

  return {
    kind: 'comment',
    id,
    postId,
    postTitle: (asString(post.title) ?? 'Community post').slice(0, 200),
    authorName: (asString(comment.displayName) ?? displayName(author)).slice(0, 120),
    createdAt: asDateString(comment.createdAt),
    space: spaceProjection(space),
    preview: projectCommunityRichText(comment.body),
  }
}

async function projectFile(
  payload: PayloadCourseAccessAPI,
  file: PayloadDocument,
  space: PayloadDocument
): Promise<PendingCommunityModerationFile | null> {
  const id = safeRecordId(file.id)
  if (!id || file.moderationStatus !== 'pending_review') return null

  const media = await findByIdSafe(
    payload,
    'payload_private_media',
    getDocumentId(file.protectedFile)
  )
  if (!media) return null

  const filename = safeFilename(media.filename)
  const mimeType = safeMimeType(media.mimeType ?? media.mime_type)
  const byteSize = asNumber(
    media.filesize ?? media.fileSize ?? media.size ?? media.byteSize
  )
  if (!filename || !mimeType || byteSize === null || byteSize < 0) return null

  const uploader = await findByIdSafe(
    payload,
    'payload_members',
    getDocumentId(file.uploadedBy)
  )

  return {
    kind: 'file',
    id,
    title: (asString(file.title) ?? filename).slice(0, 200),
    filename,
    mimeType,
    byteSize,
    uploaderName: displayName(uploader),
    createdAt: asDateString(file.createdAt),
    space: spaceProjection(space),
    downloadUrl: `/portal/community/files/${encodeURIComponent(id)}`,
  }
}

function byCreatedAtThenKind(
  a: PendingCommunityModerationItem,
  b: PendingCommunityModerationItem
): number {
  const aTime = new Date(a.createdAt ?? 0).getTime()
  const bTime = new Date(b.createdAt ?? 0).getTime()
  if (aTime !== bTime) return aTime - bTime
  if (a.kind !== b.kind) return a.kind.localeCompare(b.kind)
  return a.id.localeCompare(b.id)
}

export async function getPendingCommunityModerationItems(
  payload: PayloadCourseAccessAPI,
  actor: CommunityModerationActor
): Promise<CommunityModerationInbox> {
  const moderatedSpaceIds = await getModeratedSpaceIds(payload, actor)
  if (moderatedSpaceIds && moderatedSpaceIds.size === 0) {
    return { actorRole: null, items: [] }
  }

  const [posts, comments, files] = await Promise.all([
    findAll(payload, 'payload_space_posts', {
      where: { moderationStatus: { equals: 'pending_review' } },
      sort: 'createdAt',
    }),
    findAll(payload, 'payload_space_comments', {
      where: { moderationStatus: { equals: 'pending_review' } },
      sort: 'createdAt',
    }),
    findAll(payload, 'payload_space_files', {
      where: { moderationStatus: { equals: 'pending_review' } },
      sort: 'createdAt',
    }),
  ])

  const spaceCache = new Map<string, PayloadDocument | null>()
  const postCache = new Map<string, PayloadDocument | null>()

  async function loadSpace(spaceId: string): Promise<PayloadDocument | null> {
    if (!spaceCache.has(spaceId)) {
      spaceCache.set(
        spaceId,
        await findByIdSafe(payload, 'payload_spaces', spaceId)
      )
    }
    return spaceCache.get(spaceId) ?? null
  }

  async function loadPost(postId: string): Promise<PayloadDocument | null> {
    if (!postCache.has(postId)) {
      postCache.set(
        postId,
        await findByIdSafe(payload, 'payload_space_posts', postId)
      )
    }
    return postCache.get(postId) ?? null
  }

  function permits(spaceId: string): boolean {
    return moderatedSpaceIds === null || moderatedSpaceIds.has(spaceId)
  }

  const items: PendingCommunityModerationItem[] = []

  for (const post of posts) {
    const spaceId = getDocumentId(post.space)
    if (!spaceId || !permits(spaceId)) continue
    const space = await loadSpace(spaceId)
    if (!space) continue
    const projected = await projectPost(payload, post, space)
    if (projected) items.push(projected)
  }

  for (const comment of comments) {
    const postId = getDocumentId(comment.post)
    if (!postId) continue
    const post = await loadPost(postId)
    if (!post) continue
    const spaceId = getDocumentId(post.space)
    if (!spaceId || !permits(spaceId)) continue
    const space = await loadSpace(spaceId)
    if (!space) continue
    const projected = await projectComment(payload, comment, post, space)
    if (projected) items.push(projected)
  }

  for (const file of files) {
    const spaceId = getDocumentId(file.space)
    if (!spaceId || !permits(spaceId)) continue
    const space = await loadSpace(spaceId)
    if (!space) continue
    const projected = await projectFile(payload, file, space)
    if (projected) items.push(projected)
  }

  let actorRole: CommunityModerationCapability['role'] = null
  if (actor.type === 'admin') {
    actorRole = 'platform_admin'
  } else if (moderatedSpaceIds && moderatedSpaceIds.size > 0) {
    const capabilities = await Promise.all(
      [...moderatedSpaceIds].map((spaceId) =>
        getCommunityModerationCapability(payload, actor, spaceId)
      )
    )
    actorRole = capabilities.some(
      (capability) => capability.role === 'space_admin'
    )
      ? 'space_admin'
      : 'moderator'
  }

  return {
    actorRole,
    items: items.sort(byCreatedAtThenKind),
  }
}

export async function resolvePendingCommunityModerationItem(
  payload: PayloadCourseAccessAPI,
  actor: CommunityModerationActor,
  kind: PendingCommunityModerationItem['kind'],
  idInput: PayloadId
): Promise<CommunityModerationItemResult> {
  const id = safeRecordId(idInput)
  if (!id) return denied()

  if (kind === 'post') {
    const post = await findByIdSafe(payload, 'payload_space_posts', id)
    const spaceId = getDocumentId(post?.space)
    if (!post || !spaceId || post.moderationStatus !== 'pending_review') return denied()
    const capability = await getCommunityModerationCapability(payload, actor, spaceId)
    if (!capability.allowed) return denied()
    const space = await findByIdSafe(payload, 'payload_spaces', spaceId)
    if (!space) return denied()
    const item = await projectPost(payload, post, space)
    return item ? { allowed: true, item } : denied()
  }

  if (kind === 'comment') {
    const comment = await findByIdSafe(payload, 'payload_space_comments', id)
    const postId = getDocumentId(comment?.post)
    const post = await findByIdSafe(payload, 'payload_space_posts', postId)
    const spaceId = getDocumentId(post?.space)
    if (
      !comment ||
      !post ||
      !spaceId ||
      comment.moderationStatus !== 'pending_review'
    ) {
      return denied()
    }
    const capability = await getCommunityModerationCapability(payload, actor, spaceId)
    if (!capability.allowed) return denied()
    const space = await findByIdSafe(payload, 'payload_spaces', spaceId)
    if (!space) return denied()
    const item = await projectComment(payload, comment, post, space)
    return item ? { allowed: true, item } : denied()
  }

  if (kind === 'file') {
    const file = await findByIdSafe(payload, 'payload_space_files', id)
    const spaceId = getDocumentId(file?.space)
    if (!file || !spaceId || file.moderationStatus !== 'pending_review') return denied()
    const capability = await getCommunityModerationCapability(payload, actor, spaceId)
    if (!capability.allowed) return denied()
    const space = await findByIdSafe(payload, 'payload_spaces', spaceId)
    if (!space) return denied()
    const item = await projectFile(payload, file, space)
    return item ? { allowed: true, item } : denied()
  }

  return denied()
}




export type CommunityModerationDecision = 'approve' | 'reject'

export type ModeratePendingCommunityItemResult =
  | {
      allowed: true
      status: 'visible' | 'hidden'
      changed: boolean
    }
  | CommunityModerationDenied

function normalizeDecisionReason(
  decision: CommunityModerationDecision,
  reason?: string | null
): string | null {
  const normalized = typeof reason === 'string' ? reason.trim() : ''
  if (decision === 'reject') {
    if (!normalized || normalized.length > 500) {
      throw new Error('Moderation decision unavailable.')
    }
    return normalized
  }

  if (!normalized) return null
  if (normalized.length > 500) throw new Error('Moderation decision unavailable.')
  return normalized
}

type CommunityModerationOutcomeTarget = {
  authorId: string
  spaceId: string
}

async function resolveOutcomeTarget(
  payload: PayloadCourseAccessAPI,
  kind: PendingCommunityModerationItem['kind'],
  id: PayloadId
): Promise<CommunityModerationOutcomeTarget | null> {
  if (kind === 'post') {
    const post = await findByIdSafe(payload, 'payload_space_posts', id)
    const authorId = getDocumentId(post?.author)
    const spaceId = getDocumentId(post?.space)
    return authorId && spaceId ? { authorId, spaceId } : null
  }

  if (kind === 'comment') {
    const comment = await findByIdSafe(payload, 'payload_space_comments', id)
    const authorId = getDocumentId(comment?.author)
    const postId = getDocumentId(comment?.post)
    const post = await findByIdSafe(payload, 'payload_space_posts', postId)
    const spaceId = getDocumentId(post?.space)
    return authorId && spaceId ? { authorId, spaceId } : null
  }

  const file = await findByIdSafe(payload, 'payload_space_files', id)
  const authorId = getDocumentId(file?.uploadedBy)
  const spaceId = getDocumentId(file?.space)
  return authorId && spaceId ? { authorId, spaceId } : null
}

async function queueOutcomeNotificationSafely(
  payload: import('@/lib/payloadCourse/accessService').PayloadCourseWriteAPI,
  input: {
    kind: PendingCommunityModerationItem['kind']
    recordId: PayloadId
    target: CommunityModerationOutcomeTarget | null
    outcome: 'visible' | 'hidden'
  }
): Promise<void> {
  if (!input.target) return

  try {
    const { queueCommunityModerationOutcomeNotification } = await import(
      '@/lib/payloadCourse/communityModerationNotifications'
    )
    await queueCommunityModerationOutcomeNotification(payload, {
      kind: input.kind,
      recordId: input.recordId,
      spaceId: input.target.spaceId,
      authorId: input.target.authorId,
      outcome: input.outcome,
    })
  } catch {
    // Moderation and auditing are authoritative. Notification failures must
    // never reverse or conceal a successfully recorded decision.
  }
}

export async function moderatePendingCommunityItem(
  payload: import('@/lib/payloadCourse/accessService').PayloadCourseWriteAPI,
  input: {
    actor: CommunityModerationActor
    kind: PendingCommunityModerationItem['kind']
    id: PayloadId
    decision: CommunityModerationDecision
    reason?: string | null
  }
): Promise<ModeratePendingCommunityItemResult> {
  try {
    const pending = await resolvePendingCommunityModerationItem(
      payload,
      input.actor,
      input.kind,
      input.id
    )
    if (!pending.allowed) return denied()

    const moderationStatus = input.decision === 'approve' ? 'visible' : 'hidden'
    const reason = normalizeDecisionReason(input.decision, input.reason)
    const outcomeTarget = await resolveOutcomeTarget(
      payload,
      pending.item.kind,
      pending.item.id
    )

    if (pending.item.kind === 'post') {
      const { moderateSpacePost } = await import(
        '@/lib/payloadCourse/communityPosting'
      )
      await moderateSpacePost(payload, {
        actor: input.actor,
        postId: pending.item.id,
        moderationStatus,
        reason,
      })
      await queueOutcomeNotificationSafely(payload, {
        kind: 'post',
        recordId: pending.item.id,
        target: outcomeTarget,
        outcome: moderationStatus,
      })
      return { allowed: true, status: moderationStatus, changed: true }
    }

    if (pending.item.kind === 'comment') {
      const { moderateSpaceComment } = await import(
        '@/lib/payloadCourse/communityPosting'
      )
      await moderateSpaceComment(payload, {
        actor: input.actor,
        commentId: pending.item.id,
        moderationStatus,
        reason,
      })
      await queueOutcomeNotificationSafely(payload, {
        kind: 'comment',
        recordId: pending.item.id,
        target: outcomeTarget,
        outcome: moderationStatus,
      })
      return { allowed: true, status: moderationStatus, changed: true }
    }

    if (pending.item.kind === 'file') {
      const { moderateCommunityFile } = await import(
        '@/lib/payloadCourse/communityFiles'
      )
      const result = await moderateCommunityFile(payload, {
        actor: input.actor,
        fileId: pending.item.id,
        moderationStatus,
        reason,
      })
      await queueOutcomeNotificationSafely(payload, {
        kind: 'file',
        recordId: pending.item.id,
        target: outcomeTarget,
        outcome: moderationStatus,
      })
      return {
        allowed: true,
        status: moderationStatus,
        changed: result.changed,
      }
    }

    return denied()
  } catch {
    return denied()
  }
}

export type MemberCommunitySubmissionStatus =
  | 'Pending review'
  | 'Published'
  | 'Not published'

export type MemberCommunitySubmission = {
  kind: 'post' | 'comment' | 'file'
  title: string
  createdAt: string | null
  spaceName: string
  status: MemberCommunitySubmissionStatus
  downloadUrl: string | null
}

function submissionStatus(value: unknown): MemberCommunitySubmissionStatus | null {
  if (value === 'pending_review') return 'Pending review'
  if (value === 'visible') return 'Published'
  if (value === 'hidden' || value === 'deleted') return 'Not published'
  return null
}

export async function getMemberCommunitySubmissions(
  payload: PayloadCourseAccessAPI,
  memberIdInput: PayloadId
): Promise<MemberCommunitySubmission[]> {
  const memberId = String(memberIdInput)
  const [posts, comments, files] = await Promise.all([
    findAll(payload, 'payload_space_posts', {
      where: { author: { equals: memberId } },
      limit: 500,
      sort: '-createdAt',
    }),
    findAll(payload, 'payload_space_comments', {
      where: { author: { equals: memberId } },
      limit: 500,
      sort: '-createdAt',
    }),
    findAll(payload, 'payload_space_files', {
      where: { uploadedBy: { equals: memberId } },
      limit: 500,
      sort: '-createdAt',
    }),
  ])

  const spaceCache = new Map<string, PayloadDocument | null>()
  const postCache = new Map<string, PayloadDocument | null>()

  async function loadSpace(spaceId: string): Promise<PayloadDocument | null> {
    if (!spaceCache.has(spaceId)) {
      spaceCache.set(
        spaceId,
        await findByIdSafe(payload, 'payload_spaces', spaceId)
      )
    }
    return spaceCache.get(spaceId) ?? null
  }

  async function loadPost(postId: string): Promise<PayloadDocument | null> {
    if (!postCache.has(postId)) {
      postCache.set(
        postId,
        await findByIdSafe(payload, 'payload_space_posts', postId)
      )
    }
    return postCache.get(postId) ?? null
  }

  const submissions: MemberCommunitySubmission[] = []

  for (const post of posts) {
    const status = submissionStatus(post.moderationStatus)
    const spaceId = getDocumentId(post.space)
    if (!status || !spaceId) continue
    const space = await loadSpace(spaceId)
    if (!space) continue

    submissions.push({
      kind: 'post',
      title: (asString(post.title) ?? 'Community post').slice(0, 200),
      createdAt: asDateString(post.createdAt),
      spaceName: (asString(space.name) ?? 'Community space').slice(0, 160),
      status,
      downloadUrl: null,
    })
  }

  for (const comment of comments) {
    const status = submissionStatus(comment.moderationStatus)
    const postId = getDocumentId(comment.post)
    if (!status || !postId) continue
    const post = await loadPost(postId)
    const spaceId = getDocumentId(post?.space)
    if (!post || !spaceId) continue
    const space = await loadSpace(spaceId)
    if (!space) continue

    submissions.push({
      kind: 'comment',
      title: `Reply to ${(asString(post.title) ?? 'community post').slice(0, 180)}`,
      createdAt: asDateString(comment.createdAt),
      spaceName: (asString(space.name) ?? 'Community space').slice(0, 160),
      status,
      downloadUrl: null,
    })
  }

  for (const file of files) {
    const status = submissionStatus(file.moderationStatus)
    const spaceId = getDocumentId(file.space)
    if (!status || !spaceId) continue
    const space = await loadSpace(spaceId)
    if (!space) continue
    const id = safeRecordId(file.id)

    submissions.push({
      kind: 'file',
      title: (asString(file.title) ?? 'Community file').slice(0, 200),
      createdAt: asDateString(file.createdAt),
      spaceName: (asString(space.name) ?? 'Community space').slice(0, 160),
      status,
      downloadUrl:
        status === 'Published' && id
          ? `/portal/community/files/${encodeURIComponent(id)}`
          : null,
    })
  }

  return submissions.sort((a, b) => {
    const aTime = new Date(a.createdAt ?? 0).getTime()
    const bTime = new Date(b.createdAt ?? 0).getTime()
    if (aTime !== bTime) return bTime - aTime
    if (a.kind !== b.kind) return a.kind.localeCompare(b.kind)
    return a.title.localeCompare(b.title)
  })
}
