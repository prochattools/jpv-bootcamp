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
