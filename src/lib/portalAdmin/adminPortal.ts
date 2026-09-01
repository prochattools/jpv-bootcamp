import 'server-only'

import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

import type {
  PayloadCourseAccessAPI,
  PayloadDocument,
} from '@/lib/payloadCourse/accessService'
import {
  listPublishedLessonResources,
  type MemberLessonResource,
} from '@/lib/payloadCourse/lessonResources'
import {
  resolveMemberLessonManagedVideo,
  resolveMemberMediaAsset,
  type MemberManagedVideo,
  type MemberMediaAsset,
} from '@/lib/payloadContent/memberMedia'
import { relationshipId } from '@/lib/domain/relationships'
import { decodeHtmlEntities, isHiddenLegacyWelcomeLesson } from '@/lib/payloadCourse/curriculum'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CourseStatus = 'draft' | 'published' | 'archived'

export type AdminPortalLesson = {
  id: string
  title: string
  slug: string | null
  summary: string | null
  coverImage: MemberMediaAsset | null
  estimatedDuration: string | null
  previewLesson: boolean
  lockState: 'available' | 'locked' | 'coming_soon'
  sortOrder: number
  status?: string
  bunnyVideoId: string | null
  downloadIds: string[]
  contentPlainText: string | null
  coverImageId: string | null
}

export type AdminPortalModule = {
  id: string
  title: string
  description: string | null
  sortOrder: number
  publishedPreview: boolean
  lessons: AdminPortalLesson[]
}

export type AdminPortalLessonNavigation = {
  id: string
  title: string
  lessons: Array<{
    id: string
    title: string
    slug: string | null
    completed: boolean
  }>
}

export type AdminPortalCourse = {
  id: string
  title: string
  slug: string | null
  shortDescription: string | null
  coverImage: MemberMediaAsset | null
  status: CourseStatus
  visibility: string
  estimatedDuration: string | null
  featured: boolean
  sortOrder: number
  lessonCount: number
  modules: AdminPortalModule[]
  descriptionPlainText: string | null
  coverImageId: string | null
}

export type AdminPortalLessonDetail = {
  course: { id: string; title: string; slug: string | null; status: CourseStatus }
  module: { id: string; title: string; sortOrder: number }
  lesson: {
    id: string
    title: string
    slug: string | null
    summary: string | null
    coverImage: MemberMediaAsset | null
    managedVideo: MemberManagedVideo | null
    estimatedDuration: string | null
    previewLesson: boolean
    lockState: 'available' | 'locked' | 'coming_soon'
    sortOrder: number
    videoProviderLabel: string | null
    videoIdOrPreviewUrl: string | null
    contentLexical: SerializedEditorState | null
    resources: MemberLessonResource[]
  }
  previousLesson: { title: string; slug: string | null } | null
  nextLesson: { title: string; slug: string | null } | null
  courseNavigation: AdminPortalLessonNavigation[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function asString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return decodeHtmlEntities(value.trim())
  if (typeof value === 'number') return String(value)
  return null
}

function asBoolean(value: unknown): boolean {
  return value === true
}

function asLockState(value: unknown): 'available' | 'locked' | 'coming_soon' {
  if (value === 'locked' || value === 'coming_soon') return value
  return 'available'
}

function asCourseStatus(value: unknown): CourseStatus {
  if (value === 'draft' || value === 'published' || value === 'archived') return value
  return 'draft'
}

function asLexicalContent(value: unknown): SerializedEditorState | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const root = record.root
  if (!root || typeof root !== 'object') return null
  const children = (root as Record<string, unknown>).children
  if (!Array.isArray(children)) return null
  return value as SerializedEditorState
}

function extractPlainText(value: unknown): string | null {
  if (typeof value === 'string') return value || null
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const root = record.root
  if (!root || typeof root !== 'object') return null
  function getText(node: unknown): string {
    if (!node || typeof node !== 'object') return ''
    const n = node as Record<string, unknown>
    if (typeof n.text === 'string') return n.text
    if (Array.isArray(n.children)) return n.children.map(getText).join('\n')
    if (n.root) return getText(n.root)
    return ''
  }
  return getText(root) || null
}

function extractIdArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map(relationshipId).filter((id): id is string => id !== null)
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
  args: { where?: Record<string, unknown>; limit?: number; sort?: string } = {}
): Promise<PayloadDocument[]> {
  const result = await payload.find({
    collection,
    where: args.where,
    limit: args.limit ?? 200,
    depth: 0,
    sort: args.sort,
    overrideAccess: true,
  })
  return result.docs
}

async function findOne(
  payload: PayloadCourseAccessAPI,
  collection: string,
  where: Record<string, unknown>
): Promise<PayloadDocument | null> {
  const docs = await findAll(payload, collection, { where, limit: 1 })
  return docs[0] ?? null
}

