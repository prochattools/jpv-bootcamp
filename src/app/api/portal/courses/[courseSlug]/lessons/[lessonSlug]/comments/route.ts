import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import config from '@payload-config'
import { getPayload } from 'payload'

import { requirePortalMember } from '@/lib/auth/requirePortalMember'
import type { PayloadCourseWriteAPI } from '@/lib/payloadCourse/accessService'
import {
  createLessonComment,
  plainTextLessonCommentBody,
} from '@/lib/payloadCourse/lessonDiscussion'
import { getMemberLessonDetail } from '@/lib/payloadCourse/memberPortal'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ courseSlug: string; lessonSlug: string }> }

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { courseSlug, lessonSlug } = await params
  const destination = `/portal/courses/${encodeURIComponent(courseSlug)}/lessons/${encodeURIComponent(lessonSlug)}`

  try {
    const { memberId, payload } = await requirePortalMember(destination)
    const detail = await getMemberLessonDetail(payload, memberId, courseSlug, lessonSlug)
    if (!detail?.allowed || !detail.lesson?.id) {
      return NextResponse.json({ ok: false, message: 'Lesson discussion is unavailable.' }, { status: 403 })
    }

    const input = (await request.json()) as { body?: unknown; parentId?: unknown }
    const body = typeof input.body === 'string' ? input.body.trim() : ''
    if (!body) return NextResponse.json({ ok: false, message: 'Comment body is required.' }, { status: 400 })
    if (body.length > 10_000) return NextResponse.json({ ok: false, message: 'Comment body is too long.' }, { status: 400 })
    const parentId = typeof input.parentId === 'string' && input.parentId.trim() ? input.parentId.trim() : null

    const created = await createLessonComment(payload as PayloadCourseWriteAPI, {
      memberId,
      lessonId: detail.lesson.id,
      parentId,
      body: plainTextLessonCommentBody(body) as unknown as Record<string, unknown>,
    })

    revalidatePath(destination)

    return NextResponse.json({ ok: true, commentId: created.document.id, body })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to post your comment.'
    const status = /rate limit/i.test(message) ? 429 : /required|too long|not found|unavailable|visible comments|same lesson/i.test(message) ? 400 : 500
    console.error('[lesson comment POST] error:', message)
    return NextResponse.json({ ok: false, message }, { status })
  }
}
