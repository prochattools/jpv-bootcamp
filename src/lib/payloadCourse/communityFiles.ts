import {
  evaluatePayloadSpaceAccess,
  type PayloadCourseAccessAPI,
  type PayloadCourseWriteAPI,
  type PayloadDocument,
  type PayloadId,
} from '@/lib/payloadCourse/accessService'
import { createAuditEvent } from '@/lib/payloadCourse/events'
import {
  isSafeResourceId,
  sanitizeDownloadFilename,
} from '@/lib/payloadCourse/lessonResourceDelivery'

export const COMMUNITY_FILE_MAX_BYTES = 25 * 1024 * 1024

export const COMMUNITY_FILE_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'video/mp4',
] as const

type CommunityFileMimeType = (typeof COMMUNITY_FILE_MIME_TYPES)[number]

export type RegisterCommunityFileMetadataInput = {
  memberId: PayloadId
  spaceId: PayloadId
  mediaId: PayloadId
  title: string
  postId?: PayloadId
  commentId?: PayloadId
}

export type RegisterCommunityFileMetadataResult = {
  document: PayloadDocument
  auditEvent: PayloadDocument
}

export type MemberCommunityFile = {
  id: string
  title: string
  filename: string
  mimeType: CommunityFileMimeType
  byteSize: number
  spaceId: string
  spaceName: string
  downloadUrl: string
}

export type MemberCommunityFileDownload = MemberCommunityFile & {
  allowed: true
  media: {
    id: string
    filename: string
    mimeType: CommunityFileMimeType
    byteSize: number
    storage: 'private'
  }
}

export type MemberCommunityFileDownloadDenied = {
  allowed: false
  reason: 'not_found'
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

function getDocumentId(value: unknown): string | null {
  const direct = asString(value)
  if (direct) return direct
  if (!value || typeof value !== 'object' || !('id' in value)) return null
  return asString((value as { id?: unknown }).id)
}

function assertTitle(value: string): string {
  const title = value.trim()
  if (!title) throw new Error('File title is required.')
  if (title.length > 160) throw new Error('File title is too long.')
  return title
}

function normalizeFilename(value: unknown): string {
  const raw = asString(value)
  if (!raw || raw.includes('\0')) throw new Error('Media filename is required.')

  const filename = raw.replace(/\\/g, '/').split('/').filter(Boolean).pop()
  if (!filename || filename === '.' || filename === '..') {
    throw new Error('Media filename is invalid.')
  }
  if (filename.length > 255) throw new Error('Media filename is too long.')

  const sanitized = sanitizeDownloadFilename(filename)
  if (!sanitized || sanitized.length > 255) throw new Error('Media filename is invalid.')
  return sanitized
}

function normalizeDownloadFilename(value: unknown): string {
  const raw = asString(value)
  if (!raw || raw.includes('\0') || raw.includes('/') || raw.includes('\\')) {
    throw new Error('Media filename is unsafe.')
  }

  const sanitized = sanitizeDownloadFilename(raw)
  if (!sanitized || sanitized !== raw || sanitized.length > 255) {
    throw new Error('Media filename is unsafe.')
  }
  return sanitized
}

function normalizeMimeType(media: PayloadDocument): CommunityFileMimeType {
  const mimeType = asString(media.mimeType) ?? asString(media.mime_type)
  if (!mimeType || !COMMUNITY_FILE_MIME_TYPES.includes(mimeType as CommunityFileMimeType)) {
    throw new Error('Media MIME type is not allowed.')
  }
  return mimeType as CommunityFileMimeType
}

function normalizeByteSize(media: PayloadDocument): number {
  const byteSize = asNumber(media.filesize) ?? asNumber(media.fileSize)
  if (!byteSize || !Number.isInteger(byteSize) || byteSize <= 0) {
    throw new Error('Media byte size is invalid.')
  }
  if (byteSize > COMMUNITY_FILE_MAX_BYTES) {
    throw new Error('Media file exceeds the community file size limit.')
  }
  return byteSize
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
    limit: args.limit ?? 100,
    depth: 0,
    sort: args.sort,
    overrideAccess: true,
  })
  return result.docs
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