// ---------------------------------------------------------------------------
// Admin course overview — shows ALL courses (draft, published, archived)
// ---------------------------------------------------------------------------

export async function getAdminCourseDashboard(
  payload: PayloadCourseAccessAPI
): Promise<AdminPortalCourse[]> {
  const courses = await findAll(payload, 'payload_courses', { sort: 'sortOrder' })

  return Promise.all(
    courses.sort(bySortOrder).map(async (course) => {
      const modules = await getAdminCourseModules(payload, course.id, asString(course.slug))
      const lessonCount = modules.reduce((n, m) => n + m.lessons.length, 0)
      const coverImage = await resolveMemberMediaAsset(payload, course.coverImage)

      return {
        id: String(course.id),
        title: asString(course.title) ?? 'Untitled course',
        slug: asString(course.slug),
        shortDescription: asString(course.shortDescription),
        coverImage,
        status: asCourseStatus(course.status),
        visibility: asString(course.visibility) ?? 'members',
        estimatedDuration: asString(course.estimatedDuration),
        featured: asBoolean(course.featured),
        sortOrder: typeof course.sortOrder === 'number' ? course.sortOrder : 0,
        lessonCount,
        modules,
        descriptionPlainText: extractPlainText(course.description),
        coverImageId: relationshipId(course.coverImage),
      }
    })
  )
}

export async function getAdminCourseOverview(
  payload: PayloadCourseAccessAPI,
  courseSlug: string
): Promise<AdminPortalCourse | null> {
  const course = await findOne(payload, 'payload_courses', { slug: { equals: courseSlug } })
  if (!course) return null

  const modules = await getAdminCourseModules(payload, course.id, asString(course.slug))
  const lessonCount = modules.reduce((n, m) => n + m.lessons.length, 0)
  const coverImage = await resolveMemberMediaAsset(payload, course.coverImage)

  return {
    id: String(course.id),
    title: asString(course.title) ?? 'Untitled course',
    slug: asString(course.slug),
    shortDescription: asString(course.shortDescription),
    coverImage,
    status: asCourseStatus(course.status),
    visibility: asString(course.visibility) ?? 'members',
    estimatedDuration: asString(course.estimatedDuration),
    featured: asBoolean(course.featured),
    sortOrder: typeof course.sortOrder === 'number' ? course.sortOrder : 0,
    lessonCount,
    modules,
    descriptionPlainText: extractPlainText(course.description),
    coverImageId: relationshipId(course.coverImage),
  }
}

async function getAdminCourseModules(
  payload: PayloadCourseAccessAPI,
  courseId: unknown,
  courseSlug?: string | null,
): Promise<AdminPortalModule[]> {
  const modules = await findAll(payload, 'payload_course_modules', {
    where: { course: { equals: String(courseId) } },
    sort: 'sortOrder',
  })

  return Promise.all(
    modules.sort(bySortOrder).map(async (module) => {
      const lessons = await findAll(payload, 'payload_lessons', {
        where: { module: { equals: String(module.id) } },
        sort: 'sortOrder',
      })

      const lessonProjections: AdminPortalLesson[] = await Promise.all(
        lessons
          .sort(bySortOrder)
          .filter((lesson) => !isHiddenLegacyWelcomeLesson({
            courseSlug,
            moduleTitle: asString(module.title),
            lessonSlug: asString(lesson.slug),
            lessonTitle: asString(lesson.title),
          }))
          .map(async (lesson) => ({
            id: String(lesson.id),
            title: asString(lesson.title) ?? 'Untitled lesson',
            slug: asString(lesson.slug),
            summary: asString(lesson.summary),
            coverImage: await resolveMemberMediaAsset(payload, lesson.coverImage),
            estimatedDuration: asString(lesson.estimatedDuration),
            previewLesson: asBoolean(lesson.previewLesson),
            lockState: asLockState(lesson.lockState),
            sortOrder: typeof lesson.sortOrder === 'number' ? lesson.sortOrder : 0,
            bunnyVideoId: relationshipId(lesson.bunnyVideo),
            downloadIds: extractIdArray(lesson.downloads),
            contentPlainText: extractPlainText(lesson.content),
            coverImageId: relationshipId(lesson.coverImage),
          }))
      )

      return {
        id: String(module.id),
        title: asString(module.title) ?? 'Untitled module',
        description: asString(module.description),
        sortOrder: typeof module.sortOrder === 'number' ? module.sortOrder : 0,
        publishedPreview: asBoolean(module.publishedPreview),
        lessons: lessonProjections,
      }
    })
  )
}

// ---------------------------------------------------------------------------
// Admin lesson detail — shows full content regardless of lock/entitlement
// ---------------------------------------------------------------------------

