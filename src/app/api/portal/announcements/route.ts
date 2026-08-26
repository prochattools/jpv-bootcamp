import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import config from '@payload-config'
import { getPayload } from 'payload'

import { resolvePayloadRequestSession } from '@/lib/auth/payloadSession'
import { notifyAnnouncementRecipients } from '@/lib/payloadContent/announcements'
import { buildPlainTextRichText } from '@/lib/payloadCourse/plainTextRichText'
import type { PayloadCourseWriteAPI } from '@/lib/payloadCourse/accessService'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function text(value: unknown): string { return typeof value === 'string' ? value.trim() : '' }
function ids(value: unknown): string[] { return Array.isArray(value) ? [...new Set(value.map((entry) => text(entry)).filter(Boolean))] : [] }
function slugify(value: string): string { return `${value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)}-${randomUUID().slice(0, 8)}` }

export async function POST(request: NextRequest) {
  const session = await resolvePayloadRequestSession(request.headers)
  if (!session.administratorId) return NextResponse.json({ ok: false, message: 'Administrator access is required.' }, { status: 403 })
  try {
    const body = await request.json() as Record<string, unknown>
    const title = text(body.title)
    const content = text(body.body)
    const audience = body.audience === 'selected' ? 'selected' : 'all'
    const targetMemberIds = audience === 'selected' ? ids(body.targetMemberIds) : undefined
    if (!title || !content) return NextResponse.json({ ok: false, message: 'Title and announcement text are required.' }, { status: 400 })
    if (audience === 'selected' && !targetMemberIds?.length) return NextResponse.json({ ok: false, message: 'Select at least one recipient.' }, { status: 400 })

    const payload = await getPayload({ config }) as unknown as PayloadCourseWriteAPI
    const featuredImage = text(body.featuredImage) || undefined
    const featuredVideo = text(body.featuredVideo) || undefined
    const attachments = ids(body.attachments)
    const post = await payload.create({
      collection: 'payload_posts',
      data: {
        title,
        slug: slugify(title),
        excerpt: text(body.excerpt) || content.slice(0, 240),
        content: buildPlainTextRichText(content),
        status: 'published',
        audience,
        targetMemberIds,
        publishedAt: new Date().toISOString(),
        featuredImage,
        featuredVideo,
        attachments: attachments.length ? attachments : undefined,
      },
      overrideAccess: true,
      user: { id: session.administratorId, collection: 'payload_users' },
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