async function findActivePublishingMembership(
  payload: PayloadCourseWriteAPI,
  memberId: string,
  spaceId: string
): Promise<PayloadDocument | null> {
  const result = await payload.find({
    collection: 'payload_space_memberships',
    where: {
      and: [
        { member: { equals: memberId } },
        { space: { equals: spaceId } },
      ],
    },
    limit: 1,
    depth: 0,
    sort: '-updatedAt',
    overrideAccess: true,
  })

  const membership = result.docs[0] ?? null
  if (!membership || membership.status !== 'active') return null
  if (membership.role !== 'moderator' && membership.role !== 'admin') return null
  return membership
}

function buildMemberCommunityFile(
  file: PayloadDocument,
  space: PayloadDocument,
  media: PayloadDocument,
  filename: string,
  mimeType: CommunityFileMimeType,
  byteSize: number
): MemberCommunityFile {
  return {
    id: String(file.id),
    title: asString(file.title) ?? 'Community file',
    filename,
    mimeType,
    byteSize,
    spaceId: String(space.id),
    spaceName: asString(space.name) ?? 'Community space',
    downloadUrl: `/learn/community/files/${String(file.id)}`,
  }
}

export async function registerCommunityFileMetadata(
  payload: PayloadCourseWriteAPI,
  input: RegisterCommunityFileMetadataInput
): Promise<RegisterCommunityFileMetadataResult> {
  const memberId = String(input.memberId)
  const spaceId = String(input.spaceId)
  const mediaId = String(input.mediaId)
  const title = assertTitle(input.title)
  const parentInput = input as RegisterCommunityFileMetadataInput & {
    postId?: PayloadId
    commentId?: PayloadId
  }
  const requestedPostId = parentInput.postId == null ? null : String(parentInput.postId)
  const requestedCommentId = parentInput.commentId == null ? null : String(parentInput.commentId)

  if (requestedPostId && requestedCommentId) {
    throw new Error('A community file cannot belong to both a post and a comment.')
  }

  let trustedPostId: string | null = null
  let trustedCommentId: string | null = null

  if (requestedPostId) {
    const post = await findByIdSafe(payload, 'payload_space_posts', requestedPostId)
    if (!post) throw new Error('Parent post was not found.')

    const parentSpaceId = getDocumentId(post.space)
    if (!parentSpaceId || parentSpaceId !== spaceId) {
      throw new Error('Parent post does not belong to the selected space.')
    }
    trustedPostId = requestedPostId
  }

  if (requestedCommentId) {
    const comment = await findByIdSafe(payload, 'payload_space_comments', requestedCommentId)
    if (!comment) throw new Error('Parent comment was not found.')

    const commentPostId = getDocumentId(comment.post)
    if (!commentPostId) throw new Error('Parent comment is not linked to a trusted post.')

    const commentPost = await findByIdSafe(payload, 'payload_space_posts', commentPostId)
    if (!commentPost) throw new Error('Parent comment post was not found.')

    const parentSpaceId = getDocumentId(commentPost.space)
    if (!parentSpaceId || parentSpaceId !== spaceId) {
      throw new Error('Parent comment does not belong to the selected space.')
    }
    trustedCommentId = requestedCommentId
  }

  const access = await evaluatePayloadSpaceAccess(payload, {
    memberId,
    spaceId,
  })
  if (!access.decision.allowed) {
    throw new Error(`Space access denied: ${access.decision.reason}`)
  }

  const membership = await findActivePublishingMembership(payload, memberId, spaceId)
  if (!membership) {
    throw new Error('Active moderator or admin space membership is required.')
  }

  const media = await findByIdSafe(payload, 'payload_private_media', mediaId)
  if (!media) throw new Error('Private media record was not found.')

  const filename = normalizeFilename(media.filename)
  const mimeType = normalizeMimeType(media)
  const byteSize = normalizeByteSize(media)
  const storageReference = mediaId

  const document = await payload.create({
    collection: 'payload_space_files',
    data: {
      title,
      space: spaceId,
      ...(trustedPostId ? { post: trustedPostId } : {}),
      ...(trustedCommentId ? { comment: trustedCommentId } : {}),
      uploadedBy: memberId,
      protectedFile: mediaId,
      moderationStatus: 'pending_review',
      metadata: {
        filename,
        mimeType,
        byteSize,
        storageReference,
        createdByService: 'communityFiles.registerCommunityFileMetadata',
      },
    },
    overrideAccess: true,
  })

  const auditEvent = await createAuditEvent(payload, {
    actorType: 'member',
    actorId: memberId,
    action: 'space_file.created',
    targetCollection: 'payload_space_files',
    targetId: document.id,
    after: document,
    metadata: {
      spaceId,
      mediaId,
      filename,
      mimeType,
      byteSize,
      storageReference,
    },
  })

  try {
    const { queuePendingCommunityModerationNotifications } = await import(
      '@/lib/payloadCourse/communityModerationNotifications'
    )
    await queuePendingCommunityModerationNotifications(payload, {
      kind: 'file',
      recordId: document.id,
      spaceId,
    })
  } catch {
    // File registration and auditing must remain successful when notification
    // recipient resolution or event queuing is unavailable.
  }

  return { document, auditEvent }
}

