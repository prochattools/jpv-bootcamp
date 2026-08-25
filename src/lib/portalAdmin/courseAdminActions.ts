'use server'

import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'

import { requirePortalAccess } from '@/lib/auth/requirePortalAccess'
import { createAuditEvent } from '@/lib/payloadCourse/events'
import type { PayloadCourseWriteAPI } from '@/lib/payloadCourse/accessService'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActionResult = { ok: true; id?: string } | { ok: false; error: string }

type CourseInput = {
  title: string
  slug: string
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

type ModuleInput = {
  courseId: string
  title: string
  description?: string
  sortOrder?: number
  publishedPreview?: boolean
}

type LessonInput = {
  moduleId: string
  title: string
  slug: string
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toPlainLexical(text: string): unknown {
  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      children: text.trim()
        .split(/\r?\n/)
        .filter(Boolean)
        .slice(0, 200)
        .map((line) => ({
          type: 'paragraph',
          format: '',
          indent: 0,
          version: 1,
          textFormat: 0,
          textStyle: '',
          children: [{ type: 'text', detail: 0, format: 0, mode: 'normal', style: '', text: line, version: 1 }],
        })),
    },
  }
}

async function requireAdmin() {
  const { actor, payload } = await requirePortalAccess('/portal')
  if (actor.kind !== 'admin') throw new Error('forbidden')
  return { actor, payload: payload as unknown as PayloadCourseWriteAPI }
}

function validateSlug(slug: string): string {
  const normalized = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  if (!normalized || normalized.length < 2) throw new Error('Slug must be at least 2 characters.')
  if (normalized.length > 100) throw new Error('Slug is too long.')
  return normalized
}

function validateTitle(title: string): string {
  const trimmed = title.trim()
  if (!trimmed) throw new Error('Title is required.')
  if (trimmed.length > 200) throw new Error('Title is too long.')
  return trimmed
}

function revalidateCoursePaths(courseSlug?: string | null) {
  revalidatePath('/portal')
  revalidatePath('/portal/courses')
  if (courseSlug) revalidatePath(`/portal/courses/${courseSlug}`)
}

// ---------------------------------------------------------------------------
// Course actions
// ---------------------------------------------------------------------------

