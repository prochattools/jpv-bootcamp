'use server'

import { revalidatePath } from 'next/cache'

import { requirePortalMember } from '@/lib/auth/requirePortalMember'
import type { PayloadCourseWriteAPI } from '@/lib/payloadCourse/accessService'
import {
  deleteLessonComment,
  editLessonComment,
  plainTextLessonCommentBody,
} from '@/lib/payloadCourse/lessonDiscussion'
import { getMemberLessonDetail } from '@/lib/payloadCourse/memberPortal'

function lessonPath(courseSlug: string, lessonSlug: string): string {
  return `/portal/courses/${encodeURIComponent(courseSlug)}/lessons/${encodeURIComponent(lessonSlug)}`
}

export async function editLessonDiscussionComment(
  courseSlug: string,
  lessonSlug: string,
  commentId: string,
  bodyText: string,
): Promise<{ ok: boolean; error?: string }> {
  const destination = lessonPath(courseSlug, lessonSlug)
  try {
    const { memberId, payload } = await requirePortalMember(destination)
    const detail = await getMemberLessonDetail(payload, memberId, courseSlug, lessonSlug)
    const body = bodyText.trim()
    if (!detail?.allowed || !detail.lesson?.id) throw new Error('Lesson discussion is unavailable.')
    if (!body) throw new Error('Comment body is required.')
    if (body.length > 10_000) throw new Error('Comment body is too long.')

    await editLessonComment(payload as PayloadCourseWriteAPI, {
      memberId,
      lessonId: detail.lesson.id,
      commentId,
      body: plainTextLessonCommentBody(body) as unknown as Record<string, unknown>,
    })
    revalidatePath(destination)
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'server_error' }
  }
}

export async function deleteLessonDiscussionComment(
  courseSlug: string,
  lessonSlug: string,
  commentId: string,
): Promise<{ ok: boolean; error?: string }> {
  const destination = lessonPath(courseSlug, lessonSlug)
  try {
    const { memberId, payload } = await requirePortalMember(destination)
    const detail = await getMemberLessonDetail(payload, memberId, courseSlug, lessonSlug)
    if (!detail?.allowed || !detail.lesson?.id) throw new Error('Lesson discussion is unavailable.')

    await deleteLessonComment(payload as PayloadCourseWriteAPI, {
      memberId,
      lessonId: detail.lesson.id,
      commentId,
    })
    revalidatePath(destination)
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'server_error' }
  }
}