export async function getMemberCommunityFiles(
  payload: PayloadCourseAccessAPI,
  memberIdInput: PayloadId,
  optionalSpaceId?: PayloadId | null
): Promise<MemberCommunityFile[]> {
  const memberId = String(memberIdInput)
  const requestedSpaceId = optionalSpaceId ? String(optionalSpaceId) : null
  const where = requestedSpaceId
    ? {
        and: [
          { moderationStatus: { equals: 'visible' } },
          { space: { equals: requestedSpaceId } },
        ],
      }
    : { moderationStatus: { equals: 'visible' } }

  const files = await findAll(payload, 'payload_space_files', {
    where,
    sort: '-createdAt',
    limit: 200,
  })
  const projections: MemberCommunityFile[] = []

  for (const file of files) {
    const spaceId = getDocumentId(file.space)
    const protectedMediaId = getDocumentId(file.protectedFile)
    if (!spaceId || !protectedMediaId) continue

    const access = await evaluatePayloadSpaceAccess(payload, {
      memberId,
      spaceId,
    })
    if (!access.decision.allowed) continue

    const [space, media] = await Promise.all([
      findByIdSafe(payload, 'payload_spaces', spaceId),
      findByIdSafe(payload, 'payload_private_media', protectedMediaId),
    ])
    if (!space || !media) continue

    try {
      const filename = normalizeDownloadFilename(media.filename)
      const mimeType = normalizeMimeType(media)
      const byteSize = normalizeByteSize(media)
      projections.push(
        buildMemberCommunityFile(file, space, media, filename, mimeType, byteSize)
      )
    } catch {
      continue
    }
  }

  return projections
}

export async function resolveMemberCommunityFileDownload(
  payload: PayloadCourseAccessAPI,
  memberIdInput: PayloadId,
  fileIdInput: PayloadId
): Promise<MemberCommunityFileDownload | MemberCommunityFileDownloadDenied> {
  const fileId = String(fileIdInput)
  if (!isSafeResourceId(fileId)) return { allowed: false, reason: 'not_found' }

  const file = await findByIdSafe(payload, 'payload_space_files', fileId)
  if (!file || file.moderationStatus !== 'visible') {
    return { allowed: false, reason: 'not_found' }
  }

  const memberId = String(memberIdInput)
  const spaceId = getDocumentId(file.space)
  const protectedMediaId = getDocumentId(file.protectedFile)
  if (!spaceId || !protectedMediaId) return { allowed: false, reason: 'not_found' }

  const access = await evaluatePayloadSpaceAccess(payload, {
    memberId,
    spaceId,
  })
  if (!access.decision.allowed) return { allowed: false, reason: 'not_found' }

  const [space, media] = await Promise.all([
    findByIdSafe(payload, 'payload_spaces', spaceId),
    findByIdSafe(payload, 'payload_private_media', protectedMediaId),
  ])
  if (!space || !media) return { allowed: false, reason: 'not_found' }

  try {
    const filename = normalizeDownloadFilename(media.filename)
    const mimeType = normalizeMimeType(media)
    const byteSize = normalizeByteSize(media)
    const projection = buildMemberCommunityFile(
      file,
      space,
      media,
      filename,
      mimeType,
      byteSize
    )

    return {
      ...projection,
      allowed: true,
      media: {
        id: protectedMediaId,
        filename,
        mimeType,
        byteSize,
        storage: 'private',
      },
    }
  } catch {
    return { allowed: false, reason: 'not_found' }
  }
}

export type ModerateCommunityFileResult = {
  document: PayloadDocument
  auditEvent: PayloadDocument | null
  changed: boolean
}

export type ResolveModerationCommunityFileDownloadResult =
  | MemberCommunityFileDownload
  | MemberCommunityFileDownloadDenied

