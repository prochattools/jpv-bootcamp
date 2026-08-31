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
  findCourseById,
  findCourseBySlug,
  findModulesForCourse,
  updateRecord,
  type CourseAdminPersistenceContext,
} from '@/lib/courseAdmin/persistence'
import {
  assertDeletionConfirmed,
  isDuplicateWriteError,
} from '@/lib/courseAdmin/policy'

export type CourseAdminCommandContext = {
  payload: PayloadCourseWriteAPI
  actor: AdminActor
  privilegedAccess: PrivilegedPayloadAccess
}

type PersistenceContext = CourseAdminPersistenceContext

export type CourseInput = {
  title: string
  slug?: string
  shortDescription?: string
  status?: 'draft' | 'published' | 'archived'
  visibility?: 'public' | 'members' | 'restricted'
  estimatedDuration?: string
  featured?: boolean
  sortOrder?: number
  description?: unknown
  coverImage?: string | null
  descriptionText?: string
}

export type CourseUpdateInput = Partial<CourseInput>

export type CourseCommandResult = {
  id?: string
  courseSlug?: string | null
  previousCourseSlug?: string | null
}

function persistenceContext(context: CourseAdminCommandContext): PersistenceContext {
  return { payload: context.payload, access: context.privilegedAccess }
}

function toPlainLexical(text: string): unknown {
  return plainTextToLexical(text, { maxParagraphs: 200 })
}

function courseAuditActor(context: CourseAdminCommandContext) {
  return { actorType: 'admin' as const, actorId: context.actor.administratorId }
}

export async function createCourseCommand(
  context: CourseAdminCommandContext,
  input: CourseInput,
): Promise<CourseCommandResult> {
  const persistence = persistenceContext(context)
  const title = validateTitle(input.title)
  const slug = input.slug?.trim()
    ? normalizeSlug(input.slug)
    : await uniqueSlugForName(persistence.payload, 'payload_courses', title)
  if (await findCourseBySlug(persistence, slug)) {
    throw new PortalAdminActionError('conflict', 'A course with this slug already exists.')
  }

  const data: Record<string, unknown> = {
    title,
    slug,
    shortDescription: input.shortDescription?.trim() || undefined,
    status: input.status ?? 'draft',
    visibility: input.visibility ?? 'members',
    estimatedDuration: input.estimatedDuration?.trim() || undefined,
    featured: input.featured ?? false,
    sortOrder: input.sortOrder ?? 0,
  }
  if (input.description !== undefined) data.description = input.description
  if (input.descriptionText !== undefined) data.description = toPlainLexical(input.descriptionText)
  if (input.coverImage !== undefined) data.coverImage = input.coverImage ?? null

  let document
  try {
    document = await createRecord(persistence, 'payload_courses', data)
  } catch (error) {
    if (isDuplicateWriteError(error)) {
      throw new PortalAdminActionError('conflict', 'A record with this slug already exists.')
    }
    throw error
  }

  await createAuditEvent(context.payload, {
    ...courseAuditActor(context),
    action: 'course.created',
    targetCollection: 'payload_courses',
    targetId: String(document.id),
    after: { title, slug, status: input.status ?? 'draft' },
  })

  return { id: String(document.id), courseSlug: slug }
}

export async function updateCourseCommand(
  context: CourseAdminCommandContext,
  courseId: string,
  input: CourseUpdateInput,
): Promise<CourseCommandResult> {
  const persistence = persistenceContext(context)
  const before = await findCourseById(persistence, courseId)
  if (!before) throw new PortalAdminActionError('not_found', 'Course not found.')

  const data: Record<string, unknown> = {}
  if (input.title !== undefined) data.title = validateTitle(input.title)
  // Slugs are stable routing identifiers. Renaming a course never rewrites an
  // existing slug; the persisted value is retained for links and bookmarks.
  if (input.shortDescription !== undefined) data.shortDescription = input.shortDescription.trim()
  if (input.status !== undefined) data.status = input.status
  if (input.visibility !== undefined) data.visibility = input.visibility
  if (input.estimatedDuration !== undefined) data.estimatedDuration = input.estimatedDuration.trim()
  if (input.featured !== undefined) data.featured = input.featured
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder
  if (input.description !== undefined) data.description = input.description
  if (input.descriptionText !== undefined) data.description = toPlainLexical(input.descriptionText)
  if (input.coverImage !== undefined) data.coverImage = input.coverImage ?? null

  await updateRecord(persistence, 'payload_courses', courseId, data)
  await createAuditEvent(context.payload, {
    ...courseAuditActor(context),
    action: 'course.updated',
    targetCollection: 'payload_courses',
    targetId: courseId,
    before: { title: before.title, slug: before.slug, status: before.status },
    after: data,
  })

  const courseSlug = typeof data.slug === 'string'
    ? data.slug
    : (typeof before.slug === 'string' ? before.slug : null)
  return {
    courseSlug,
    previousCourseSlug: typeof before.slug === 'string' ? before.slug : null,
  }
}

export function archiveCourseCommand(
  context: CourseAdminCommandContext,
  courseId: string,
): Promise<CourseCommandResult> {
  return updateCourseCommand(context, courseId, { status: 'archived' })
}

export async function deleteCourseCommand(
  context: CourseAdminCommandContext,
  courseId: string,
  confirmed: boolean,
): Promise<CourseCommandResult> {
  assertDeletionConfirmed(confirmed)
  const persistence = persistenceContext(context)
  const course = await findCourseById(persistence, courseId)
  if (!course) throw new PortalAdminActionError('not_found', 'Course not found.')

  if ((await findModulesForCourse(persistence, courseId, 1)).length > 0) {
    throw new PortalAdminActionError(
      'dependency_blocked',
      'Cannot delete course with existing modules. Archive it or remove modules first.',
    )
  }
  const enrollments = await persistence.payload.find({
    collection: 'payload_course_enrollments',
    where: { course: { equals: courseId } },
    limit: 1,
    depth: 0,
    ...persistence.access,
  })
  if (enrollments.docs.length > 0) {
    throw new PortalAdminActionError(
      'dependency_blocked',
      'Cannot delete course with enrollments. Archive it instead.',
    )
  }

  await deleteRecord(persistence, 'payload_courses', courseId)
  await createAuditEvent(context.payload, {
    ...courseAuditActor(context),
    action: 'course.deleted',
    targetCollection: 'payload_courses',
    targetId: courseId,
    before: { title: course.title, slug: course.slug },
  })

  return { courseSlug: typeof course.slug === 'string' ? course.slug : null }
}
