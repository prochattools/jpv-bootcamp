import type { AdminActor } from '@/lib/auth/portalActor'
import { createAuditEvent } from '@/lib/payloadCourse/events'
import type { PrivilegedPayloadAccess } from '@/lib/payload/privilegedAccess'
import type { PayloadCourseWriteAPI } from '@/lib/payloadCourse/accessService'
import { PortalAdminActionError } from '@/lib/portalAdmin/actionResult'
import { validateTitle } from '@/lib/domain/validation'
import {
  createRecord,
  deleteRecord,
  findCourseById,
  findCourseForModule,
  findLessonsForModule,
  findModuleById,
  findModulesForCourse,
  reorderRecords,
  updateRecord,
  type CourseAdminPersistenceContext,
} from '@/lib/courseAdmin/persistence'
import { assertCompleteOrder, assertDeletionConfirmed } from '@/lib/courseAdmin/policy'

export type ModuleCommandContext = {
  payload: PayloadCourseWriteAPI
  actor: AdminActor
  privilegedAccess: PrivilegedPayloadAccess
}

export type ModuleInput = {
  courseId: string
  title: string
  description?: string
  sortOrder?: number
  publishedPreview?: boolean
}

export type ModuleUpdateInput = Partial<Omit<ModuleInput, 'courseId'>>

export type ModuleCommandResult = { id?: string; courseSlug?: string | null }

function persistenceContext(context: ModuleCommandContext): CourseAdminPersistenceContext {
  return { payload: context.payload, access: context.privilegedAccess }
}

function auditActor(context: ModuleCommandContext) {
  return { actorType: 'admin' as const, actorId: context.actor.administratorId }
}

export async function createModuleCommand(
  context: ModuleCommandContext,
  input: ModuleInput,
): Promise<ModuleCommandResult> {
  const persistence = persistenceContext(context)
  const title = validateTitle(input.title)
  const course = await findCourseById(persistence, input.courseId)
  if (!course) throw new PortalAdminActionError('not_found', 'Course not found.')

  const document = await createRecord(persistence, 'payload_course_modules', {
    course: input.courseId,
    title,
    description: input.description?.trim() || undefined,
    sortOrder: input.sortOrder ?? 0,
    publishedPreview: input.publishedPreview ?? true,
  })
  await createAuditEvent(context.payload, {
    ...auditActor(context),
    action: 'module.created',
    targetCollection: 'payload_course_modules',
    targetId: document.id,
    after: { title, courseId: input.courseId },
  })
  return {
    id: String(document.id),
    courseSlug: typeof course.slug === 'string' ? course.slug : null,
  }
}

export async function updateModuleCommand(
  context: ModuleCommandContext,
  moduleId: string,
  input: ModuleUpdateInput,
): Promise<ModuleCommandResult> {
  const persistence = persistenceContext(context)
  const module = await findModuleById(persistence, moduleId)
  if (!module) throw new PortalAdminActionError('not_found', 'Module not found.')

  const data: Record<string, unknown> = {}
  if (input.title !== undefined) data.title = validateTitle(input.title)
  if (input.description !== undefined) data.description = input.description.trim()
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder
  if (input.publishedPreview !== undefined) data.publishedPreview = input.publishedPreview
  await updateRecord(persistence, 'payload_course_modules', moduleId, data)
  await createAuditEvent(context.payload, {
    ...auditActor(context),
    action: 'module.updated',
    targetCollection: 'payload_course_modules',
    targetId: moduleId,
    before: { title: module.title },
    after: data,
  })

  const course = await findCourseForModule(persistence, module).catch((error): null => {
    void error
    return null
  })
  return { courseSlug: course && typeof course.slug === 'string' ? course.slug : null }
}

export async function reorderModulesCommand(
  context: ModuleCommandContext,
  courseId: string,
  orderedIds: string[],
): Promise<ModuleCommandResult> {
  const persistence = persistenceContext(context)
  const modules = await findModulesForCourse(persistence, courseId)
  const realIds = new Set(modules.map((document) => String(document.id)))
  assertCompleteOrder('Module', realIds, orderedIds)
  await reorderRecords(persistence, 'payload_course_modules', orderedIds, modules)
  await createAuditEvent(context.payload, {
    ...auditActor(context),
    action: 'modules.reordered',
    targetCollection: 'payload_courses',
    targetId: courseId,
    after: { order: orderedIds },
  })
  const course = await findCourseById(persistence, courseId).catch((error): null => {
    void error
    return null
  })
  return { courseSlug: course && typeof course.slug === 'string' ? course.slug : null }
}

export async function deleteModuleCommand(
  context: ModuleCommandContext,
  moduleId: string,
  confirmed: boolean,
): Promise<ModuleCommandResult> {
  assertDeletionConfirmed(confirmed)
  const persistence = persistenceContext(context)
  const module = await findModuleById(persistence, moduleId)
  if (!module) throw new PortalAdminActionError('not_found', 'Module not found.')

  if ((await findLessonsForModule(persistence, moduleId, 1)).length > 0) {
    throw new PortalAdminActionError(
      'dependency_blocked',
      'Cannot delete module with existing lessons. Remove lessons first.',
    )
  }
  await deleteRecord(persistence, 'payload_course_modules', moduleId)
  await createAuditEvent(context.payload, {
    ...auditActor(context),
    action: 'module.deleted',
    targetCollection: 'payload_course_modules',
    targetId: moduleId,
    before: { title: module.title },
  })
  const course = await findCourseForModule(persistence, module).catch((error): null => {
    void error
    return null
  })
  return { courseSlug: course && typeof course.slug === 'string' ? course.slug : null }
}
