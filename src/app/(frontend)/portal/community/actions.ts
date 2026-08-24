'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requirePortalMember } from '@/lib/auth/requirePortalMember'
import type { PayloadCourseWriteAPI, PayloadDocument } from '@/lib/payloadCourse/accessService'
import { getMemberCommunityPostDetail } from '@/lib/payloadCourse/communityDiscussion'
import { getMemberCommunitySpaceDetail } from '@/lib/payloadCourse/communityPortal'
import {
  createSpaceComment,
  createSpacePost,
} from '@/lib/payloadCourse/communityPosting'
import { getPayload } from 'payload'
import config from '@payload-config'

type SubmissionErrorCode =
  | 'rate_limit'
  | 'not_allowed'
  | 'validation'
  | 'server'

function classifyError(err: unknown): SubmissionErrorCode {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('rate limit')) return 'rate_limit'
  if (msg.includes('unavailable') || msg.includes('membership') || msg.includes('Active space')) return 'not_allowed'
  if (msg.includes('required') || msg.includes('too long') || msg.includes('rich text')) return 'validation'
  return 'server'
}

function formText(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === 'string' ? value.trim() : ''
}

function boundedText(value: string, label: string, maxLength: number): string {
  if (!value) throw new Error(`${label} is required.`)
  if (value.length > maxLength) throw new Error(`${label} is too long.`)
  return value
}

type PlainTextRichTextTextNode = {
  type: 'text'
  detail: 0
  format: 0
  mode: 'normal'
  style: ''
  text: string
  version: 1
}

type PlainTextRichTextParagraphNode = {
  type: 'paragraph'
  format: ''
  indent: 0
  version: 1
  textFormat: 0
  textStyle: ''
  children: PlainTextRichTextTextNode[]
}

type PlainTextRichTextDocument = {
  root: {
    type: 'root'
    format: ''
    indent: 0
    version: 1
    children: PlainTextRichTextParagraphNode[]
  }
}

function plainTextRichText(value: string): PlainTextRichTextDocument {
  const paragraphs = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 100)

  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      children: paragraphs.map((line) => ({
        type: 'paragraph',
        format: '',
        indent: 0,
        version: 1,
        textFormat: 0,
        textStyle: '',
        children: [
          {
            type: 'text',
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: line,
            version: 1,
          },
        ],
      })),
    },
  }
}

function buildRichTextBody(text: string, videoUrl: string | null): PlainTextRichTextDocument {
  const doc = plainTextRichText(text)

  if (videoUrl) {
    const linkNode: PlainTextRichTextParagraphNode = {
      type: 'paragraph',
      format: '',
      indent: 0,
      version: 1,
      textFormat: 0,
      textStyle: '',
      children: [
        {
          type: 'text',
          detail: 0,
          format: 0,
          mode: 'normal',
          style: '',
          text: `Video: ${videoUrl}`,
          version: 1,
        },
      ],
    }
    doc.root.children.push(linkNode)
  }

  return doc
}

function memberDisplayName(member: Record<string, unknown>): string {
  for (const key of ['displayName', 'fullName', 'name']) {
    const value = member[key]
    if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 120)
  }

  const firstName = typeof member.firstName === 'string' ? member.firstName.trim() : ''
  const lastName = typeof member.lastName === 'string' ? member.lastName.trim() : ''
  return [firstName, lastName].filter(Boolean).join(' ').slice(0, 120) || 'Community member'
}

function spacePath(spaceSlug: string): string {
  return `/portal/community/${encodeURIComponent(spaceSlug)}`
}

function postPath(spaceSlug: string, postId: string): string {
  return `${spacePath(spaceSlug)}/posts/${encodeURIComponent(postId)}`
}

async function loadMemberRecord(
  payload: PayloadCourseWriteAPI,
  memberId: string,
): Promise<Record<string, unknown>> {
  const member = await payload.findByID({
    collection: 'payload_members',
    id: memberId,
    depth: 0,
    overrideAccess: true,
  })
  return member as PayloadDocument
}

export async function submitCommunityPost(spaceSlug: string, formData: FormData): Promise<void> {
  const destination = spacePath(spaceSlug)
  const { memberId, payload } = await requirePortalMember(destination)

  let errorCode: SubmissionErrorCode | null = null
  try {
    const detail = await getMemberCommunitySpaceDetail(payload, memberId, spaceSlug)
    const canSubmit =
      detail?.allowed === true &&
      detail.membership?.status === 'active'

    if (!detail || !canSubmit) throw new Error('Submission unavailable.')

    const membershipRole = detail.membership?.role
    if (membershipRole !== 'member' && membershipRole !== 'moderator' && membershipRole !== 'admin') {
      throw new Error('Submission unavailable: member role invalid or missing.')
    }

    const title = boundedText(formText(formData, 'title'), 'Title', 160)
    const bodyText = boundedText(formText(formData, 'body'), 'Body', 10_000)

    const videoUrl = formText(formData, 'videoUrl')

    await createSpacePost(payload as unknown as PayloadCourseWriteAPI, {
      memberId,
      spaceId: detail.id,
      title,
      body: buildRichTextBody(bodyText, videoUrl || null),
    })
  } catch (err) {
    console.error('[submitCommunityPost] submission error:', err instanceof Error ? err.message : String(err))
    errorCode = classifyError(err)
  }

  if (errorCode) {
    redirect(`${destination}?submission=error&reason=${errorCode}`)
  }

  revalidatePath(destination)
  redirect(`${destination}?submission=pending`)
}

