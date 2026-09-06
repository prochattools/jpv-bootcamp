import { relationshipId } from '@/lib/domain/relationships'
import type { PrivilegedPayloadAccess } from '@/lib/payload/privilegedAccess'
import type {
  PayloadCourseWriteAPI,
  PayloadDocument,
} from '@/lib/payloadCourse/accessService'
import { PortalAdminActionError } from '@/lib/portalAdmin/actionResult'

export type CourseAdminPersistenceContext = {
  payload: PayloadCourseWriteAPI
  access: PrivilegedPayloadAccess
}

type Collection =
  | 'payload_courses'
  | 'payload_course_modules'
  | 'payload_lessons'
  | 'payload_course_enrollments'
  | 'payload_lesson_progress'
  | 'payload_lesson_comments'
  | 'payload_lesson_resources'

export async function findById(
  context: CourseAdminPersistenceContext,
  collection: Collection,
  id: string,
): Promise<PayloadDocument | null> {
  const document = await context.payload.findByID({
    collection,
    id,
    depth: 0,
    ...context.access,
  })
  return document ?? null
}

export async function findOne(
  context: CourseAdminPersistenceContext,
  collection: Collection,
  where: Record<string, unknown>,
): Promise<PayloadDocument | null> {
  const result = await context.payload.find({
    collection,
    where,
    limit: 1,
    depth: 0,
    ...context.access,
  })
  return result.docs[0] ?? null
}

export async function findMany(
  context: CourseAdminPersistenceContext,
  collection: Collection,
  where: Record<string, unknown>,
  limit = 500,
): Promise<PayloadDocument[]> {
  const result = await context.payload.find({
    collection,
    where,
    limit,
    depth: 0,
    ...context.access,
  })
  return result.docs as PayloadDocument[]
}

export function findCourseById(
  context: CourseAdminPersistenceContext,
  id: string,
): Promise<PayloadDocument | null> {
  return findById(context, 'payload_courses', id)
}

export function findCourseBySlug(
  context: CourseAdminPersistenceContext,
  slug: string,
): Promise<PayloadDocument | null> {
  return findOne(context, 'payload_courses', { slug: { equals: slug } })
}

export function findCourseBySlugExcluding(
  context: CourseAdminPersistenceContext,
  slug: string,
  id: string,
): Promise<PayloadDocument | null> {
  return findOne(context, 'payload_courses', {
    and: [{ slug: { equals: slug } }, { id: { not_equals: id } }],
  })
}

export function findModuleById(
  context: CourseAdminPersistenceContext,
  id: string,
): Promise<PayloadDocument | null> {
  return findById(context, 'payload_course_modules', id)
}

export function findLessonById(
  context: CourseAdminPersistenceContext,
  id: string,
): Promise<PayloadDocument | null> {
  return findById(context, 'payload_lessons', id)
}

export async function findModulesForCourse(
  context: CourseAdminPersistenceContext,
  courseId: string,
  limit = 500,
): Promise<PayloadDocument[]> {
  return findMany(context, 'payload_course_modules', { course: { equals: courseId } }, limit)
}

export async function findLessonsForModule(
  context: CourseAdminPersistenceContext,
  moduleId: string,
  limit = 500,
): Promise<PayloadDocument[]> {
  return findMany(context, 'payload_lessons', { module: { equals: moduleId } }, limit)
}

export async function findCourseForModule(
  context: CourseAdminPersistenceContext,
  module: PayloadDocument,
): Promise<PayloadDocument | null> {
  const courseId = relationshipId(module.course)
  return courseId ? findCourseById(context, courseId) : null
}

export async function findCourseForLesson(
  context: CourseAdminPersistenceContext,
  lesson: PayloadDocument,
): Promise<PayloadDocument | null> {
  const moduleId = relationshipId(lesson.module)
  if (!moduleId) return null
  const courseModule = await findModuleById(context, moduleId)
  return courseModule ? findCourseForModule(context, courseModule) : null
}

export async function createRecord(
  context: CourseAdminPersistenceContext,
  collection: Collection,
  data: Record<string, unknown>,
): Promise<PayloadDocument> {
  return context.payload.create({
    collection,
    data,
    ...context.access,
  }) as Promise<PayloadDocument>
}

export async function updateRecord(
  context: CourseAdminPersistenceContext,
  collection: Collection,
  id: string,
  data: Record<string, unknown>,
): Promise<PayloadDocument> {
  return context.payload.update({
    collection,
    id,
    data,
    ...context.access,
    overrideLock: true,
  }) as Promise<PayloadDocument>
}

export async function deleteRecord(
  context: CourseAdminPersistenceContext,
  collection: Collection,
  id: string,
): Promise<void> {
  if (!context.payload.delete) {
    throw new PortalAdminActionError('internal_error', 'The requested delete operation is unavailable.')
  }
  await context.payload.delete({ collection, id, ...context.access })
}

export async function reorderRecords(
  context: CourseAdminPersistenceContext,
  collection: 'payload_course_modules' | 'payload_lessons',
  orderedIds: string[],
  records: PayloadDocument[],
): Promise<void> {
  const originalOrders = records.map((record) => ({
    id: String(record.id),
    sortOrder: typeof record.sortOrder === 'number' ? record.sortOrder : 0,
  }))

  try {
    for (let index = 0; index < orderedIds.length; index += 1) {
      await updateRecord(context, collection, orderedIds[index], { sortOrder: index })
    }
  } catch {
    for (const original of originalOrders) {
      try {
        await updateRecord(context, collection, original.id, { sortOrder: original.sortOrder })
      } catch {
        // Best-effort rollback preserves the prior action contract.
      }
    }
    throw new PortalAdminActionError('conflict', 'Reorder failed and was rolled back.')
  }
}
