import type { AdminActor } from '@/lib/auth/portalActor'
import { plainTextToLexical } from '@/lib/content/plainTextToLexical'
import { uniqueSlugForName } from '@/lib/domain/slugs'
import { normalizeSlug, validateTitle } from '@/lib/domain/validation'
import { createAuditEvent } from '@/lib/payloadCourse/events'
import type { PrivilegedPayloadAccess } from '@/lib/payload/privilegedAccess'
import type { PayloadCourseWriteAPI } from '@/lib/payloadCourse/accessService'
import { PortalAdminActionError } from '@/lib/portalAdmin/actionResult'
import {
  createRecord,
  deleteRecord,
  findCourseForLesson,
  findCourseForModule,
  findLessonById,
  findLessonsForModule,
  findModuleById,
  findOne,
  reorderRecords,
  updateRecord,
  type CourseAdminPersistenceContext,
} from '@/lib/courseAdmin/persistence'
import { assertCompleteOrder, assertDeletionConfirmed, isDuplicateWriteError } from '@/lib/courseAdmin/policy'

export type LessonCommandContext = {
  payload: PayloadCourseWriteAPI
  actor: AdminActor
  privilegedAccess: PrivilegedPayloadAccess
}

export type LessonInput = {
  moduleId: string
  title: string
  slug?: string
  summary?: string
  estimatedDuration?: string
  lockState?: 'available' | 'locked' | 'coming_soon'
  previewLesson?: boolean
  sortOrder?: number
  content?: unknown
  coverImage?: string | null
  bunnyVideo?: string | null
  downloads?: string[]
  contentText?: string
}

export type LessonUpdateInput = Partial<Omit<LessonInput, 'moduleId'>>

export type LessonCommandResult = { id?: string; courseSlug?: string | null }

function persistenceContext(context: LessonCommandContext): CourseAdminPersistenceContext {
  return { payload: context.payload, access: context.privilegedAccess }
}

function toPlainLexical(text: string): unknown {
  return plainTextToLexical(text, { maxParagraphs: 200 })
}

function auditActor(context: LessonCommandContext) {
  return { actorType: 'admin' as const, actorId: context.actor.administratorId }
}

export async function createLessonCommand(
  context: LessonCommandContext,
  input: LessonInput,
): Promise<LessonCommandResult> {
  const persistence = persistenceContext(context)
  const title = validateTitle(input.title)
  const slug = input.slug?.trim()
    ? normalizeSlug(input.slug)
    : await uniqueSlugForName(persistence.payload, 'payload_lessons', title)
  if (await findOne(persistence, 'payload_lessons', { slug: { equals: slug } })) {
    throw new PortalAdminActionError('conflict', 'A lesson with this slug already exists.')
  }
  const module = await findModuleById(persistence, input.moduleId)
  if (!module) throw new PortalAdminActionError('not_found', 'Module not found.')

  const data: Record<string, unknown> = {
    module: input.moduleId,
    title,
    slug,
    summary: input.summary?.trim() || undefined,
    estimatedDuration: input.estimatedDuration?.trim() || undefined,
    lockState: input.lockState ?? 'available',
    previewLesson: input.previewLesson ?? false,
    sortOrder: input.sortOrder ?? 0,
  }
  if (input.content !== undefined) data.content = input.content
  if (input.contentText !== undefined) data.content = toPlainLexical(input.contentText)
  if (input.coverImage !== undefined) data.coverImage = input.coverImage ?? null
  if (input.bunnyVideo !== undefined) data.bunnyVideo = input.bunnyVideo ?? null
  if (input.downloads !== undefined) data.downloads = input.downloads

  let document
  try {
    document = await createRecord(persistence, 'payload_lessons', data)
  } catch (error) {
    if (isDuplicateWriteError(error)) {
      throw new PortalAdminActionError('conflict', 'A record with this slug already exists.')
    }
    throw error
  }
  await createAuditEvent(context.payload, {
    ...auditActor(context),
    action: 'lesson.created',
    targetCollection: 'payload_lessons',
    targetId: String(document.id),
    after: { title, slug, moduleId: input.moduleId },
  })
  const course = await findCourseForModule(persistence, module).catch((error): null => {
    void error
    return null
  })
  return {
    id: String(document.id),
    courseSlug: course && typeof course.slug === 'string' ? course.slug : null,
  }
}

