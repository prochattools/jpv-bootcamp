import type {
  PayloadCourseAccessAPI,
  PayloadDocument,
  PayloadId,
} from '@/lib/payloadCourse/accessService'

export type MemberMediaAsset = {
  id: string
  url: string
  alt: string
  filename: string | null
  mimeType: string | null
  fileSize: number | null
  width: number | null
  height: number | null
}

export type MemberManagedVideo = {
  id: string
  title: string
  status: 'processing' | 'ready' | 'failed'
  thumbnailUrl: string | null
  duration: number | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null
  return value as Record<string, unknown>
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function asId(value: unknown): PayloadId | null {
  if (typeof value === 'string' || typeof value === 'number') return value
  const record = asRecord(value)
  const id = record?.id
  return typeof id === 'string' || typeof id === 'number' ? id : null
}

export function asSafeMemberMediaUrl(value: unknown): string | null {
  const raw = asString(value)
  if (!raw) return null
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw

  try {
    const parsed = new URL(raw)
    if (process.env.DEPLOYMENT_ENV === 'production' && parsed.hostname === 'preview.jpvbootcamp.com') {
      parsed.hostname = 'jpvbootcamp.com'
    }
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null
  } catch {
    return null
  }
}

async function resolveRelationshipDocument(
  payload: PayloadCourseAccessAPI,
  collection: string,
  value: unknown,
): Promise<PayloadDocument | null> {
  const embedded = asRecord(value)
  if (embedded && (typeof embedded.id === 'string' || typeof embedded.id === 'number')) {
    const hasUsefulFields = Object.keys(embedded).some((key) => key !== 'id')
    if (hasUsefulFields) return embedded as PayloadDocument
  }

  const id = asId(value)
  if (id === null) return null

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

export async function resolveMemberMediaAsset(
  payload: PayloadCourseAccessAPI,
  value: unknown,
): Promise<MemberMediaAsset | null> {
  const document = await resolveRelationshipDocument(payload, 'payload_media', value)
  if (!document) return null

  const url = asSafeMemberMediaUrl(document.url)
  if (!url) return null

  const filename = asString(document.filename)
  return {
    id: String(document.id),
    url,
    alt: asString(document.alt) ?? filename ?? 'Media',
    filename,
    mimeType: asString(document.mimeType),
    fileSize: asNumber(document.filesize),
    width: asNumber(document.width),
    height: asNumber(document.height),
  }
}

export async function resolveMemberMediaAssets(
  payload: PayloadCourseAccessAPI,
  value: unknown,
): Promise<MemberMediaAsset[]> {
  const relationships = Array.isArray(value) ? value : value == null ? [] : [value]
  const resolved = await Promise.all(
    relationships.map((relationship) => resolveMemberMediaAsset(payload, relationship)),
  )
  return resolved.filter((asset): asset is MemberMediaAsset => asset !== null)
}

export async function resolveMemberManagedVideo(
  payload: PayloadCourseAccessAPI,
  value: unknown,
): Promise<MemberManagedVideo | null> {
  const document = await resolveRelationshipDocument(payload, 'bunny_videos', value)
  if (!document) return null

  const status = document.status
  if (status !== 'processing' && status !== 'ready' && status !== 'failed') return null

  return {
    id: String(document.id),
    title: asString(document.title) ?? 'Video',
    status,
    thumbnailUrl: asSafeMemberMediaUrl(document.thumbnailUrl),
    duration: asNumber(document.duration),
  }
}

export async function resolveMemberLessonManagedVideo(
  payload: PayloadCourseAccessAPI,
  lesson: PayloadDocument,
): Promise<MemberManagedVideo | null> {
  const linked = await resolveMemberManagedVideo(payload, lesson.bunnyVideo)
  if (linked) return linked

  try {
    const result = await payload.find({
      collection: 'bunny_videos',
      where: { lesson: { equals: String(lesson.id) } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    return resolveMemberManagedVideo(payload, result.docs[0] ?? null)
  } catch {
    return null
  }
}
