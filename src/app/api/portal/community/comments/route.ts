import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import config from '@payload-config'
import { getPayload } from 'payload'

import { resolvePayloadRequestSession } from '@/lib/auth/payloadSession'
import { createMentionNotifications } from '@/app/(frontend)/portal/community/actions'
import { evaluatePayloadSpaceAccess } from '@/lib/payloadCourse/accessService'
import { createSpaceComment } from '@/lib/payloadCourse/communityPosting'
import {
  safeCommunityExternalUrl,
  safeCommunityVideoEmbed,
} from '@/lib/payloadCourse/communityRichMedia'
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
    const url = safeCommunityExternalUrl(text(candidate))
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
  return Promise.all(attachmentIds.map(async (attachmentId) => {
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

    return {
      id: String(file.id),
      filename: text(media.filename) || text(file.title) || 'Reply image',
    }
  }))
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

function bodyExternalUrls(value: string): string[] {
  const urls = value.match(/https?:\/\/[^\s<>"']+/gi) ?? []
  return [...new Set(urls.map((url) => safeCommunityExternalUrl(url.replace(/[.,!?;:]+$/, ''))).filter((url): url is string => Boolean(url)))]
}

function appendLinkBlock(blocks: Array<Record<string, unknown>>, url: string, label = url): void {
  blocks.push(legacyHtmlBlock(`<p><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a></p>`))
}

function appendVideoContent(blocks: Array<Record<string, unknown>>, url: string): void {
  const embed = safeCommunityVideoEmbed(url)
  const label = embed ? `${embed.provider === 'youtube' ? 'YouTube' : embed.provider === 'vimeo' ? 'Vimeo' : 'Bunny'} video` : 'Open video link'
  appendLinkBlock(blocks, url, label)
  if (!embed) return

  blocks.push(legacyHtmlBlock(
    `<div data-community-video="${embed.provider}"><iframe src="${escapeHtml(embed.src)}" title="${escapeHtml(label)}" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`,
  ))
}

function buildReplyBody(
  bodyText: string,
  videoUrl: string | null,
  links: readonly string[],
  images: readonly ReplyImage[],
) {
  const document = buildPlainTextRichText(bodyText)
  const blocks = document.root.children as unknown as Array<Record<string, unknown>>
  const embeddedVideoUrls = new Set<string>()

  for (const url of [...bodyExternalUrls(bodyText), videoUrl, ...links]) {
    if (!url || !safeCommunityVideoEmbed(url) || embeddedVideoUrls.has(url)) continue
    appendVideoContent(blocks, url)
    embeddedVideoUrls.add(url)
  }

  if (videoUrl && !safeCommunityVideoEmbed(videoUrl)) appendLinkBlock(blocks, videoUrl, 'Open video link')

  for (const link of links) {
    if (!safeCommunityVideoEmbed(link)) appendLinkBlock(blocks, link)
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
    const videoUrl = rawVideoUrl ? safeCommunityExternalUrl(rawVideoUrl) : null
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
    const [post, spaceResult] = await Promise.all([
      findByIdSafe(payload, 'payload_space_posts', postId),
      payload.find({
        collection: 'payload_spaces',
        where: {
          and: [
            { slug: { equals: spaceSlug } },
            { status: { equals: 'published' } },
          ],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      }),
    ])
    const space = spaceResult.docs[0] ?? null
    if (!post || !space || post.moderationStatus !== 'visible' || post.locked === true || relationshipId(post.space) !== String(space.id)) {
      return NextResponse.json({ ok: false, message: 'Replies are unavailable for this discussion.' }, { status: 403 })
    }
    const access = await evaluatePayloadSpaceAccess(payload, { memberId, spaceId: space.id })
    if (!access.decision.allowed) return NextResponse.json({ ok: false, message: 'Replies are unavailable for this discussion.' }, { status: 403 })

    const [member, images] = await Promise.all([
      payload.findByID({ collection: 'payload_members', id: memberId, depth: 0, overrideAccess: true }) as Promise<Record<string, unknown>>,
      resolveReplyImages(payload, attachmentIds, memberId, String(space.id)),
    ])
    const actorName = displayName(member)

    const created = await createSpaceComment(payload, {
      memberId,
      postId: post.id,
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
      postTitle: text(post.title) || 'Community discussion',
      spaceName: text(space.name) || spaceSlug,
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
