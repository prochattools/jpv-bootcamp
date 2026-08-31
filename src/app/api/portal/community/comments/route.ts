import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import config from '@payload-config'
import { getPayload } from 'payload'

import { resolvePayloadRequestSession } from '@/lib/auth/payloadSession'
import { createMentionNotifications } from '@/app/(frontend)/portal/community/actions'
import { getMemberCommunityPostDetail } from '@/lib/payloadCourse/communityDiscussion'
import { createSpaceComment } from '@/lib/payloadCourse/communityPosting'
import { buildPlainTextRichText } from '@/lib/payloadCourse/plainTextRichText'
import type { PayloadCourseWriteAPI } from '@/lib/payloadCourse/accessService'
import { attachOperationalBillingFallback } from '@/lib/payloadCourse/operationalBillingFallback'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function displayName(member: Record<string, unknown>): string {
  for (const key of ['displayName', 'fullName', 'name']) {
    if (typeof member[key] === 'string' && member[key].trim()) return member[key].trim().slice(0, 120)
  }
  const names = [member.firstName, member.lastName].filter((value) => typeof value === 'string' && value.trim()).map((value) => String(value))
  return names.join(' ').slice(0, 120) || 'Community member'
}

export async function POST(req: NextRequest) {
  const session = await resolvePayloadRequestSession(req.headers)
  if (!session.member?.id) return NextResponse.json({ ok: false, message: 'Please sign in again.' }, { status: 401 })

  try {
    const body = (await req.json()) as Record<string, unknown>
    const spaceSlug = text(body.spaceSlug)
    const postId = text(body.postId)
    const bodyText = text(body.body)
    const videoUrl = text(body.videoUrl)
    if (!spaceSlug || !postId || !bodyText || bodyText.length > 10000) {
      return NextResponse.json({ ok: false, message: 'A reply is required and must be 10,000 characters or fewer.' }, { status: 400 })
    }

    const payload = attachOperationalBillingFallback(
      (await getPayload({ config })) as unknown as PayloadCourseWriteAPI,
    )
    const memberId = String(session.member.id)
    const detail = await getMemberCommunityPostDetail(payload, memberId, spaceSlug, postId)
    if (!detail.allowed || !detail.post.canComment) return NextResponse.json({ ok: false, message: 'Replies are unavailable for this discussion.' }, { status: 403 })
    const member = await payload.findByID({ collection: 'payload_members', id: memberId, depth: 0, overrideAccess: true }) as Record<string, unknown>
    const actorName = displayName(member)

    const created = await createSpaceComment(payload, {
      memberId,
      postId: detail.post.id,
      displayName: actorName,
      body: buildPlainTextRichText(bodyText, videoUrl || null),
    })

    revalidatePath(`/portal/community/${encodeURIComponent(spaceSlug)}/posts/${encodeURIComponent(postId)}`)

    void createMentionNotifications(payload, bodyText, `/portal/community/${encodeURIComponent(spaceSlug)}/posts/${encodeURIComponent(postId)}`, {
      postTitle: detail.post.title ?? 'Community discussion',
      spaceName: spaceSlug,
    }, actorName).catch((): void => undefined)

    return NextResponse.json({
      ok: true,
      commentId: created.document.id,
      createdAt: created.document.createdAt,
      body: bodyText,
    })
  } catch (error) {
    console.error('[community comments POST] error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ ok: false, message: 'Unable to post your reply. Please try again.' }, { status: 500 })
  }
}