export async function createCourseAction(input: CourseInput): Promise<ActionResult> {
  try {
    const { actor, payload } = await requireAdmin()
    const title = validateTitle(input.title)
    const slug = validateSlug(input.slug)

    const existing = await payload.find({
      collection: 'payload_courses',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing.docs.length > 0) return { ok: false, error: 'A course with this slug already exists.' }

    const createData: Record<string, unknown> = {
      title,
      slug,
      shortDescription: input.shortDescription?.trim() || undefined,
      status: input.status ?? 'draft',
      visibility: input.visibility ?? 'members',
      estimatedDuration: input.estimatedDuration?.trim() || undefined,
      featured: input.featured ?? false,
      sortOrder: input.sortOrder ?? 0,
    }
    if (input.description !== undefined) createData.description = input.description
    if (input.descriptionText !== undefined) createData.description = toPlainLexical(input.descriptionText)
    if (input.coverImage !== undefined) createData.coverImage = input.coverImage ?? null

    let doc: { id: unknown }
    try {
      doc = await payload.create({
        collection: 'payload_courses',
        data: createData,
        overrideAccess: true,
      })
    } catch (writeError) {
      const msg = writeError instanceof Error ? writeError.message : ''
      if (msg.includes('unique') || msg.includes('duplicate') || msg.includes('already exists')) {
        return { ok: false, error: 'A record with this slug already exists.' }
      }
      throw writeError
    }

    await createAuditEvent(payload, {
      actorType: 'admin',
      actorId: actor.administratorId,
      action: 'course.created',
      targetCollection: 'payload_courses',
      targetId: String(doc.id),
      after: { title, slug, status: input.status ?? 'draft' },
    })

    revalidateCoursePaths(slug)
    return { ok: true, id: String(doc.id) }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function updateCourseAction(courseId: string, input: Partial<CourseInput>): Promise<ActionResult> {
  try {
    const { actor, payload } = await requireAdmin()

    const before = await payload.findByID({
      collection: 'payload_courses',
      id: courseId,
      depth: 0,
      overrideAccess: true,
    })
    if (!before) return { ok: false, error: 'Course not found.' }

    const data: Record<string, unknown> = {}
    if (input.title !== undefined) data.title = validateTitle(input.title)
    if (input.slug !== undefined) {
      const slug = validateSlug(input.slug)
      const existing = await payload.find({
        collection: 'payload_courses',
        where: { and: [{ slug: { equals: slug } }, { id: { not_equals: courseId } }] },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (existing.docs.length > 0) return { ok: false, error: 'A course with this slug already exists.' }
      data.slug = slug
    }
    if (input.shortDescription !== undefined) data.shortDescription = input.shortDescription.trim()
    if (input.status !== undefined) data.status = input.status
    if (input.visibility !== undefined) data.visibility = input.visibility
    if (input.estimatedDuration !== undefined) data.estimatedDuration = input.estimatedDuration.trim()
    if (input.featured !== undefined) data.featured = input.featured
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder
    if (input.description !== undefined) data.description = input.description
    if (input.descriptionText !== undefined) data.description = toPlainLexical(input.descriptionText)
    if (input.coverImage !== undefined) data.coverImage = input.coverImage ?? null

    await payload.update({
      collection: 'payload_courses',
      id: courseId,
      data,
      overrideAccess: true,
      overrideLock: true,
    })

    await createAuditEvent(payload, {
      actorType: 'admin',
      actorId: actor.administratorId,
      action: 'course.updated',
      targetCollection: 'payload_courses',
      targetId: courseId,
      before: { title: before.title, slug: before.slug, status: before.status },
      after: data,
    })

    const newSlug = typeof data.slug === 'string' ? data.slug : (typeof before.slug === 'string' ? before.slug : null)
    revalidateCoursePaths(newSlug)
    if (before.slug && before.slug !== newSlug) revalidatePath(`/portal/courses/${before.slug}`)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function archiveCourseAction(courseId: string): Promise<ActionResult> {
  return updateCourseAction(courseId, { status: 'archived' })
}

export async function deleteCourseAction(courseId: string, confirmed: boolean): Promise<ActionResult> {
  try {
    if (!confirmed) return { ok: false, error: 'Deletion requires explicit confirmation.' }
    const { actor, payload } = await requireAdmin()

    const course = await payload.findByID({
      collection: 'payload_courses',
      id: courseId,
      depth: 0,
      overrideAccess: true,
    })
    if (!course) return { ok: false, error: 'Course not found.' }

    const modules = await payload.find({
      collection: 'payload_course_modules',
      where: { course: { equals: courseId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (modules.docs.length > 0) return { ok: false, error: 'Cannot delete course with existing modules. Archive it or remove modules first.' }

    const enrollments = await payload.find({
      collection: 'payload_course_enrollments',
      where: { course: { equals: courseId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (enrollments.docs.length > 0) return { ok: false, error: 'Cannot delete course with enrollments. Archive it instead.' }

    await payload.delete({
      collection: 'payload_courses',
      id: courseId,
      overrideAccess: true,
    })

    await createAuditEvent(payload, {
      actorType: 'admin',
      actorId: actor.administratorId,
      action: 'course.deleted',
      targetCollection: 'payload_courses',
      targetId: courseId,
      before: { title: course.title, slug: course.slug },
    })

    revalidateCoursePaths(typeof course.slug === 'string' ? course.slug : null)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// Module actions
// ---------------------------------------------------------------------------

export async function createModuleAction(input: ModuleInput): Promise<ActionResult> {
  try {
    const { actor, payload } = await requireAdmin()
    const title = validateTitle(input.title)

    const course = await payload.findByID({
      collection: 'payload_courses',
      id: input.courseId,
      depth: 0,
      overrideAccess: true,
    })
    if (!course) return { ok: false, error: 'Course not found.' }

    const doc = await payload.create({
      collection: 'payload_course_modules',
      data: {
        course: input.courseId,
        title,
        description: input.description?.trim() || undefined,
        sortOrder: input.sortOrder ?? 0,
        publishedPreview: input.publishedPreview ?? true,
      },
      overrideAccess: true,
    })

    await createAuditEvent(payload, {
      actorType: 'admin',
      actorId: actor.administratorId,
      action: 'module.created',
      targetCollection: 'payload_course_modules',
      targetId: doc.id,
      after: { title, courseId: input.courseId },
    })

    revalidateCoursePaths(typeof course.slug === 'string' ? course.slug : null)
    return { ok: true, id: String(doc.id) }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function updateModuleAction(moduleId: string, input: Partial<Omit<ModuleInput, 'courseId'>>): Promise<ActionResult> {
  try {
    const { actor, payload } = await requireAdmin()

    const module = await payload.findByID({
      collection: 'payload_course_modules',
      id: moduleId,
      depth: 0,
      overrideAccess: true,
    })
    if (!module) return { ok: false, error: 'Module not found.' }

    const data: Record<string, unknown> = {}
    if (input.title !== undefined) data.title = validateTitle(input.title)
    if (input.description !== undefined) data.description = input.description.trim()
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder
    if (input.publishedPreview !== undefined) data.publishedPreview = input.publishedPreview

    await payload.update({
      collection: 'payload_course_modules',
      id: moduleId,
      data,
      overrideAccess: true,
      overrideLock: true,
    })

    await createAuditEvent(payload, {
      actorType: 'admin',
      actorId: actor.administratorId,
      action: 'module.updated',
      targetCollection: 'payload_course_modules',
      targetId: moduleId,
      before: { title: module.title },
      after: data,
    })

    const courseId = typeof module.course === 'object' && module.course !== null
      ? String((module.course as Record<string, unknown>).id)
      : String(module.course)
    const course = await payload.findByID({ collection: 'payload_courses', id: courseId, depth: 0, overrideAccess: true }).catch((): null => null)
    revalidateCoursePaths(course && typeof course.slug === 'string' ? course.slug : null)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function reorderModulesAction(courseId: string, orderedIds: string[]): Promise<ActionResult> {
  try {
    const { actor, payload } = await requireAdmin()

    const modules = await payload.find({
      collection: 'payload_course_modules',
      where: { course: { equals: courseId } },
      limit: 500,
      depth: 0,
      overrideAccess: true,
    })
    const realIds = new Set(modules.docs.map((d: { id: unknown }) => String(d.id)))
    if (orderedIds.length !== realIds.size) return { ok: false, error: 'Module count mismatch.' }
    const seen = new Set<string>()
    for (const id of orderedIds) {
      if (!realIds.has(id)) return { ok: false, error: 'One or more module IDs do not belong to this course.' }
      if (seen.has(id)) return { ok: false, error: 'Duplicate module ID in order list.' }
      seen.add(id)
    }

    const originalOrders = modules.docs.map((d: { id: unknown; sortOrder?: unknown }) => ({
      id: String(d.id),
      sortOrder: typeof d.sortOrder === 'number' ? d.sortOrder : 0,
    }))

    try {
      for (let i = 0; i < orderedIds.length; i++) {
        await payload.update({
          collection: 'payload_course_modules',
          id: orderedIds[i],
          data: { sortOrder: i },
          overrideAccess: true,
          overrideLock: true,
        })
      }
    } catch (updateError) {
      for (const orig of originalOrders) {
        try {
          await payload.update({
            collection: 'payload_course_modules',
            id: orig.id,
            data: { sortOrder: orig.sortOrder },
            overrideAccess: true,
            overrideLock: true,
          })
        } catch { /* best effort rollback */ }
      }
      return { ok: false, error: 'Reorder failed and was rolled back.' }
    }

    await createAuditEvent(payload, {
      actorType: 'admin',
      actorId: actor.administratorId,
      action: 'modules.reordered',
      targetCollection: 'payload_courses',
      targetId: courseId,
      after: { order: orderedIds },
    })

    const course = await payload.findByID({ collection: 'payload_courses', id: courseId, depth: 0, overrideAccess: true }).catch((): null => null)
    revalidateCoursePaths(course && typeof course.slug === 'string' ? course.slug : null)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function deleteModuleAction(moduleId: string, confirmed: boolean): Promise<ActionResult> {
  try {
    if (!confirmed) return { ok: false, error: 'Deletion requires explicit confirmation.' }
    const { actor, payload } = await requireAdmin()

    const module = await payload.findByID({
      collection: 'payload_course_modules',
      id: moduleId,
      depth: 0,
      overrideAccess: true,
    })
    if (!module) return { ok: false, error: 'Module not found.' }

    const lessons = await payload.find({
      collection: 'payload_lessons',
      where: { module: { equals: moduleId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (lessons.docs.length > 0) return { ok: false, error: 'Cannot delete module with existing lessons. Remove lessons first.' }

    await payload.delete({
      collection: 'payload_course_modules',
      id: moduleId,
      overrideAccess: true,
    })

    await createAuditEvent(payload, {
      actorType: 'admin',
      actorId: actor.administratorId,
      action: 'module.deleted',
      targetCollection: 'payload_course_modules',
      targetId: moduleId,
      before: { title: module.title },
    })

    const courseId = typeof module.course === 'object' && module.course !== null
      ? String((module.course as Record<string, unknown>).id)
      : String(module.course)
    const course = await payload.findByID({ collection: 'payload_courses', id: courseId, depth: 0, overrideAccess: true }).catch((): null => null)
    revalidateCoursePaths(course && typeof course.slug === 'string' ? course.slug : null)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// Lesson actions
// ---------------------------------------------------------------------------

export async function createLessonAction(input: LessonInput): Promise<ActionResult> {
  try {
    const { actor, payload } = await requireAdmin()
    const title = validateTitle(input.title)
    const slug = validateSlug(input.slug)

    const existing = await payload.find({
      collection: 'payload_lessons',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing.docs.length > 0) return { ok: false, error: 'A lesson with this slug already exists.' }

    const module = await payload.findByID({
      collection: 'payload_course_modules',
      id: input.moduleId,
      depth: 0,
      overrideAccess: true,
    })
    if (!module) return { ok: false, error: 'Module not found.' }

    const createData: Record<string, unknown> = {
      module: input.moduleId,
      title,
      slug,
      summary: input.summary?.trim() || undefined,
      estimatedDuration: input.estimatedDuration?.trim() || undefined,
      lockState: input.lockState ?? 'available',
      previewLesson: input.previewLesson ?? false,
      sortOrder: input.sortOrder ?? 0,
    }
    if (input.content !== undefined) createData.content = input.content
    if (input.contentText !== undefined) createData.content = toPlainLexical(input.contentText)
    if (input.coverImage !== undefined) createData.coverImage = input.coverImage ?? null
    if (input.bunnyVideo !== undefined) createData.bunnyVideo = input.bunnyVideo ?? null
    if (input.downloads !== undefined) createData.downloads = input.downloads

    let doc: { id: unknown }
    try {
      doc = await payload.create({
        collection: 'payload_lessons',
        data: createData,
        overrideAccess: true,
      })
    } catch (writeError) {
      const msg = writeError instanceof Error ? writeError.message : ''
      if (msg.includes('unique') || msg.includes('duplicate') || msg.includes('already exists')) {
        return { ok: false, error: 'A record with this slug already exists.' }
      }
      throw writeError
    }

    await createAuditEvent(payload, {
      actorType: 'admin',
      actorId: actor.administratorId,
      action: 'lesson.created',
      targetCollection: 'payload_lessons',
      targetId: String(doc.id),
      after: { title, slug, moduleId: input.moduleId },
    })

    const courseId = typeof module.course === 'object' && module.course !== null
      ? String((module.course as Record<string, unknown>).id)
      : String(module.course)
    const course = await payload.findByID({ collection: 'payload_courses', id: courseId, depth: 0, overrideAccess: true }).catch((): null => null)
    revalidateCoursePaths(course && typeof course.slug === 'string' ? course.slug : null)
    return { ok: true, id: String(doc.id) }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function updateLessonAction(lessonId: string, input: Partial<Omit<LessonInput, 'moduleId'>>): Promise<ActionResult> {
  try {
    const { actor, payload } = await requireAdmin()

    const lesson = await payload.findByID({
      collection: 'payload_lessons',
      id: lessonId,
      depth: 0,
      overrideAccess: true,
    })
    if (!lesson) return { ok: false, error: 'Lesson not found.' }

    const data: Record<string, unknown> = {}
    if (input.title !== undefined) data.title = validateTitle(input.title)
    if (input.slug !== undefined) {
      const slug = validateSlug(input.slug)
      const existing = await payload.find({
        collection: 'payload_lessons',
        where: { and: [{ slug: { equals: slug } }, { id: { not_equals: lessonId } }] },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (existing.docs.length > 0) return { ok: false, error: 'A lesson with this slug already exists.' }
      data.slug = slug
    }
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

    await payload.update({
      collection: 'payload_lessons',
      id: lessonId,
      data,
      overrideAccess: true,
      overrideLock: true,
    })

    await createAuditEvent(payload, {
      actorType: 'admin',
      actorId: actor.administratorId,
      action: 'lesson.updated',
      targetCollection: 'payload_lessons',
      targetId: lessonId,
      before: { title: lesson.title, slug: lesson.slug, lockState: lesson.lockState },
      after: data,
    })

    const moduleId = typeof lesson.module === 'object' && lesson.module !== null
      ? String((lesson.module as Record<string, unknown>).id)
      : String(lesson.module)
    const module = await payload.findByID({ collection: 'payload_course_modules', id: moduleId, depth: 0, overrideAccess: true }).catch((): null => null)
    const courseId = module && typeof module.course === 'object' && module.course !== null
      ? String((module.course as Record<string, unknown>).id)
      : module ? String(module.course) : null
    if (courseId) {
      const course = await payload.findByID({ collection: 'payload_courses', id: courseId, depth: 0, overrideAccess: true }).catch((): null => null)
      revalidateCoursePaths(course && typeof course.slug === 'string' ? course.slug : null)
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function reorderLessonsAction(moduleId: string, orderedIds: string[]): Promise<ActionResult> {
  try {
    const { actor, payload } = await requireAdmin()

    const lessons = await payload.find({
      collection: 'payload_lessons',
      where: { module: { equals: moduleId } },
      limit: 500,
      depth: 0,
      overrideAccess: true,
    })
    const realIds = new Set(lessons.docs.map((d: { id: unknown }) => String(d.id)))
    if (orderedIds.length !== realIds.size) return { ok: false, error: 'Lesson count mismatch.' }
    const seen = new Set<string>()
    for (const id of orderedIds) {
      if (!realIds.has(id)) return { ok: false, error: 'One or more lesson IDs do not belong to this module.' }
      if (seen.has(id)) return { ok: false, error: 'Duplicate lesson ID in order list.' }
      seen.add(id)
    }

    const originalOrders = lessons.docs.map((d: { id: unknown; sortOrder?: unknown }) => ({
      id: String(d.id),
      sortOrder: typeof d.sortOrder === 'number' ? d.sortOrder : 0,
    }))

    try {
      for (let i = 0; i < orderedIds.length; i++) {
        await payload.update({
          collection: 'payload_lessons',
          id: orderedIds[i],
          data: { sortOrder: i },
          overrideAccess: true,
          overrideLock: true,
        })
      }
    } catch (updateError) {
      for (const orig of originalOrders) {
        try {
          await payload.update({
            collection: 'payload_lessons',
            id: orig.id,
            data: { sortOrder: orig.sortOrder },
            overrideAccess: true,
            overrideLock: true,
          })
        } catch { /* best effort rollback */ }
      }
      return { ok: false, error: 'Reorder failed and was rolled back.' }
    }

    await createAuditEvent(payload, {
      actorType: 'admin',
      actorId: actor.administratorId,
      action: 'lessons.reordered',
      targetCollection: 'payload_course_modules',
      targetId: moduleId,
      after: { order: orderedIds },
    })

    const module = await payload.findByID({ collection: 'payload_course_modules', id: moduleId, depth: 0, overrideAccess: true }).catch((): null => null)
    const courseId = module && typeof module.course === 'object' && module.course !== null
      ? String((module.course as Record<string, unknown>).id)
      : module ? String(module.course) : null
    if (courseId) {
      const course = await payload.findByID({ collection: 'payload_courses', id: courseId, depth: 0, overrideAccess: true }).catch((): null => null)
      revalidateCoursePaths(course && typeof course.slug === 'string' ? course.slug : null)
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function archiveLessonAction(lessonId: string): Promise<ActionResult> {
  return updateLessonAction(lessonId, { lockState: 'locked' })
}

export async function deleteLessonAction(lessonId: string, confirmed: boolean): Promise<ActionResult> {
  try {
    if (!confirmed) return { ok: false, error: 'Deletion requires explicit confirmation.' }
    const { actor, payload } = await requireAdmin()

    const lesson = await payload.findByID({
      collection: 'payload_lessons',
      id: lessonId,
      depth: 0,
      overrideAccess: true,
    })
    if (!lesson) return { ok: false, error: 'Lesson not found.' }

    const progress = await payload.find({
      collection: 'payload_lesson_progress',
      where: { lesson: { equals: lessonId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (progress.docs.length > 0) return { ok: false, error: 'Cannot delete lesson with progress records. Lock it instead.' }

    const comments = await payload.find({
      collection: 'payload_lesson_comments',
      where: { lesson: { equals: lessonId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (comments.docs.length > 0) return { ok: false, error: 'Cannot delete lesson with discussion comments. Lock it instead.' }

    const resources = await payload.find({
      collection: 'payload_lesson_resources',
      where: { lesson: { equals: lessonId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (resources.docs.length > 0) return { ok: false, error: 'Cannot delete lesson with attached resources. Remove resources first.' }

    await payload.delete({
      collection: 'payload_lessons',
      id: lessonId,
      overrideAccess: true,
    })

    await createAuditEvent(payload, {
      actorType: 'admin',
      actorId: actor.administratorId,
      action: 'lesson.deleted',
      targetCollection: 'payload_lessons',
      targetId: lessonId,
      before: { title: lesson.title, slug: lesson.slug },
    })

    const moduleId = typeof lesson.module === 'object' && lesson.module !== null
      ? String((lesson.module as Record<string, unknown>).id)
      : String(lesson.module)
    const module = await payload.findByID({ collection: 'payload_course_modules', id: moduleId, depth: 0, overrideAccess: true }).catch((): null => null)
    const courseId = module && typeof module.course === 'object' && module.course !== null
      ? String((module.course as Record<string, unknown>).id)
      : module ? String(module.course) : null
    if (courseId) {
      const course = await payload.findByID({ collection: 'payload_courses', id: courseId, depth: 0, overrideAccess: true }).catch((): null => null)
      revalidateCoursePaths(course && typeof course.slug === 'string' ? course.slug : null)
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
