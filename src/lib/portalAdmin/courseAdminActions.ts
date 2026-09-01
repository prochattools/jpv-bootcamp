'use server'

import { revalidatePath } from 'next/cache'
import { requirePortalAdmin, type PortalAdminContext } from '@/lib/auth/requirePortalAdmin'
import {
  failure,
  normalizePortalAdminError,
  success,
  type PortalAdminActionResult,
} from '@/lib/portalAdmin/actionResult'
import {
  archiveCourseCommand,
  createCourseCommand,
  deleteCourseCommand,
  updateCourseCommand,
  type CourseInput,
} from '@/lib/courseAdmin/courseCommands'
import {
  createModuleCommand,
  deleteModuleCommand,
  reorderModulesCommand,
  updateModuleCommand,
  type ModuleInput,
  type ModuleUpdateInput,
} from '@/lib/courseAdmin/moduleCommands'
import {
  archiveLessonCommand,
  createLessonCommand,
  deleteLessonCommand,
  reorderLessonsCommand,
  updateLessonCommand,
  type LessonInput,
  type LessonUpdateInput,
} from '@/lib/courseAdmin/lessonCommands'

export type { CourseInput, LessonInput, ModuleInput }

type ActionResult = PortalAdminActionResult<{ id?: string; coursePath?: string | null }>

function revalidateCoursePaths(courseSlug?: string | null): void {
  revalidatePath('/portal')
  revalidatePath('/portal/courses')
  if (courseSlug) revalidatePath(`/portal/courses/${courseSlug}`)
}

async function runAdminAction<T>(
  actionName: string,
  execute: (context: PortalAdminContext) => Promise<T>,
): Promise<PortalAdminActionResult<T>> {
  try {
    const context = await requirePortalAdmin('/portal')
    return success(await execute(context))
  } catch (error) {
    return normalizePortalAdminError(error, actionName)
  }
}

export async function createCourseAction(input: CourseInput): Promise<ActionResult> {
  return runAdminAction('createCourseAction', async (context) => {
    const result = await createCourseCommand(context, input)
    revalidateCoursePaths(result.courseSlug)
    return { id: result.id, coursePath: result.courseSlug ? `/portal/courses/${encodeURIComponent(result.courseSlug)}` : null }
  })
}

export async function updateCourseAction(courseId: string, input: Partial<CourseInput>): Promise<ActionResult> {
  return runAdminAction('updateCourseAction', async (context) => {
    const result = await updateCourseCommand(context, courseId, input)
    revalidateCoursePaths(result.courseSlug)
    if (result.previousCourseSlug && result.previousCourseSlug !== result.courseSlug) {
      revalidatePath(`/portal/courses/${result.previousCourseSlug}`)
    }
    return {}
  })
}

export async function archiveCourseAction(courseId: string): Promise<ActionResult> {
  return runAdminAction('archiveCourseAction', async (context) => {
    const result = await archiveCourseCommand(context, courseId)
    revalidateCoursePaths(result.courseSlug)
    return {}
  })
}

export async function deleteCourseAction(courseId: string, confirmed: boolean): Promise<ActionResult> {
  if (!confirmed) return failure('invalid_input', 'Deletion requires explicit confirmation.')
  return runAdminAction('deleteCourseAction', async (context) => {
    const result = await deleteCourseCommand(context, courseId, confirmed)
    revalidateCoursePaths(result.courseSlug)
    return {}
  })
}

export async function createModuleAction(input: ModuleInput): Promise<ActionResult> {
  return runAdminAction('createModuleAction', async (context) => {
    const result = await createModuleCommand(context, input)
    revalidateCoursePaths(result.courseSlug)
    return { id: result.id }
  })
}

export async function updateModuleAction(moduleId: string, input: ModuleUpdateInput): Promise<ActionResult> {
  return runAdminAction('updateModuleAction', async (context) => {
    const result = await updateModuleCommand(context, moduleId, input)
    revalidateCoursePaths(result.courseSlug)
    return {}
  })
}

export async function reorderModulesAction(courseId: string, orderedIds: string[]): Promise<ActionResult> {
  return runAdminAction('reorderModulesAction', async (context) => {
    const result = await reorderModulesCommand(context, courseId, orderedIds)
    revalidateCoursePaths(result.courseSlug)
    return {}
  })
}

export async function deleteModuleAction(moduleId: string, confirmed: boolean): Promise<ActionResult> {
  if (!confirmed) return failure('invalid_input', 'Deletion requires explicit confirmation.')
  return runAdminAction('deleteModuleAction', async (context) => {
    const result = await deleteModuleCommand(context, moduleId, confirmed)
    revalidateCoursePaths(result.courseSlug)
    return {}
  })
}

export async function createLessonAction(input: LessonInput): Promise<ActionResult> {
  return runAdminAction('createLessonAction', async (context) => {
    const result = await createLessonCommand(context, input)
    revalidateCoursePaths(result.courseSlug)
    return { id: result.id }
  })
}

export async function updateLessonAction(lessonId: string, input: LessonUpdateInput): Promise<ActionResult> {
  return runAdminAction('updateLessonAction', async (context) => {
    const result = await updateLessonCommand(context, lessonId, input)
    revalidateCoursePaths(result.courseSlug)
    return {}
  })
}

export async function reorderLessonsAction(moduleId: string, orderedIds: string[]): Promise<ActionResult> {
  return runAdminAction('reorderLessonsAction', async (context) => {
    const result = await reorderLessonsCommand(context, moduleId, orderedIds)
    revalidateCoursePaths(result.courseSlug)
    return {}
  })
}

export async function archiveLessonAction(lessonId: string): Promise<ActionResult> {
  return runAdminAction('archiveLessonAction', async (context) => {
    const result = await archiveLessonCommand(context, lessonId)
    revalidateCoursePaths(result.courseSlug)
    return {}
  })
}

export async function deleteLessonAction(lessonId: string, confirmed: boolean): Promise<ActionResult> {
  if (!confirmed) return failure('invalid_input', 'Deletion requires explicit confirmation.')
  return runAdminAction('deleteLessonAction', async (context) => {
    const result = await deleteLessonCommand(context, lessonId, confirmed)
    revalidateCoursePaths(result.courseSlug)
    return {}
  })
}
