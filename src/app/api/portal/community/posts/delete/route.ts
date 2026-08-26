/**
 * DELETE /api/portal/community/posts/:id
 *
 * Moderator/admin only: delete a community post.
 * Checks moderator role in the post's space.
 * Deletes post and cascades to comments.
 */

import { NextRequest, NextResponse } from 'next/server'
import config from '@payload-config'
import { getPayload } from 'payload'
import { resolvePayloadRequestSession } from '@/lib/auth/payloadSession'
import type { PayloadCourseAccessAPI } from '@/lib/payloadCourse/accessService'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE(req: NextRequest) {
  const session = await resolvePayloadRequestSession(req.headers)

  if (!session.member) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 })
  }

  try {
    // Extract postId from URL path: /api/portal/community/posts/[id]/delete
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const postIdIndex = pathParts.indexOf('posts')
    const postId = pathParts[postIdIndex + 1] ?? ''

    if (!postId) {
      return NextResponse.json({ ok: false, reason: 'missing_postId' }, { status: 400 })
    }

    const payload = await getPayload({ config })

    // Fetch the post
    const post = (await payload.findByID({
      collection: 'payload_space_posts',
      id: postId,
      depth: 0,
      overrideAccess: true,
    }).catch((): null => null)) as unknown as Record<string, unknown> | null

    if (!post) {
      return NextResponse.json({ ok: false, reason: 'post_not_found' }, { status: 404 })
    }

    // Get space ID from post
    const spaceId = typeof post.space === 'object' && post.space !== null
      ? (post.space as Record<string, unknown>).id
      : post.space

    if (!spaceId) {
      return NextResponse.json(
        { ok: false, reason: 'post_missing_space' },
        { status: 500 },
      )
    }

    // Check moderator role in this space
    const membership = await payload.find({
      collection: 'payload_space_memberships',
      where: {
        and: [
          { member: { equals: String(session.member) } },
          { space: { equals: String(spaceId) } },
        ],
      },
      limit: 1,
      overrideAccess: true,
    }).catch(() => ({ docs: [] as Record<string, unknown>[] }))

    const membershipDoc = membership.docs[0] as Record<string, unknown> | undefined
    const role = typeof membershipDoc?.role === 'string' ? membershipDoc.role : null

    // Only moderator and admin can delete
    if (role !== 'moderator' && role !== 'admin') {
      return NextResponse.json(
        { ok: false, reason: 'insufficient_role', required: 'moderator_or_admin' },
        { status: 403 },
      )
    }

    // Delete the post (Payload cascade handles comments)
    await payload.delete({
      collection: 'payload_space_posts',
      id: postId,
      overrideAccess: true,
    })

    return NextResponse.json({
      ok: true,
      postId,
      spaceId,
      deleted: true,
      message: 'Post deleted successfully',
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[community-post-delete] error:', message)
    return NextResponse.json({ ok: false, reason: 'server_error', error: message }, { status: 500 })
  }
}