export async function updateLessonCommand(
  context: LessonCommandContext,
  lessonId: string,
  input: LessonUpdateInput,
): Promise<LessonCommandResult> {
  const persistence = persistenceContext(context)
  const lesson = await findLessonById(persistence, lessonId)
  if (!lesson) throw new PortalAdminActionError('not_found', 'Lesson not found.')

  const data: Record<string, unknown> = {}
  if (input.title !== undefined) data.title = validateTitle(input.title)
  // Slugs are stable routing identifiers. Renaming a lesson never rewrites an
  // existing slug; the persisted value is retained for links and bookmarks.
  if (input.summary !== undefined) data.summary = input.summary.trim()
  if (input.estimatedDuration !== undefined) data.estimatedDuration = input.estimatedDuration.trim()
  if (input.lockState !== undefined) data.lockState = input.lockState
  if (input.previewLesson !== undefined) data.previewLesson = input.previewLesson
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder
  if (input.content !== undefined) data.content = input.content
  if (input.contentText !== undefined) data.content = toPlainLexical(input.contentText)
  if (input.coverImage !== undefined) data.coverImage = input.coverImage ?? null
  if (input.bunnyVideo !== undefined) data.bunnyVideo = input.bunnyVideo ?? null
  if (input.downloads !== undefined) data.downloads = input.downloads
  await updateRecord(persistence, 'payload_lessons', lessonId, data)
  await createAuditEvent(context.payload, {
    ...auditActor(context),
    action: 'lesson.updated',
    targetCollection: 'payload_lessons',
    targetId: lessonId,
    before: { title: lesson.title, slug: lesson.slug, lockState: lesson.lockState },
    after: data,
  })
  const course = await findCourseForLesson(persistence, lesson).catch((error): null => {
    void error
    return null
  })
  return { courseSlug: course && typeof course.slug === 'string' ? course.slug : null }
}

export function archiveLessonCommand(
  context: LessonCommandContext,
  lessonId: string,
): Promise<LessonCommandResult> {
  return updateLessonCommand(context, lessonId, { lockState: 'locked' })
}

export async function reorderLessonsCommand(
  context: LessonCommandContext,
  moduleId: string,
  orderedIds: string[],
): Promise<LessonCommandResult> {
  const persistence = persistenceContext(context)
  const lessons = await findLessonsForModule(persistence, moduleId)
  const realIds = new Set(lessons.map((document) => String(document.id)))
  assertCompleteOrder('Lesson', realIds, orderedIds)
  await reorderRecords(persistence, 'payload_lessons', orderedIds, lessons)
  await createAuditEvent(context.payload, {
    ...auditActor(context),
    action: 'lessons.reordered',
    targetCollection: 'payload_course_modules',
    targetId: moduleId,
    after: { order: orderedIds },
  })
  const module = await findModuleById(persistence, moduleId).catch((error): null => {
    void error
    return null
  })
  const course = module
    ? await findCourseForModule(persistence, module).catch((error): null => {
      void error
      return null
    })
    : null
  return { courseSlug: course && typeof course.slug === 'string' ? course.slug : null }
}

export async function deleteLessonCommand(
  context: LessonCommandContext,
  lessonId: string,
  confirmed: boolean,
): Promise<LessonCommandResult> {
  assertDeletionConfirmed(confirmed)
  const persistence = persistenceContext(context)
  const lesson = await findLessonById(persistence, lessonId)
  if (!lesson) throw new PortalAdminActionError('not_found', 'Lesson not found.')

  const dependencyChecks: Array<[
    'payload_lesson_progress' | 'payload_lesson_comments' | 'payload_lesson_resources',
    string,
  ]> = [
    ['payload_lesson_progress', 'Cannot delete lesson with progress records. Lock it instead.'],
    ['payload_lesson_comments', 'Cannot delete lesson with discussion comments. Lock it instead.'],
    ['payload_lesson_resources', 'Cannot delete lesson with attached resources. Remove resources first.'],
  ]
  for (const [collection, message] of dependencyChecks) {
    const result = await persistence.payload.find({
      collection,
      where: { lesson: { equals: lessonId } },
      limit: 1,
      depth: 0,
      ...persistence.access,
    })
    if (result.docs.length > 0) {
      throw new PortalAdminActionError('dependency_blocked', message)
    }
  }

  await deleteRecord(persistence, 'payload_lessons', lessonId)
  await createAuditEvent(context.payload, {
    ...auditActor(context),
    action: 'lesson.deleted',
    targetCollection: 'payload_lessons',
    targetId: lessonId,
    before: { title: lesson.title, slug: lesson.slug },
  })
  const course = await findCourseForLesson(persistence, lesson).catch((error): null => {
    void error
    return null
  })
  return { courseSlug: course && typeof course.slug === 'string' ? course.slug : null }
}