export async function submitCommunityComment(
  spaceSlug: string,
  postId: string,
  formData: FormData,
): Promise<void> {
  const destination = postPath(spaceSlug, postId)
  const { memberId, payload } = await requirePortalMember(destination)

  let errorCode: SubmissionErrorCode | null = null
  try {
    const detail = await getMemberCommunityPostDetail(payload, memberId, spaceSlug, postId)
    if (!detail.allowed || !detail.post.canComment) {
      throw new Error('Submission unavailable.')
    }

    const member = await loadMemberRecord(payload as unknown as PayloadCourseWriteAPI, memberId)
    const bodyText = boundedText(formText(formData, 'body'), 'Body', 10_000)

    const videoUrl = formText(formData, 'videoUrl')

    await createSpaceComment(payload as unknown as PayloadCourseWriteAPI, {
      memberId,
      postId: detail.post.id,
      displayName: memberDisplayName(member),
      body: buildRichTextBody(bodyText, videoUrl || null),
    })
  } catch (err) {
    console.error('[submitCommunityComment] submission error:', err instanceof Error ? err.message : String(err))
    errorCode = classifyError(err)
  }

  if (errorCode) {
    redirect(`${destination}?submission=error&reason=${errorCode}`)
  }

  revalidatePath(destination)
  revalidatePath(spacePath(spaceSlug))
  redirect(`${destination}?submission=pending`)
}

export async function editCommunityPost(
  spaceSlug: string,
  postId: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const destination = postPath(spaceSlug, postId)
  const { memberId } = await requirePortalMember(destination)

  try {
    const payload = await getPayload({ config })

    const post = await payload.findByID({
      collection: 'payload_space_posts',
      id: postId,
      depth: 0,
      overrideAccess: true,
    })

    const postAuthorId = typeof post.author === 'object' && post.author !== null
      ? String((post.author as unknown as Record<string, unknown>).id)
      : String(post.author)

    if (postAuthorId !== String(memberId)) {
      return { ok: false, error: 'not_owner' }
    }

    const title = boundedText(formText(formData, 'title'), 'Title', 160)
    const bodyText = boundedText(formText(formData, 'body'), 'Body', 10_000)

    await payload.update({
      collection: 'payload_space_posts',
      id: postId,
      data: {
        title,
        body: plainTextRichText(bodyText),
      },
      overrideAccess: true,
    })

    revalidatePath(destination)
    revalidatePath(spacePath(spaceSlug))
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'server_error' }
  }
}

export async function deleteCommunityPost(
  spaceSlug: string,
  postId: string,
): Promise<{ ok: boolean; error?: string }> {
  const destination = spacePath(spaceSlug)
  const { memberId } = await requirePortalMember(destination)

  try {
    const payload = await getPayload({ config })

    const post = await payload.findByID({
      collection: 'payload_space_posts',
      id: postId,
      depth: 0,
      overrideAccess: true,
    })

    const postAuthorId = typeof post.author === 'object' && post.author !== null
      ? String((post.author as unknown as Record<string, unknown>).id)
      : String(post.author)

    if (postAuthorId !== String(memberId)) {
      return { ok: false, error: 'not_owner' }
    }

    await payload.delete({
      collection: 'payload_space_posts',
      id: postId,
      overrideAccess: true,
    })

    revalidatePath(destination)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'server_error' }
  }
}

export async function editCommunityComment(
  spaceSlug: string,
  postId: string,
  commentId: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const destination = postPath(spaceSlug, postId)
  const { memberId } = await requirePortalMember(destination)

  try {
    const payload = await getPayload({ config })

    const comment = await payload.findByID({
      collection: 'payload_space_comments',
      id: commentId,
      depth: 0,
      overrideAccess: true,
    })

    const commentAuthorId = typeof comment.author === 'object' && comment.author !== null
      ? String((comment.author as unknown as Record<string, unknown>).id)
      : String(comment.author)

    if (commentAuthorId !== String(memberId)) {
      return { ok: false, error: 'not_owner' }
    }

    const bodyText = boundedText(formText(formData, 'body'), 'Body', 10_000)

    await payload.update({
      collection: 'payload_space_comments',
      id: commentId,
      data: {
        body: plainTextRichText(bodyText),
      },
      overrideAccess: true,
    })

    revalidatePath(destination)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'server_error' }
  }
}

export async function deleteCommunityComment(
  spaceSlug: string,
  postId: string,
  commentId: string,
): Promise<{ ok: boolean; error?: string }> {
  const destination = postPath(spaceSlug, postId)
  const { memberId } = await requirePortalMember(destination)

  try {
    const payload = await getPayload({ config })

    const comment = await payload.findByID({
      collection: 'payload_space_comments',
      id: commentId,
      depth: 0,
      overrideAccess: true,
    })

    const commentAuthorId = typeof comment.author === 'object' && comment.author !== null
      ? String((comment.author as unknown as Record<string, unknown>).id)
      : String(comment.author)

    if (commentAuthorId !== String(memberId)) {
      return { ok: false, error: 'not_owner' }
    }

    await payload.delete({
      collection: 'payload_space_comments',
      id: commentId,
      overrideAccess: true,
    })

    revalidatePath(destination)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'server_error' }
  }
}
