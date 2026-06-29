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

export type CommunityAttachmentType =
  | 'document'
  | 'image'
  | 'external_video'
  | 'private_video'

export type CommunityExternalVideoProvider = 'youtube' | 'vimeo'

export type RegisterCommunityFileMetadataInput = {
  memberId: PayloadId
  spaceId: PayloadId
  mediaId?: PayloadId
  title: string
  postId?: PayloadId
  commentId?: PayloadId
  attachmentType?: CommunityAttachmentType
  altText?: string
  externalProvider?: CommunityExternalVideoProvider
  externalMediaId?: string
  bunnyVideoId?: string
  bunnyLibraryId?: string
}

export type RegisterCommunityFileMetadataResult = {
  document: PayloadDocument
  auditEvent: PayloadDocument
}

type MemberCommunityAttachmentBase = {
  id: string
  title: string
  spaceId: string
  spaceName: string
}

export type MemberCommunityProtectedFile = MemberCommunityAttachmentBase & {
  attachmentType?: 'document' | 'image'
  filename: string
  mimeType: CommunityFileMimeType
  byteSize: number
  downloadUrl: string
  altText?: string
}

export type MemberCommunityExternalVideo = MemberCommunityAttachmentBase & {
  attachmentType: 'external_video'
  externalProvider: CommunityExternalVideoProvider
  externalMediaId: string
  filename?: never
  mimeType?: never
  byteSize?: never
  downloadUrl?: never
  altText?: never
}

export type MemberCommunityPrivateVideo = MemberCommunityAttachmentBase & {
  attachmentType: 'private_video'
  bunnyVideoId: string
  bunnyLibraryId: string
  filename?: never
  mimeType?: never
  byteSize?: never
  downloadUrl?: never
  altText?: never
}

export type MemberCommunityFile =
  | MemberCommunityProtectedFile
  | MemberCommunityExternalVideo
  | MemberCommunityPrivateVideo

export type MemberCommunityProtectedFileDownload = MemberCommunityProtectedFile & {
  allowed: true
  media: {
    id: string
    filename: string
    mimeType: CommunityFileMimeType
    byteSize: number
    storage: 'private'
  }
}

export type MemberCommunityAttachmentResolution =
  | MemberCommunityProtectedFileDownload
  | (MemberCommunityExternalVideo & { allowed: true })
  | (MemberCommunityPrivateVideo & { allowed: true })

export type MemberCommunityFileDownload = MemberCommunityProtectedFileDownload

export type MemberCommunityFileDownloadDenied = {
  allowed: false
  reason: 'not_found'
}

function normalizeStoredAttachmentType(file: PayloadDocument): CommunityAttachmentType | null {
  const value = asString(file.attachmentType)
  if (!value) return 'document'
  return value === 'document' ||
    value === 'image' ||
    value === 'external_video' ||
    value === 'private_video'
    ? value
    : null
}

function normalizeExternalVideoIdentity(
  file: PayloadDocument
): { externalProvider: CommunityExternalVideoProvider; externalMediaId: string } | null {
  const externalProvider = asString(file.externalProvider)
  const externalMediaId = asString(file.externalMediaId)
  if (externalProvider !== 'youtube' && externalProvider !== 'vimeo') return null
  const valid =
    externalProvider === 'youtube'
      ? /^[A-Za-z0-9_-]{6,32}$/.test(externalMediaId ?? '')
      : /^\d{6,20}$/.test(externalMediaId ?? '')
  return valid && externalMediaId ? { externalProvider, externalMediaId } : null
}

function normalizeBunnyVideoIdentity(
  file: PayloadDocument
): { bunnyVideoId: string; bunnyLibraryId: string } | null {
  const bunnyVideoId = asString(file.bunnyVideoId)
  const bunnyLibraryId = asString(file.bunnyLibraryId)
  if (
    !bunnyVideoId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      bunnyVideoId
    ) ||
    !bunnyLibraryId ||
    !/^\d{1,20}$/.test(bunnyLibraryId)
  ) {
    return null
  }
  return { bunnyVideoId, bunnyLibraryId }
}

