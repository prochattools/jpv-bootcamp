import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

import { requirePortalAdmin } from '@/lib/auth/requirePortalAdmin'
import { PortalAdminActionError } from '@/lib/portalAdmin/actionResult'
import { notifyAnnouncementRecipients } from '@/lib/payloadContent/announcements'
import { announcementHTMLToLexical, announcementHTMLToPlainText } from '@/lib/payloadContent/announcementRichText'
import { uniqueSlugForName } from '@/lib/domain/slugs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function text(value: unknown): string { return typeof value === 'string' ? value.trim() : '' }
function ids(value: unknown): string[] { return Array.isArray(value) ? [...new Set(value.map((entry) => text(entry)).filter(Boolean))] : [] }

export async function POST(request: NextRequest) {
  try {
    let admin
    try {
      admin = await requirePortalAdmin('/portal/content', { redirectOnFailure: false })
    } catch (error) {
      if (error instanceof PortalAdminActionError) return NextResponse.json({ ok: false, message: error.message }, { status: 403 })
      throw error
    }
    const body = await request.json() as Record<string, unknown>
    const title = text(body.title)
    const rawBody = text(body.bodyHtml) || text(body.body)
    const content = announcementHTMLToPlainText(rawBody)
    const requestedAudience = body.audience === 'groups' ? 'groups' : body.audience === 'selected' ? 'selected' : 'all'
    const audience = requestedAudience === 'groups' ? 'selected' : requestedAudience
    const targetMemberIds = audience === 'selected' ? ids(body.targetMemberIds) : undefined
    const targetGroupIds = requestedAudience === 'groups' ? ids(body.targetGroupIds) : []
    if (!title || !content) return NextResponse.json({ ok: false, message: 'Title and announcement text are required.' }, { status: 400 })
    if (audience === 'selected' && !targetMemberIds?.length) return NextResponse.json({ ok: false, message: 'Select at least one recipient.' }, { status: 400 })
    if (requestedAudience === 'groups' && targetGroupIds.length === 0) return NextResponse.json({ ok: false, message: 'Select at least one member group.' }, { status: 400 })

    const { actor, payload } = admin
    if (requestedAudience === 'groups') {
      const activeGroups = await payload.find({
        collection: 'payload_member_groups',
        where: { and: [{ id: { in: targetGroupIds } }, { status: { equals: 'active' } }] },
        limit: targetGroupIds.length,
        depth: 0,
        overrideAccess: true,
      })
      if (activeGroups.docs.length !== targetGroupIds.length) return NextResponse.json({ ok: false, message: 'One or more selected groups are no longer active.' }, { status: 400 })
    }
    const featuredImage = text(body.featuredImage) || undefined
    const featuredVideo = text(body.featuredVideo) || undefined
    const attachments = ids(body.attachments)
    const post = await payload.create({
      collection: 'payload_posts',
      data: {
        title,
        slug: await uniqueSlugForName(payload, 'payload_posts', title),
        excerpt: text(body.excerpt) || content.slice(0, 240),
        content: await announcementHTMLToLexical(rawBody),
        status: 'published',
        audience,
        targetMemberIds: requestedAudience === 'groups' ? { memberIds: [], groupIds: targetGroupIds } : targetMemberIds,
        publishedAt: new Date().toISOString(),
        featuredImage,
        featuredVideo,
        attachments: attachments.length ? attachments : undefined,
      },
      overrideAccess: true,
      user: { id: actor.administratorId, collection: 'payload_users' },
    })
    const baseUrl = process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://jpvbootcamp.com'
    let emailEventsCreated = 0
    let notificationWarning: string | undefined
    try {
      emailEventsCreated = await notifyAnnouncementRecipients(payload, post, content, baseUrl)
    } catch (error) {
      notificationWarning = 'The announcement was published, but notifications could not be fully queued. Review the email queue.'
      console.error('[portal announcements POST] notification fan-out failed:', error instanceof Error ? error.message : String(error))
    }
    revalidatePath('/portal/content')
    revalidatePath(`/portal/posts/${post.slug}`)
    return NextResponse.json({ ok: true, postId: post.id, emailEventsCreated, notificationWarning }, { status: 201 })
  } catch (error) {
    console.error('[portal announcements POST] error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : 'Unable to publish announcement.' }, { status: 400 })
  }
}
