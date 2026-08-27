'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requirePortalAccess } from '@/lib/auth/requirePortalAccess'
import { requirePortalMember } from '@/lib/auth/requirePortalMember'
import { privilegedPayloadAccess } from '@/lib/payload/privilegedAccess'
import { PortalAdminActionError } from '@/lib/portalAdmin/actionResult'
import {
  deleteCommunityCommentCommand,
  deleteCommunityPostCommand,
  editCommunityCommentCommand,
  editCommunityPostCommand,
} from '@/lib/community/commands'
import {
  communityMutationAccess,
  CommunityDomainError,
  findCommunitySpaceBySlug,
} from '@/lib/community/persistence'
import type { PayloadCourseWriteAPI, PayloadDocument } from '@/lib/payloadCourse/accessService'
import { getMemberCommunityPostDetail } from '@/lib/payloadCourse/communityDiscussion'
import { getMemberCommunitySpaceDetail } from '@/lib/payloadCourse/communityPortal'
import {
  createSpaceComment,
  createSpacePost,
} from '@/lib/payloadCourse/communityPosting'
import { buildPlainTextRichText } from '@/lib/payloadCourse/plainTextRichText'
import { boundedText } from '@/lib/domain/validation'
import { relationshipId } from '@/lib/domain/relationships'

// ---------------------------------------------------------------------------
// Mention notification helpers
// ---------------------------------------------------------------------------

function parseMentions(text: string): string[] {
  const matches = text.match(/@([\w][^\s@]{0,49})/g) ?? []
  return [...new Set(matches.map((m) => m.slice(1).trim()).filter(Boolean))]
}