async function hasTrustedCommunityFileParent(
  payload: PayloadCourseAccessAPI,
  file: PayloadDocument,
  spaceId: string
): Promise<boolean> {
  const postId = getDocumentId(file.post)
  const commentId = getDocumentId(file.comment)
  if (postId && commentId) return false

  if (postId) {
    const post = await findByIdSafe(payload, 'payload_space_posts', postId)
    return getDocumentId(post?.space) === spaceId
  }

  if (commentId) {
    const comment = await findByIdSafe(payload, 'payload_space_comments', commentId)
    const commentPostId = getDocumentId(comment?.post)
    if (!commentPostId) return false
    const post = await findByIdSafe(payload, 'payload_space_posts', commentPostId)
    return getDocumentId(post?.space) === spaceId
  }

  return true
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
): MemberCommunityProtectedFile {
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
  const mediaId = input.mediaId == null ? null : String(input.mediaId)
  const title = assertTitle(input.title)
  const attachmentType = input.attachmentType ?? 'document'
  const requestedPostId = input.postId == null ? null : String(input.postId)
  const requestedCommentId = input.commentId == null ? null : String(input.commentId)
  const altText = input.altText?.trim() || null
  const externalProvider = input.externalProvider ?? null
  const externalMediaId = input.externalMediaId?.trim() || null
  const bunnyVideoId = input.bunnyVideoId?.trim() || null
  const bunnyLibraryId = input.bunnyLibraryId?.trim() || null

  const unsafeInputKey = Object.keys(input).find((key) =>
    /(?:signedurl|token|secret|hostname|storagepath|filepath)/i.test(key)
  )
  if (unsafeInputKey) {
    throw new Error(`Unsafe attachment metadata is not accepted: ${unsafeInputKey}`)
  }

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

  let filename: string | null = null
  let mimeType: CommunityFileMimeType | null = null
  let byteSize: number | null = null

  if (attachmentType === 'document' || attachmentType === 'image') {
    if (!mediaId) throw new Error('Protected private media is required for this attachment type.')
    if (externalProvider || externalMediaId || bunnyVideoId || bunnyLibraryId) {
      throw new Error('Video identifiers are incompatible with protected file attachments.')
    }

    const media = await findByIdSafe(payload, 'payload_private_media', mediaId)
    if (!media) throw new Error('Private media record was not found.')

    filename = normalizeFilename(media.filename)
    mimeType = normalizeMimeType(media)
    byteSize = normalizeByteSize(media)

    if (attachmentType === 'document' && altText) {
      throw new Error('Alt text is only supported for image attachments.')
    }
    if (attachmentType === 'image') {
      if (!mimeType.startsWith('image/')) throw new Error('Image attachments require image media.')
      if (!altText) throw new Error('Image alt text is required.')
      if (altText.length > 250) throw new Error('Image alt text is too long.')
    }
  } else if (attachmentType === 'external_video') {
    if (mediaId || altText || bunnyVideoId || bunnyLibraryId) {
      throw new Error('External video fields are incompatible with protected or private video fields.')
    }
    if (externalProvider !== 'youtube' && externalProvider !== 'vimeo') {
      throw new Error('External video provider must be YouTube or Vimeo.')
    }
    const validExternalId =
      externalProvider === 'youtube'
        ? /^[A-Za-z0-9_-]{6,32}$/.test(externalMediaId ?? '')
        : /^\d{6,20}$/.test(externalMediaId ?? '')
    if (!validExternalId) throw new Error('External video media ID is invalid.')
  } else if (attachmentType === 'private_video') {
    if (mediaId || altText || externalProvider || externalMediaId) {
      throw new Error('Private video fields are incompatible with protected or external video fields.')
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(bunnyVideoId ?? '')) {
      throw new Error('Bunny video ID is invalid.')
    }
    if (!/^\d{1,20}$/.test(bunnyLibraryId ?? '')) {
      throw new Error('Bunny library ID is invalid.')
    }
  } else {
    throw new Error('Attachment type is invalid.')
  }

  const document = await payload.create({
    collection: 'payload_space_files',
    data: {
      title,
      space: spaceId,
      ...(trustedPostId ? { post: trustedPostId } : {}),
      ...(trustedCommentId ? { comment: trustedCommentId } : {}),
      uploadedBy: memberId,
      attachmentType,
      ...(mediaId ? { protectedFile: mediaId } : {}),
      ...(altText ? { altText } : {}),
      ...(externalProvider ? { externalProvider } : {}),
      ...(externalMediaId ? { externalMediaId } : {}),
      ...(bunnyVideoId ? { bunnyVideoId } : {}),
      ...(bunnyLibraryId ? { bunnyLibraryId } : {}),
      moderationStatus: 'pending_review',
      metadata: {
        ...(filename ? { filename } : {}),
        ...(mimeType ? { mimeType } : {}),
        ...(byteSize != null ? { byteSize } : {}),
        ...(mediaId ? { storageReference: mediaId } : {}),
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
      attachmentType,
      ...(mediaId ? { mediaId } : {}),
      ...(filename ? { filename } : {}),
      ...(mimeType ? { mimeType } : {}),
      ...(byteSize != null ? { byteSize } : {}),
      ...(externalProvider ? { externalProvider } : {}),
      ...(externalMediaId ? { externalMediaId } : {}),
      ...(bunnyVideoId ? { bunnyVideoId } : {}),
      ...(bunnyLibraryId ? { bunnyLibraryId } : {}),
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

async function buildMemberCommunityAttachmentProjection(
  payload: PayloadCourseAccessAPI,
  file: PayloadDocument,
  space: PayloadDocument
): Promise<MemberCommunityFile | null> {
  const attachmentType = normalizeStoredAttachmentType(file)
  if (!attachmentType) return null

  const base: MemberCommunityAttachmentBase = {
    id: String(file.id),
    title: asString(file.title) ?? 'Community attachment',
    spaceId: String(space.id),
    spaceName: asString(space.name) ?? 'Community space',
  }
  const protectedMediaId = getDocumentId(file.protectedFile)
  const altText = asString(file.altText)
  const hasExternalFields = Boolean(asString(file.externalProvider) || asString(file.externalMediaId))
  const hasBunnyFields = Boolean(asString(file.bunnyVideoId) || asString(file.bunnyLibraryId))

  if (attachmentType === 'document' || attachmentType === 'image') {
    if (!protectedMediaId || hasExternalFields || hasBunnyFields) return null
    if (attachmentType === 'document' && altText) return null

    const media = await findByIdSafe(payload, 'payload_private_media', protectedMediaId)
    if (!media) return null

    try {
      const filename = normalizeDownloadFilename(media.filename)
      const mimeType = normalizeMimeType(media)
      const byteSize = normalizeByteSize(media)
      if (attachmentType === 'image') {
        if (!mimeType.startsWith('image/') || !altText || altText.length > 250) return null
      }

      return {
        ...base,
        attachmentType,
        filename,
        mimeType,
        byteSize,
        downloadUrl: `/learn/community/files/${String(file.id)}`,
        ...(attachmentType === 'image' && altText ? { altText } : {}),
      }
    } catch {
      return null
    }
  }

  if (attachmentType === 'external_video') {
    if (protectedMediaId || altText || hasBunnyFields) return null
    const identity = normalizeExternalVideoIdentity(file)
    return identity ? { ...base, attachmentType, ...identity } : null
  }

  if (protectedMediaId || altText || hasExternalFields) return null
  const identity = normalizeBunnyVideoIdentity(file)
  return identity ? { ...base, attachmentType, ...identity } : null
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
    if (!spaceId) continue

    const access = await evaluatePayloadSpaceAccess(payload, { memberId, spaceId })
    if (!access.decision.allowed) continue
    if (!(await hasTrustedCommunityFileParent(payload, file, spaceId))) continue

    const space = await findByIdSafe(payload, 'payload_spaces', spaceId)
    if (!space) continue
    const projection = await buildMemberCommunityAttachmentProjection(payload, file, space)
    if (projection) projections.push(projection)
  }

  return projections
}

export async function resolveMemberCommunityAttachment(
  payload: PayloadCourseAccessAPI,
  memberIdInput: PayloadId,
  fileIdInput: PayloadId
): Promise<MemberCommunityAttachmentResolution | MemberCommunityFileDownloadDenied> {
  const fileId = String(fileIdInput)
  if (!isSafeResourceId(fileId)) return { allowed: false, reason: 'not_found' }

  const file = await findByIdSafe(payload, 'payload_space_files', fileId)
  if (!file || file.moderationStatus !== 'visible') {
    return { allowed: false, reason: 'not_found' }
  }

  const memberId = String(memberIdInput)
  const spaceId = getDocumentId(file.space)
  if (!spaceId) return { allowed: false, reason: 'not_found' }

  const access = await evaluatePayloadSpaceAccess(payload, { memberId, spaceId })
  if (!access.decision.allowed) return { allowed: false, reason: 'not_found' }
  if (!(await hasTrustedCommunityFileParent(payload, file, spaceId))) {
    return { allowed: false, reason: 'not_found' }
  }

  const space = await findByIdSafe(payload, 'payload_spaces', spaceId)
  if (!space) return { allowed: false, reason: 'not_found' }
  const projection = await buildMemberCommunityAttachmentProjection(payload, file, space)
  if (!projection) return { allowed: false, reason: 'not_found' }

  if (projection.attachmentType === 'external_video' || projection.attachmentType === 'private_video') {
    return { ...projection, allowed: true }
  }

  const protectedMediaId = getDocumentId(file.protectedFile)
  if (!protectedMediaId) return { allowed: false, reason: 'not_found' }
  return {
    ...projection,
    allowed: true,
    media: {
      id: protectedMediaId,
      filename: projection.filename,
      mimeType: projection.mimeType,
      byteSize: projection.byteSize,
      storage: 'private',
    },
  }
}

export async function resolveMemberCommunityFileDownload(
  payload: PayloadCourseAccessAPI,
  memberIdInput: PayloadId,
  fileIdInput: PayloadId
): Promise<MemberCommunityFileDownload | MemberCommunityFileDownloadDenied> {
  const resolution = await resolveMemberCommunityAttachment(payload, memberIdInput, fileIdInput)
  if (!resolution.allowed || !('media' in resolution)) {
    return { allowed: false, reason: 'not_found' }
  }
  return resolution
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
