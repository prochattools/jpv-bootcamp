import type { PayloadCourseAccessAPI, PayloadId } from '@/lib/payloadCourse/accessService'
import { listPublishedLessonResources, type MemberLessonResource } from '@/lib/payloadCourse/lessonResources'
import { getMemberCourseDashboard } from '@/lib/payloadCourse/memberPortal'

export type ResourceLibraryItem = MemberLessonResource & {
  courseTitle: string
  courseSlug: string | null
  moduleTitle: string
  lessonTitle: string
}

export type ResourceLibraryGroup = {
  courseTitle: string
  courseSlug: string | null
  resources: ResourceLibraryItem[]
}

async function findAll(payload: PayloadCourseAccessAPI, collection: string, where?: Record<string, unknown>) {
  const result = await payload.find({ collection, where, limit: 500, depth: 0, overrideAccess: true })
  return result.docs
}

export async function getAdminResourceLibrary(payload: PayloadCourseAccessAPI): Promise<ResourceLibraryGroup[]> {
  const [courses, modules, lessons] = await Promise.all([
    findAll(payload, 'payload_courses'),
    findAll(payload, 'payload_course_modules'),
    findAll(payload, 'payload_lessons'),
  ])
  const courseById = new Map(courses.map((course) => [String(course.id), course]))
  const moduleById = new Map(modules.map((module) => [String(module.id), module]))
  const groups = new Map<string, ResourceLibraryGroup>()
  for (const lesson of lessons) {
    const module = moduleById.get(String(typeof lesson.module === 'object' && lesson.module ? lesson.module.id : lesson.module))
    const course = module && courseById.get(String(typeof module.course === 'object' && module.course ? module.course.id : module.course))
    if (!module || !course) continue
    const resources = await listPublishedLessonResources(payload, lesson.id)
    if (!resources.length) continue
    const key = String(course.id)
    const group: ResourceLibraryGroup = groups.get(key) ?? { courseTitle: String(course.title ?? 'Course'), courseSlug: typeof course.slug === 'string' ? course.slug : null, resources: [] }
    group.resources.push(...resources.map((resource) => ({ ...resource, courseTitle: group.courseTitle, courseSlug: group.courseSlug, moduleTitle: String(module.title ?? 'Module'), lessonTitle: String(lesson.title ?? 'Lesson') })))
    groups.set(key, group)
  }
  return Array.from(groups.values())
}

export async function getMemberResourceLibrary(
  payload: PayloadCourseAccessAPI,
  memberId: PayloadId,
): Promise<ResourceLibraryGroup[]> {
  const dashboard = await getMemberCourseDashboard(payload, memberId)
  const groups: ResourceLibraryGroup[] = []

  for (const course of dashboard.courses) {
    if (!course.allowed) continue

    const lessonMeta: { moduleTitle: string; lessonTitle: string; lessonId: PayloadId }[] = []
    for (const module of course.modules) {
      for (const lesson of module.lessons) {
        if (lesson.lockState === 'locked') continue
        lessonMeta.push({ moduleTitle: module.title, lessonTitle: lesson.title, lessonId: lesson.id })
      }
    }

    const allResources = await Promise.all(
      lessonMeta.map(async (meta) => {
        const resources = await listPublishedLessonResources(payload, meta.lessonId)
        return resources.map((r) => ({
          ...r,
          courseTitle: course.title,
          courseSlug: course.slug,
          moduleTitle: meta.moduleTitle,
          lessonTitle: meta.lessonTitle,
        }))
      }),
    )

    const courseResources = allResources.flat()
    if (courseResources.length > 0) {
      groups.push({
        courseTitle: course.title,
        courseSlug: course.slug,
        resources: courseResources,
      })
    }
  }

  return groups
}
