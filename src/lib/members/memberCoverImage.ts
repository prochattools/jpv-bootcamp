import type { getPayload } from 'payload'

import type { PayloadCourseWriteAPI, PayloadId } from '@/lib/payloadCourse/accessService'
import { createAuditEvent } from '@/lib/payloadCourse/events'
import { isEligibleCurrentMember } from '@/lib/members/currentMember'

const MAX_COVER_IMAGE_BYTES = 8 * 1024 * 1024
const ALLOWED_COVER_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

type PayloadInstance = Awaited<ReturnType<typeof getPayload>>

export type MemberCoverImageError =
  | 'account_ineligible'
  | 'missing_file'
  | 'unsupported_type'
  | 'file_too_large'
  | 'empty_file'

export type MemberCoverImageResult =
  | {
      ok: true
      mediaId: string | null
      previousMediaId: string | null
    }
  | {
      ok: false
      error: MemberCoverImageError
    }

export type MemberCoverUpload = {
  name: string
  type: string
  size: number
  arrayBuffer(): Promise<ArrayBuffer>
}

function relationshipId(value: unknown): string | null {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (!value || typeof value !== 'object') return null
  const id = (value as { id?: unknown }).id
  return typeof id === 'string' || typeof id === 'number' ? String(id) : null
}

function payloadMemberRelationId(memberId: PayloadId): number {
  const numeric = typeof memberId === 'number' ? memberId : Number(memberId)
  if (!Number.isSafeInteger(numeric) || numeric <= 0) {
    throw new Error('Invalid Payload member relation id')
  }
  return numeric
}

function safeFilename(name: string, mimeType: string): string {
  const extensionByMime: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
  }
  const fallbackExtension = extensionByMime[mimeType] ?? ''
  const dotIndex = name.lastIndexOf('.')
  const rawBase = dotIndex > 0 ? name.slice(0, dotIndex) : name
  const rawExtension = dotIndex > 0 ? name.slice(dotIndex).toLowerCase() : fallbackExtension
  const base = rawBase.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').slice(0, 80) || 'cover'
  const extension = /^\.[a-z0-9]{2,5}$/.test(rawExtension) ? rawExtension : fallbackExtension
  return `${base}${extension}`
}

async function requireEligibleMember(payload: PayloadInstance, memberId: PayloadId) {
  const member = await payload.findByID({
    collection: 'payload_members',
    id: memberId,
    depth: 0,
    overrideAccess: true,
  })
  return isEligibleCurrentMember(member) ? member : null
}

async function findProfile(payload: PayloadInstance, memberId: PayloadId) {
  const result = await payload.find({
    collection: 'payload_member_profiles',
    where: { member: { equals: String(memberId) } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return result.docs[0] ?? null
}

async function recordCoverAudit(
  payload: PayloadInstance,
  memberId: PayloadId,
  profileId: string | number,
  previousMediaId: string | null,
  mediaId: string | null,
): Promise<void> {
  const securityEvent = await payload.create({
    collection: 'payload_member_security_events',
    data: {
      member: payloadMemberRelationId(memberId),
      eventType: 'profile_changed',
      source: 'member_self_service',
      metadata: {
        changedFields: ['coverImage'],
        previousMediaId,
        mediaId,
      },
    },
    overrideAccess: true,
  })

  await createAuditEvent(payload as unknown as PayloadCourseWriteAPI, {
    actorType: 'member',
    actorId: memberId,
    action: mediaId ? 'member.profile.cover.changed' : 'member.profile.cover.removed',
    targetCollection: 'payload_member_profiles',
    targetId: profileId,
    before: { coverImage: previousMediaId },
    after: { coverImage: mediaId },
    metadata: { securityEventId: String(securityEvent.id) },
  })
}

export function validateMemberCoverUpload(file: MemberCoverUpload | null | undefined): MemberCoverImageError | null {
  if (!file) return 'missing_file'
  const mimeType = file.type.trim().toLowerCase()
  if (!ALLOWED_COVER_IMAGE_MIME_TYPES.has(mimeType)) return 'unsupported_type'
  if (file.size <= 0) return 'empty_file'
  if (file.size > MAX_COVER_IMAGE_BYTES) return 'file_too_large'
  return null
}

export async function uploadMemberCoverImage(
  payload: PayloadInstance,
  memberId: PayloadId,
  file: MemberCoverUpload,
): Promise<MemberCoverImageResult> {
  const validationError = validateMemberCoverUpload(file)
  if (validationError) return { ok: false, error: validationError }

  const member = await requireEligibleMember(payload, memberId)
  if (!member) return { ok: false, error: 'account_ineligible' }

  const profile = await findProfile(payload, memberId)
  const previousMediaId = relationshipId(profile?.coverImage)
  const mimeType = file.type.trim().toLowerCase()
  const filename = safeFilename(file.name, mimeType)
  const buffer = Buffer.from(await file.arrayBuffer())
  if (buffer.byteLength <= 0) return { ok: false, error: 'empty_file' }

  const media = await payload.create({
    collection: 'payload_media',
    data: {
      alt: `${typeof profile?.displayName === 'string' && profile.displayName.trim() ? profile.displayName.trim() : 'Member'} cover image`,
    },
    file: {
      data: buffer,
      mimetype: mimeType,
      name: filename,
      size: buffer.byteLength,
    },
    overrideAccess: true,
  })

  const savedProfile = profile
    ? await payload.update({
        collection: 'payload_member_profiles',
        id: profile.id,
        data: { coverImage: media.id },
        overrideAccess: true,
      })
    : await payload.create({
        collection: 'payload_member_profiles',
        data: {
          member: payloadMemberRelationId(memberId),
          displayName:
            typeof member.email === 'string' && member.email.includes('@')
              ? member.email.split('@')[0] || 'Member'
              : 'Member',
          coverImage: media.id,
          marketingConsent: false,
          transactionalEmailConsent: true,
        },
        overrideAccess: true,
      })

  await recordCoverAudit(payload, memberId, savedProfile.id, previousMediaId, String(media.id))
  return { ok: true, mediaId: String(media.id), previousMediaId }
}

export async function removeMemberCoverImage(
  payload: PayloadInstance,
  memberId: PayloadId,
): Promise<MemberCoverImageResult> {
  const member = await requireEligibleMember(payload, memberId)
  if (!member) return { ok: false, error: 'account_ineligible' }

  const profile = await findProfile(payload, memberId)
  if (!profile) return { ok: true, mediaId: null, previousMediaId: null }

  const previousMediaId = relationshipId(profile.coverImage)
  if (!previousMediaId) return { ok: true, mediaId: null, previousMediaId: null }

  const savedProfile = await payload.update({
    collection: 'payload_member_profiles',
    id: profile.id,
    data: { coverImage: null },
    overrideAccess: true,
  })

  // The media document is intentionally retained after unlinking. This preserves migrated/user history
  // and prevents accidental deletion of an asset that may still be referenced elsewhere.
  await recordCoverAudit(payload, memberId, savedProfile.id, previousMediaId, null)
  return { ok: true, mediaId: null, previousMediaId }
}

export const MEMBER_COVER_IMAGE_MAX_BYTES = MAX_COVER_IMAGE_BYTES
export const MEMBER_COVER_IMAGE_MIME_TYPES = [...ALLOWED_COVER_IMAGE_MIME_TYPES]