function normalizeModerationReason(
  status: 'visible' | 'hidden',
  reason?: string | null
): string | null {
  const normalized = typeof reason === 'string' ? reason.trim() : ''
  if (status === 'hidden') {
    if (!normalized) throw new Error('A moderation reason is required.')
    if (normalized.length > 500) throw new Error('The moderation reason is too long.')
    return normalized
  }

  if (!normalized) return null
  if (normalized.length > 500) throw new Error('The moderation reason is too long.')
  return normalized
}

export async function moderateCommunityFile(
  payload: PayloadCourseWriteAPI,
  input: {
    actor: import('@/lib/payloadCourse/communityModeration').CommunityModerationActor
    fileId: PayloadId
    moderationStatus: 'visible' | 'hidden'
    reason?: string | null
  }
): Promise<ModerateCommunityFileResult> {
  const fileId = String(input.fileId)
  if (!isSafeResourceId(fileId)) throw new Error('Community file was not found.')

  const file = await findByIdSafe(payload, 'payload_space_files', fileId)
  if (!file) throw new Error('Community file was not found.')

  if (file.moderationStatus === input.moderationStatus) {
    return {
      document: file,
      auditEvent: null,
      changed: false,
    }
  }
  if (file.moderationStatus !== 'pending_review') {
    throw new Error('Community file was not found.')
  }

  const spaceId = getDocumentId(file.space)
  if (!spaceId) throw new Error('Community file was not found.')

  const { getCommunityModerationCapability } = await import(
    '@/lib/payloadCourse/communityModeration'
  )
  const capability = await getCommunityModerationCapability(
    payload,
    input.actor,
    spaceId
  )
  if (!capability.allowed) throw new Error('Community file was not found.')

  const reason = normalizeModerationReason(input.moderationStatus, input.reason)
  const actorId = input.actor.id ? String(input.actor.id) : input.actor.type
  const metadata =
    file.metadata && typeof file.metadata === 'object' && !Array.isArray(file.metadata)
      ? (file.metadata as Record<string, unknown>)
      : {}

  const updated = await payload.update({
    collection: 'payload_space_files',
    id: file.id,
    data: {
      moderationStatus: input.moderationStatus,
      metadata: {
        ...metadata,
        moderationReason: reason,
        moderatedBy: actorId,
      },
    },
    overrideAccess: true,
  })

  const auditEvent = await createAuditEvent(payload, {
    actorType: input.actor.type,
    actorId: input.actor.id ?? null,
    action: 'space_file.moderated',
    targetCollection: 'payload_space_files',
    targetId: updated.id,
    before: file,
    after: updated,
    metadata: {
      spaceId,
      moderationStatus: input.moderationStatus,
      reason,
    },
  })

  return {
    document: updated,
    auditEvent,
    changed: true,
  }
}

export async function resolveModerationCommunityFileDownload(
  payload: PayloadCourseAccessAPI,
  actor: import('@/lib/payloadCourse/communityModeration').CommunityModerationActor,
  fileIdInput: PayloadId
): Promise<ResolveModerationCommunityFileDownloadResult> {
  const fileId = String(fileIdInput)
  if (!isSafeResourceId(fileId)) return { allowed: false, reason: 'not_found' }

  const file = await findByIdSafe(payload, 'payload_space_files', fileId)
  if (!file || file.moderationStatus !== 'pending_review') {
    return { allowed: false, reason: 'not_found' }
  }

  const spaceId = getDocumentId(file.space)
  const protectedMediaId = getDocumentId(file.protectedFile)
  if (!spaceId || !protectedMediaId) return { allowed: false, reason: 'not_found' }

  const { getCommunityModerationCapability } = await import(
    '@/lib/payloadCourse/communityModeration'
  )
  const capability = await getCommunityModerationCapability(payload, actor, spaceId)
  if (!capability.allowed) return { allowed: false, reason: 'not_found' }

  const [space, media] = await Promise.all([
    findByIdSafe(payload, 'payload_spaces', spaceId),
    findByIdSafe(payload, 'payload_private_media', protectedMediaId),
  ])
  if (!space || !media) return { allowed: false, reason: 'not_found' }

  try {
    const filename = normalizeDownloadFilename(media.filename)
    const mimeType = normalizeMimeType(media)
    const byteSize = normalizeByteSize(media)
    const projection = buildMemberCommunityFile(
      file,
      space,
      media,
      filename,
      mimeType,
      byteSize
    )

    return {
      ...projection,
      allowed: true,
      media: {
        id: protectedMediaId,
        filename,
        mimeType,
        byteSize,
        storage: 'private',
      },
    }
  } catch {
    return { allowed: false, reason: 'not_found' }
  }
}