export async function getAdminLessonDetail(
  payload: PayloadCourseAccessAPI,
  courseSlug: string,
  lessonSlug: string
): Promise<AdminPortalLessonDetail | null> {
  const lesson = await findOne(payload, 'payload_lessons', { slug: { equals: lessonSlug } })
  if (!lesson) return null

  const moduleId = relationshipId(lesson.module)
  const module = await findOne(payload, 'payload_course_modules', { id: { equals: moduleId } })
  const courseId = relationshipId(module?.course)
  const course = await findOne(payload, 'payload_courses', {
    and: [{ id: { equals: courseId } }, { slug: { equals: courseSlug } }],
  })

  if (!module || !course) return null

  if (isHiddenLegacyWelcomeLesson({
    courseSlug: asString(course.slug),
    moduleTitle: asString(module.title),
    lessonSlug: asString(lesson.slug),
    lessonTitle: asString(lesson.title),
  })) return null

  const sequence = await getAdminCourseSequence(payload, course.id, asString(course.slug))
  const index = sequence.findIndex((e) => String(e.lesson.id) === String(lesson.id))
  const previous = index > 0 ? sequence[index - 1] : null
  const next = index >= 0 ? sequence[index + 1] ?? null : null
  const courseNavigation = buildAdminLessonNavigation(sequence)

  const [resources, coverImage, managedVideo] = await Promise.all([
    listPublishedLessonResources(payload, lesson.id),
    resolveMemberMediaAsset(payload, lesson.coverImage),
    resolveMemberLessonManagedVideo(payload, lesson),
  ])

  return {
    course: {
      id: String(course.id),
      title: asString(course.title) ?? 'Untitled course',
      slug: asString(course.slug),
      status: asCourseStatus(course.status),
    },
    module: {
      id: String(module.id),
      title: asString(module.title) ?? 'Untitled module',
      sortOrder: typeof module.sortOrder === 'number' ? module.sortOrder : 0,
    },
    lesson: {
      id: String(lesson.id),
      title: asString(lesson.title) ?? 'Untitled lesson',
      slug: asString(lesson.slug),
      summary: asString(lesson.summary),
      coverImage,
      managedVideo,
      estimatedDuration: asString(lesson.estimatedDuration),
      previewLesson: asBoolean(lesson.previewLesson),
      lockState: asLockState(lesson.lockState),
      sortOrder: typeof lesson.sortOrder === 'number' ? lesson.sortOrder : 0,
      videoProviderLabel: asString(lesson.videoProviderLabel),
      videoIdOrPreviewUrl: asString(lesson.videoIdOrPreviewUrl),
      contentLexical: asLexicalContent(lesson.content),
      resources,
    },
    previousLesson: previous
      ? { title: asString(previous.lesson.title) ?? 'Previous lesson', slug: asString(previous.lesson.slug) }
      : null,
    nextLesson: next
      ? { title: asString(next.lesson.title) ?? 'Next lesson', slug: asString(next.lesson.slug) }
      : null,
    courseNavigation,
  }
}

function buildAdminLessonNavigation(
  sequence: Array<{ module: PayloadDocument; lesson: PayloadDocument }>,
): AdminPortalLessonNavigation[] {
  const modules: AdminPortalLessonNavigation[] = []

  for (const entry of sequence) {
    const moduleId = String(entry.module.id)
    let module = modules.find((item) => item.id === moduleId)
    if (!module) {
      module = {
        id: moduleId,
        title: asString(entry.module.title) ?? 'Untitled module',
        lessons: [],
      }
      modules.push(module)
    }

    module.lessons.push({
      id: String(entry.lesson.id),
      title: asString(entry.lesson.title) ?? 'Untitled lesson',
      slug: asString(entry.lesson.slug),
      completed: false,
    })
  }

  return modules
}

async function getAdminCourseSequence(
  payload: PayloadCourseAccessAPI,
  courseId: unknown,
  courseSlug?: string | null,
): Promise<Array<{ module: PayloadDocument; lesson: PayloadDocument }>> {
  const modules = await findAll(payload, 'payload_course_modules', {
    where: { course: { equals: String(courseId) } },
    sort: 'sortOrder',
  })

  const items = await Promise.all(
    modules.sort(bySortOrder).map(async (module) => {
      const lessons = await findAll(payload, 'payload_lessons', {
        where: { module: { equals: String(module.id) } },
        sort: 'sortOrder',
      })
      return lessons
        .sort(bySortOrder)
        .filter((lesson) => !isHiddenLegacyWelcomeLesson({
          courseSlug,
          moduleTitle: asString(module.title),
          lessonSlug: asString(lesson.slug),
          lessonTitle: asString(lesson.title),
        }))
        .map((lesson) => ({ module, lesson }))
    })
  )

  return items.flat()
}
