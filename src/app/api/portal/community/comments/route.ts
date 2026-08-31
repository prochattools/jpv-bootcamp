import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import config from '@payload-config'
import { getPayload } from 'payload'

import { resolvePayloadRequestSession } from '@/lib/auth/payloadSession'
import { createMentionNotifications } from '@/app/(frontend)/portal/community/actions'
import { getMemberCommunityPostDetail } from '@/lib/payloadCourse/communityDiscussion'
import { createSpaceComment } from '@/lib/payloadCourse/communityPosting'
import { buildPlainTextRichText } from '@/lib/payloadCourse/plainTextRichText'
import { isSafeResourceId } from '@/lib/payloadCourse/lessonResourceDelivery'
import { normalizeRelationshipId, relationshipId } from '@/lib/domain/relationships'
import type { PayloadCourseWriteAPI, PayloadDocument } from '@/lib/payloadCourse/accessService'
import { attachOperationalBillingFallback } from '@/lib/payloadCourse/operationalBillingFallback'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character)
}

function safeExternalUrl(value: string): string | null {
  if (!value || value.length > 2048) return null
  try {
    const url = new URL(value)
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password) return null
    return url.toString()
  } catch {
    return null
  }
}

function safeBunnyEmbedUrl(value: string): string | null {
  const safeUrl = safeExternalUrl(value)
  if (!safeUrl) return null
  const url = new URL(safeUrl)
  if (!/^(?:player|iframe)\.mediadelivery\.net$/i.test(url.hostname)) return null
  if (!/^\/embed\/\d+\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/?$/i.test(url.pathname)) return null
  return `https://${url.hostname}${url.pathname.replace(/\/$/, '')}`
}

class ReplyValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ReplyValidationError'
  }
}

function normalizeUrlList(value: unknown, label: string): string[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value) || value.length > 10) {
    throw new ReplyValidationError(`You can add up to 10 ${label}.`)
  }

  const urls: string[] = []
  for (const candidate of value) {
    const url = safeExternalUrl(text(candidate))
    if (!url) throw new ReplyValidationError(`Every ${label} must be a valid http or https URL.`)
    if (!urls.includes(url)) urls.push(url)
  }
  return urls
}

function normalizeAttachmentIds(value: unknown): string[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value) || value.length > 10) {
    throw new ReplyValidationError('You can add up to 10 images to a reply.')
  }

  const ids: string[] = []
  for (const candidate of value) {
    const id = text(candidate)
    if (!isSafeResourceId(id)) throw new ReplyValidationError('One of the selected images is invalid.')
    if (!ids.includes(id)) ids.push(id)
  }
  return ids
}

type ReplyImage = {
  id: string
  filename: string
}

async function findByIdSafe(
  payload: PayloadCourseWriteAPI,
  collection: string,
  id: string,
): Promise<PayloadDocument | null> {
  try {
    return await payload.findByID({ collection, id, depth: 0, overrideAccess: true }) as PayloadDocument
  } catch {
    return null
  }
}

async function resolveReplyImages(
  payload: PayloadCourseWriteAPI,
  attachmentIds: readonly string[],
  memberId: string,
  spaceId: string,
): Promise<ReplyImage[]> {
  const images: ReplyImage[] = []
  for (const attachmentId of attachmentIds) {
    const file = await findByIdSafe(payload, 'payload_space_files', attachmentId)
    const protectedFileId = relationshipId(file?.protectedFile)
    const media = protectedFileId
      ? await findByIdSafe(payload, 'payload_private_media', protectedFileId)
      : null
    const mimeType = text(media?.mimeType ?? media?.mime_type).toLowerCase()

    if (
      !file ||
      file.moderationStatus !== 'pending_review' ||
      relationshipId(file.space) !== spaceId ||
      relationshipId(file.uploadedBy) !== memberId ||
      relationshipId(file.post) ||
      relationshipId(file.comment) ||
      file.attachmentType !== 'image' ||
      !protectedFileId ||
      !media ||
      !mimeType.startsWith('image/')
    ) {
      throw new ReplyValidationError('One of the selected images is no longer available.')
    }

    images.push({
      id: String(file.id),
      filename: text(media.filename) || text(file.title) || 'Reply image',
    })
  }
  return images
}

function legacyHtmlBlock(safeHtml: string): Record<string, unknown> {
  return {
    type: 'block',
    fields: {
      blockType: 'legacyHTML',
      safeHtml,
    },
  }
}

function buildReplyBody(
  bodyText: string,
  videoUrl: string | null,
  links: readonly string[],
  images: readonly ReplyImage[],
) {
  const document = buildPlainTextRichText(bodyText)
  const blocks = document.root.children as unknown as Array<Record<string, unknown>>

  if (videoUrl) {
    const bunnyUrl = safeBunnyEmbedUrl(videoUrl)
    blocks.push(legacyHtmlBlock(
      bunnyUrl
        ? `<div><iframe src="${escapeHtml(bunnyUrl)}" title="Bunny video" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`
        : `<p><a href="${escapeHtml(videoUrl)}" target="_blank" rel="noopener noreferrer">Watch video: ${escapeHtml(videoUrl)}</a></p>`,
    ))
  }

  for (const link of links) {
    blocks.push(legacyHtmlBlock(`<p><a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link)}</a></p>`))
  }

  for (const image of images) {
    const imageUrl = `/portal/community/files/${encodeURIComponent(image.id)}?inline=1`
    blocks.push(legacyHtmlBlock(`<p><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(image.filename)}"></p>`))
  }

  return document
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
    const rawVideoUrl = text(body.videoUrl)
    const videoUrl = rawVideoUrl ? safeExternalUrl(rawVideoUrl) : null
    if (rawVideoUrl && !videoUrl) throw new ReplyValidationError('The video URL must be a valid http or https URL.')
    const links = normalizeUrlList(body.links, 'links')
    const attachmentIds = normalizeAttachmentIds(body.attachmentIds)
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
    const images = await resolveReplyImages(payload, attachmentIds, memberId, detail.post.space.id)

    const created = await createSpaceComment(payload, {
      memberId,
      postId: detail.post.id,
      displayName: actorName,
      body: buildReplyBody(bodyText, videoUrl, links, images),
    })

    let attachmentWarning: string | null = null
    for (const image of images) {
      try {
        await payload.update({
          collection: 'payload_space_files',
          id: image.id,
          data: {
            comment: normalizeRelationshipId(created.document.id),
            moderationStatus: 'visible',
          },
          overrideAccess: true,
        })
      } catch (error) {
        console.error('[community comments POST] attachment link error:', error instanceof Error ? error.message : String(error))
        attachmentWarning = 'Your reply was posted, but one or more images could not be attached.'
        break
      }
    }

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
      attachmentWarning,
    })
  } catch (error) {
    if (error instanceof ReplyValidationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 400 })
    }
    console.error('[community comments POST] error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ ok: false, message: 'Unable to post your reply. Please try again.' }, { status: 500 })
  }
}
