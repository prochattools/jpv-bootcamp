import { NextRequest, NextResponse } from 'next/server'
import config from '@payload-config'
import { getPayload } from 'payload'

import { resolvePayloadRequestSession } from '@/lib/auth/payloadSession'
import { evaluatePayloadSpaceAccess, type PayloadCourseWriteAPI } from '@/lib/payloadCourse/accessService'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function id(value: unknown): string | null {
  if (typeof value === 'string' || typeof value === 'number') {
    const normalized = String(value).trim()
    return normalized || null
  }
  if (value && typeof value === 'object' && 'id' in value) return id((value as { id: unknown }).id)
  return null
}

function relationshipId(value: string): number | string {
  const numeric = Number(value)
  return Number.isSafeInteger(numeric) ? numeric : value
}

export async function POST(request: NextRequest) {
  const session = await resolvePayloadRequestSession(request.headers)
  if (!session.member?.id) return NextResponse.json({ ok: false, message: 'Please sign in again.' }, { status: 401 })

  try {
    const body = await request.json() as Record<string, unknown>
    const postId = id(body.postId)
    if (!postId) return NextResponse.json({ ok: false, message: 'A post is required.' }, { status: 400 })

    const payload = await getPayload({ config }) as unknown as PayloadCourseWriteAPI
    const memberId = String(session.member.id)
    let post: Record<string, unknown>
    try {
      post = await payload.findByID({ collection: 'payload_space_posts', id: postId, depth: 0, overrideAccess: true }) as Record<string, unknown>
    } catch {
      return NextResponse.json({ ok: false, message: 'This post is no longer available.' }, { status: 404 })
    }

    const spaceId = id(post.space)
    if (post.moderationStatus !== 'visible' || !spaceId) {
      return NextResponse.json({ ok: false, message: 'This post is no longer available.' }, { status: 404 })
    }
    const access = await evaluatePayloadSpaceAccess(payload, { memberId, spaceId })
    if (!access.decision.allowed) return NextResponse.json({ ok: false, message: 'This post is not available to you.' }, { status: 403 })

    const existing = await payload.find({
      collection: 'payload_space_reactions',
      where: {
        and: [
          { actorMember: { equals: relationshipId(memberId) } },
          { reactionType: { equals: 'bookmark' } },
          { targetKind: { equals: 'post' } },
          { targetPost: { equals: relationshipId(postId) } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (existing.docs[0]) {
      if (!payload.delete) return NextResponse.json({ ok: false, message: 'Bookmark removal is unavailable.' }, { status: 500 })
      await payload.delete({ collection: 'payload_space_reactions', id: existing.docs[0].id, overrideAccess: true })
      return NextResponse.json({ ok: true, bookmarked: false })
    }

    await payload.create({
      collection: 'payload_space_reactions',
      data: {
        actorMember: relationshipId(memberId),
        reactionType: 'bookmark',
        targetKind: 'post',
        targetPost: relationshipId(postId),
        metadata: { source: 'member_portal' },
      },
      overrideAccess: true,
    })
    return NextResponse.json({ ok: true, bookmarked: true })
  } catch (error) {
    console.error('[portal bookmarks POST] error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ ok: false, message: 'Unable to update this bookmark.' }, { status: 500 })
  }
}