export async function createMentionNotifications(
  payload: PayloadCourseWriteAPI,
  bodyText: string,
  href: string | null,
  context: { postTitle: string; spaceName: string },
  actorName: string,
): Promise<void> {
  const mentions = parseMentions(bodyText)
  if (mentions.length === 0) return

  for (const displayName of mentions) {
    try {
      const profiles = await payload.find({
        collection: 'payload_member_profiles',
        where: { displayName: { like: displayName } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })

      const profile = profiles.docs[0] as Record<string, unknown> | undefined
      if (!profile) continue

      const memberId = relationshipId(profile.member)

      if (!memberId) continue

      await payload.create({
        collection: 'payload_member_notifications',
        data: {
          member: String(memberId),
          type: 'mention',
          actorName,
          title: `mentioned you in "${context.postTitle}" in ${context.spaceName}`,
          href,
          read: false,
        },
        overrideAccess: true,
      })
    } catch {
      // best-effort — mention notifications must not break posting
    }
  }
}

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

function communityAccessForActor(actor: Parameters<typeof communityMutationAccess>[0]) {
  const privilegedAccess = actor.kind === 'admin'
    ? privilegedPayloadAccess(actor, 'community mutation boundary')
    : undefined
  return communityMutationAccess(actor, privilegedAccess)
}

function communityMutationError(error: unknown): string {
  if (error instanceof CommunityDomainError) return error.communityCode
  if (error instanceof PortalAdminActionError) return error.message

  console.error('[community mutation] unexpected error', error)
  return 'server_error'
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
  let mentionContext: {
    bodyText: string
    postTitle: string
    spaceName: string
    href: string
    actorName: string
  } | null = null

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

    const result = await createSpacePost(payload as unknown as PayloadCourseWriteAPI, {
      memberId,
      spaceId: detail.id,
      title,
      body: buildPlainTextRichText(bodyText, videoUrl || null),
    })

    // Capture context for mention notifications (resolved after redirect)
    const postId = String(result.document.id)
    let actorName = 'A member'
    try {
      const member = await (payload as unknown as PayloadCourseWriteAPI).findByID({
        collection: 'payload_members',
        id: memberId,
        depth: 0,
        overrideAccess: true,
      })
      actorName = memberDisplayName(member as Record<string, unknown>)
    } catch { /* best-effort */ }

    mentionContext = {
      bodyText,
      postTitle: title,
      spaceName: detail.name ?? spaceSlug,
      href: postPath(spaceSlug, postId),
      actorName,
    }
  } catch (err) {
    console.error('[submitCommunityPost] submission error:', err instanceof Error ? err.message : String(err))
    errorCode = classifyError(err)
  }

  // Mention notifications are non-blocking and must run before redirect() throws
  if (mentionContext) {
    try {
      void createMentionNotifications(
        payload as unknown as PayloadCourseWriteAPI,
        mentionContext.bodyText,
        mentionContext.href,
        { postTitle: mentionContext.postTitle, spaceName: mentionContext.spaceName },
        mentionContext.actorName,
      ).catch((): void => undefined)
    } catch {
      // must not break the posting flow
    }
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
  let mentionContext: {
    bodyText: string
    postTitle: string
    spaceName: string
    href: string
    actorName: string
  } | null = null

  try {
    const detail = await getMemberCommunityPostDetail(payload, memberId, spaceSlug, postId)
    if (!detail.allowed || !detail.post.canComment) {
      throw new Error('Submission unavailable.')
    }

    const member = await loadMemberRecord(payload as unknown as PayloadCourseWriteAPI, memberId)
    const bodyText = boundedText(formText(formData, 'body'), 'Body', 10_000)
    const videoUrl = formText(formData, 'videoUrl')
    const actorName = memberDisplayName(member)

    await createSpaceComment(payload as unknown as PayloadCourseWriteAPI, {
      memberId,
      postId: detail.post.id,
      displayName: actorName,
      body: buildPlainTextRichText(bodyText, videoUrl || null),
    })

    // Capture context for mention notifications
    mentionContext = {
      bodyText,
      postTitle: detail.post.title ?? postId,
      spaceName: spaceSlug,
      href: destination,
      actorName,
    }
  } catch (err) {
    console.error('[submitCommunityComment] submission error:', err instanceof Error ? err.message : String(err))
    errorCode = classifyError(err)
  }

  // Mention notifications are non-blocking and must run before redirect() throws
  if (mentionContext) {
    void createMentionNotifications(
      payload as unknown as PayloadCourseWriteAPI,
      mentionContext.bodyText,
      mentionContext.href,
      { postTitle: mentionContext.postTitle, spaceName: mentionContext.spaceName },
      mentionContext.actorName,
    ).catch((): void => undefined)
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
  const { actor, payload } = await requirePortalAccess(destination)

  try {
    const access = communityAccessForActor(actor)
    const writePayload = payload as unknown as PayloadCourseWriteAPI
    const space = await findCommunitySpaceBySlug(writePayload, spaceSlug, access)
    if (!space) return { ok: false, error: 'space_not_found' }

    await editCommunityPostCommand(
      { payload: writePayload, actor, access },
      {
        postId,
        expectedSpaceId: String(space.id),
        title: formText(formData, 'title'),
        body: formText(formData, 'body'),
      },
    )

    revalidatePath(destination)
    revalidatePath(spacePath(spaceSlug))
    return { ok: true }
  } catch (err) {
    return { ok: false, error: communityMutationError(err) }
  }
}

export async function deleteCommunityPost(
  spaceSlug: string,
  postId: string,
): Promise<{ ok: boolean; error?: string }> {
  const destination = spacePath(spaceSlug)
  const { actor, payload } = await requirePortalAccess(destination)

  try {
    const access = communityAccessForActor(actor)
    const writePayload = payload as unknown as PayloadCourseWriteAPI
    const space = await findCommunitySpaceBySlug(writePayload, spaceSlug, access)
    if (!space) return { ok: false, error: 'space_not_found' }

    await deleteCommunityPostCommand(
      { payload: writePayload, actor, access },
      { postId, expectedSpaceId: String(space.id) },
    )

    revalidatePath(destination)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: communityMutationError(err) }
  }
}

export async function editCommunityComment(
  spaceSlug: string,
  postId: string,
  commentId: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const destination = postPath(spaceSlug, postId)
  const { actor, payload } = await requirePortalAccess(destination)

  try {
    const access = communityAccessForActor(actor)
    const writePayload = payload as unknown as PayloadCourseWriteAPI
    const space = await findCommunitySpaceBySlug(writePayload, spaceSlug, access)
    if (!space) return { ok: false, error: 'space_not_found' }

    await editCommunityCommentCommand(
      { payload: writePayload, actor, access },
      {
        commentId,
        expectedPostId: postId,
        expectedSpaceId: String(space.id),
        body: formText(formData, 'body'),
      },
    )

    revalidatePath(destination)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: communityMutationError(err) }
  }
}

export async function deleteCommunityComment(
  spaceSlug: string,
  postId: string,
  commentId: string,
): Promise<{ ok: boolean; error?: string }> {
  const destination = postPath(spaceSlug, postId)
  const { actor, payload } = await requirePortalAccess(destination)

  try {
    const access = communityAccessForActor(actor)
    const writePayload = payload as unknown as PayloadCourseWriteAPI
    const space = await findCommunitySpaceBySlug(writePayload, spaceSlug, access)
    if (!space) return { ok: false, error: 'space_not_found' }

    await deleteCommunityCommentCommand(
      { payload: writePayload, actor, access },
      {
        commentId,
        expectedPostId: postId,
        expectedSpaceId: String(space.id),
      },
    )

    revalidatePath(destination)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: communityMutationError(err) }
  }
}
