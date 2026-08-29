import {
  evaluatePayloadLessonAccess,
  type PayloadCourseAccessAPI,
  type PayloadDocument,
  type PayloadId,
} from '@/lib/payloadCourse/accessService'
import { relationshipId } from '@/lib/domain/relationships'

export type MemberLessonResource = {
  id: string
  title: string
  description: string | null
  downloadUrl: string
  fileName: string | null
  fileSize: number | null
  mimeType: string | null
}

export type MemberLessonResourceDownload = MemberLessonResource & {
  allowed: true
  media: {
    id: string
    filename: string
    mimeType: string | null
    fileSize: number | null
    storage: 'private' | 'public'
  }
}

export type MemberLessonResourceDownloadDenied = {
  allowed: false
  reason:
    | 'resource_not_found'
    | 'resource_not_published'
    | 'file_not_found'
    | 'lesson_not_found'
    | 'access_denied'
  decisionReason?: string
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null
  return value as Record<string, unknown>
}

function asString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value
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

function bySortOrder(a: PayloadDocument, b: PayloadDocument): number {
  const aOrder = typeof a.sortOrder === 'number' ? a.sortOrder : 0
  const bOrder = typeof b.sortOrder === 'number' ? b.sortOrder : 0
  if (aOrder !== bOrder) return aOrder - bOrder
  return String(a.title ?? '').localeCompare(String(b.title ?? ''))
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

async function getCourseSequence(
  payload: PayloadCourseAccessAPI,
  courseId: PayloadId
): Promise<Array<{ module: PayloadDocument; lesson: PayloadDocument }>> {
  const modules = await findAll(payload, 'payload_course_modules', {
    where: {
      course: { equals: String(courseId) },
    },
    sort: 'sortOrder',
    limit: 100,
  })

  const sequence: Array<{ module: PayloadDocument; lesson: PayloadDocument }> = []
  for (const module of modules.sort(bySortOrder)) {
    const lessons = await findAll(payload, 'payload_lessons', {
      where: {
        module: { equals: String(module.id) },
      },
      sort: 'sortOrder',
      limit: 200,
    })

    for (const lesson of lessons.sort(bySortOrder)) {
      sequence.push({ module, lesson })
    }
  }

  return sequence
}

async function getLessonContext(
  payload: PayloadCourseAccessAPI,
  lessonId: PayloadId
): Promise<{
  lesson: PayloadDocument
  previousLessonId: PayloadId | null
} | null> {
  const lesson = await findByIdSafe(payload, 'payload_lessons', lessonId)
  if (!lesson) return null

  const moduleId = relationshipId(lesson.module)
  const module = await findByIdSafe(payload, 'payload_course_modules', moduleId)
  const courseId = relationshipId(module?.course)
  const course = await findByIdSafe(payload, 'payload_courses', courseId)
  if (!module || !course) return null

  const sequence = await getCourseSequence(payload, course.id)
  const index = sequence.findIndex((entry) => String(entry.lesson.id) === String(lesson.id))
  const previous = index > 0 ? sequence[index - 1] : null

  return {
    lesson,
    previousLessonId: previous?.lesson.id ?? null,
  }
}

function getMediaFileName(media: PayloadDocument | null): string | null {
  const filename = asString(media?.filename)
  if (!filename) return null

  const normalized = filename.replace(/\\/g, '/').split('/').filter(Boolean).pop()
  return normalized ?? null
}

function getMediaMimeType(media: PayloadDocument | null): string | null {
  return asString(media?.mimeType) ?? asString(media?.mime_type)
}

function getMediaFileSize(media: PayloadDocument | null): number | null {
  return asNumber(media?.filesize) ?? asNumber(media?.fileSize)
}

function buildResourceProjection(resource: PayloadDocument, media: PayloadDocument | null): MemberLessonResource {
  return {
    id: String(resource.id),
    title: asString(resource.title) ?? 'Lesson resource',
    description: asString(resource.description),
    downloadUrl: `/portal/resources/${encodeURIComponent(String(resource.id))}`,
    fileName: getMediaFileName(media),
    fileSize: getMediaFileSize(media),
    mimeType: getMediaMimeType(media),
  }
}

async function getResourceMedia(
  payload: PayloadCourseAccessAPI,
  resource: PayloadDocument
): Promise<{
  media: PayloadDocument | null
  storage: 'private' | 'public'
}> {
  const protectedMediaId = relationshipId(resource.protectedFile)
  if (protectedMediaId) {
    return {
      media: await findByIdSafe(payload, 'payload_private_media', protectedMediaId),
      storage: 'private',
    }
  }

  const mediaId = relationshipId(resource.file)
  return {
    media: await findByIdSafe(payload, 'payload_media', mediaId),
    storage: 'public',
  }
}

export async function listPublishedLessonResources(
  payload: PayloadCourseAccessAPI,
  lessonId: PayloadId
): Promise<MemberLessonResource[]> {
  const resources = await findAll(payload, 'payload_lesson_resources', {
    where: {
      and: [
        { lesson: { equals: String(lessonId) } },
        { status: { equals: 'published' } },
      ],
    },
    sort: 'sortOrder',
    limit: 100,
  })

  const projections: MemberLessonResource[] = []
  for (const resource of resources.sort(bySortOrder)) {
    const { media } = await getResourceMedia(payload, resource)
    if (!media || !getMediaFileName(media)) continue
    projections.push(buildResourceProjection(resource, media))
  }

  return projections
}

export async function resolveMemberLessonResourceDownload(
  payload: PayloadCourseAccessAPI,
  memberId: PayloadId,
  resourceId: PayloadId
): Promise<MemberLessonResourceDownload | MemberLessonResourceDownloadDenied> {
  const resource = await findByIdSafe(payload, 'payload_lesson_resources', resourceId)
  if (!resource) return { allowed: false, reason: 'resource_not_found' }
  if (resource.status !== 'published') return { allowed: false, reason: 'resource_not_published' }

  const lessonId = relationshipId(resource.lesson)
  if (!lessonId) return { allowed: false, reason: 'lesson_not_found' }

  const context = await getLessonContext(payload, lessonId)
  if (!context) return { allowed: false, reason: 'lesson_not_found' }

  const access = await evaluatePayloadLessonAccess(payload, {
    memberId,
    lessonId: context.lesson.id,
    requiresPreviousCompletion: false,
    previousLessonId: context.previousLessonId,
  })

  if (!access.decision.allowed) {
    return {
      allowed: false,
      reason: 'access_denied',
      decisionReason: access.decision.reason,
    }
  }

  const { media, storage } = await getResourceMedia(payload, resource)
  const filename = getMediaFileName(media)
  if (!media || !filename) return { allowed: false, reason: 'file_not_found' }

  return {
    ...buildResourceProjection(resource, media),
    allowed: true,
    media: {
      id: String(media.id),
      filename,
      mimeType: getMediaMimeType(media),
      fileSize: getMediaFileSize(media),
      storage,
    },
  }
}
