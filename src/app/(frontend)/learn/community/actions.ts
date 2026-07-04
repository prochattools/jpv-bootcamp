'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { getCurrentPayloadMember } from '@/lib/members/currentMember'
import type { PayloadCourseWriteAPI } from '@/lib/payloadCourse/accessService'
import { getMemberCommunityPostDetail } from '@/lib/payloadCourse/communityDiscussion'
import { getMemberCommunitySpaceDetail } from '@/lib/payloadCourse/communityPortal'
import {
  createSpaceComment,
  createSpacePost,
} from '@/lib/payloadCourse/communityPosting'

function formText(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === 'string' ? value.trim() : ''
}

function boundedText(
  value: string,
  label: string,
  maxLength: number
): string {
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
  return `/learn/community/${encodeURIComponent(spaceSlug)}`
}

function postPath(spaceSlug: string, postId: string): string {
  return `${spacePath(spaceSlug)}/posts/${encodeURIComponent(postId)}`
}

export async function submitCommunityPost(
  spaceSlug: string,
  formData: FormData
): Promise<void> {
  const destination = spacePath(spaceSlug)
  const { member, payload } = await getCurrentPayloadMember()

  if (!member) {
    redirect('/portal?mode=login')
  }

  try {
    const detail = await getMemberCommunitySpaceDetail(payload, member.id, spaceSlug)
    const canPublish =
      detail?.allowed === true &&
      detail.membership?.status === 'active' &&
      (detail.membership.role === 'moderator' || detail.membership.role === 'admin')

    if (!detail || !canPublish) throw new Error('Submission unavailable.')

    const title = boundedText(formText(formData, 'title'), 'Title', 160)
    const bodyText = boundedText(formText(formData, 'body'), 'Body', 10_000)

    await createSpacePost(payload as unknown as PayloadCourseWriteAPI, {
      memberId: member.id,
      spaceId: detail.id,
      title,
      body: plainTextRichText(bodyText),
    })
  } catch {
    redirect(`${destination}?submission=error`)
  }

  revalidatePath(destination)
  redirect(`${destination}?submission=pending`)
}

export async function submitCommunityComment(
  spaceSlug: string,
  postId: string,
  formData: FormData
): Promise<void> {
  const destination = postPath(spaceSlug, postId)
  const { member, payload } = await getCurrentPayloadMember()

  if (!member) {
    redirect('/portal?mode=login')
  }

  try {
    const detail = await getMemberCommunityPostDetail(
      payload,
      member.id,
      spaceSlug,
      postId
    )
    if (!detail.allowed || !detail.post.canComment) {
      throw new Error('Submission unavailable.')
    }

    const bodyText = boundedText(formText(formData, 'body'), 'Body', 10_000)

    await createSpaceComment(payload as unknown as PayloadCourseWriteAPI, {
      memberId: member.id,
      postId: detail.post.id,
      displayName: memberDisplayName(member),
      body: plainTextRichText(bodyText),
    })
  } catch {
    redirect(`${destination}?submission=error`)
  }

  revalidatePath(destination)
  revalidatePath(spacePath(spaceSlug))
  redirect(`${destination}?submission=pending`)
}
