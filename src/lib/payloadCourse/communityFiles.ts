import type {
  PayloadCourseWriteAPI,
  PayloadDocument,
  PayloadId,
} from '@/lib/payloadCourse/accessService'
import { evaluatePayloadSpaceAccess } from '@/lib/payloadCourse/accessService'
import { createAuditEvent } from '@/lib/payloadCourse/events'

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

type RegisterCommunityFileMetadataInput = {
  memberId: PayloadId
  spaceId: PayloadId
  mediaId: PayloadId
  title: string
}

type RegisterCommunityFileMetadataResult = {
  document: PayloadDocument
  auditEvent: PayloadDocument
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

  return filename
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

async function findMedia(
  payload: PayloadCourseWriteAPI,
  mediaId: string
): Promise<PayloadDocument | null> {
  try {
    return await payload.findByID({
      collection: 'payload_media',
      id: mediaId,
      depth: 0,
      overrideAccess: true,
    })
  } catch {
    return null
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

  const media = await findMedia(payload, mediaId)
  if (!media) throw new Error('Media record was not found.')

  const filename = normalizeFilename(media.filename)
  const mimeType = normalizeMimeType(media)
  const byteSize = normalizeByteSize(media)
  const storageReference = mediaId

  const document = await payload.create({
    collection: 'payload_space_files',
    data: {
      title,
      space: spaceId,
      uploadedBy: memberId,
      file: mediaId,
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

  return { document, auditEvent }
}
