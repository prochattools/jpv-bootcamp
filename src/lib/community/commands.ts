import type { PortalActor } from '@/lib/auth/portalActor'
import { plainTextToLexical } from '@/lib/content/plainTextToLexical'
import { boundedText } from '@/lib/domain/validation'
import { createAuditEvent } from '@/lib/payloadCourse/events'
import { PortalAdminActionError } from '@/lib/portalAdmin/actionResult'
import { buildPlainTextRichText } from '@/lib/payloadCourse/plainTextRichText'
import type { PayloadCourseWriteAPI, PayloadDocument } from '@/lib/payloadCourse/accessService'
import {
  communityPostHasComments,
  CommunityDomainError,
  deleteCommunityComment,
  deleteCommunityPost,
  findCommunityCommentInPost,
  findCommunityPostInSpace,
  type CommunityMutationAccess,
  updateCommunityComment,
  updateCommunityPost,
} from '@/lib/community/persistence'
import {
  canDeleteCommunityComment,
  canDeleteCommunityPost,
  canEditCommunityComment,
  canEditCommunityPost,
  canModerateCommunityComment,
  canModerateCommunityPost,
} from '@/lib/community/policy'
import { relationshipId } from '@/lib/domain/relationships'

export type CommunityCommandContext = {
  payload: PayloadCourseWriteAPI
  actor: PortalActor
  access: CommunityMutationAccess
}

export type CommunityPostEditInput = {
  title?: string
  body?: string | { root: unknown }
}

export type CommunityPostModerationOperation =
  | 'pin'
  | 'unpin'
  | 'lock'
  | 'unlock'
  | 'hide'
  | 'unhide'

function isLexicalBody(value: unknown): value is { root: unknown } {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && 'root' in value)
}

function postEditData(actor: PortalActor, input: CommunityPostEditInput): Record<string, unknown> {
  if (actor.kind === 'member') {
    const title = boundedText(input.title ?? '', 'Title', 160)
    const body = boundedText(typeof input.body === 'string' ? input.body : '', 'Body', 10_000)
    return { title, body: buildPlainTextRichText(body) }
  }

  const data: Record<string, unknown> = {}
  if (input.title !== undefined) data.title = boundedText(input.title, 'Title', 300)
  if (input.body !== undefined) {
    data.body = isLexicalBody(input.body)
      ? input.body
      : plainTextToLexical(boundedText(input.body, 'Body', 50_000), { maxParagraphs: 500 })
  }
  if (Object.keys(data).length === 0) {
    throw new PortalAdminActionError('invalid_input', 'Nothing to update.')
  }
  return data
}

function commentEditData(actor: PortalActor, body: string | { root: unknown }): Record<string, unknown> {
  if (actor.kind === 'member') {
    return { body: buildPlainTextRichText(boundedText(typeof body === 'string' ? body : '', 'Body', 10_000)) }
  }

  return {
    body: isLexicalBody(body)
      ? body
      : plainTextToLexical(boundedText(body as string, 'Body', 10_000), { maxParagraphs: 100 }),
  }
}

function ownershipError(): CommunityDomainError {
  return new CommunityDomainError('not_owner', 'You can only change your own community content.', 'forbidden')
}

export async function editCommunityPostCommand(
  context: CommunityCommandContext,
  input: CommunityPostEditInput & { postId: string; expectedSpaceId: string },
): Promise<PayloadDocument> {
  const post = await findCommunityPostInSpace(
    context.payload,
    input.postId,
    input.expectedSpaceId,
    context.access,
  )
  if (!canEditCommunityPost(context.actor, relationshipId(post.author))) throw ownershipError()

  const data = postEditData(context.actor, input)
  const updated = await updateCommunityPost(
    context.payload,
    input.postId,
    data,
    context.access,
    context.actor.kind === 'admin',
  )

  if (context.actor.kind === 'admin') {
    await createAuditEvent(context.payload, {
      actorType: 'admin',
      actorId: context.actor.administratorId,
      action: 'post.edited',
      targetCollection: 'payload_space_posts',
      targetId: input.postId,
      before: { title: post.title },
      after: data.title ? { title: data.title } : { bodyEdited: true },
    })
  }

  return updated
}

export async function deleteCommunityPostCommand(
  context: CommunityCommandContext,
  input: { postId: string; expectedSpaceId: string },
): Promise<void> {
  const post = await findCommunityPostInSpace(
    context.payload,
    input.postId,
    input.expectedSpaceId,
    context.access,
  )
  if (!canDeleteCommunityPost(context.actor, relationshipId(post.author))) throw ownershipError()

  if (context.actor.kind === 'admin' && await communityPostHasComments(context.payload, input.postId, context.access)) {
    throw new PortalAdminActionError('dependency_blocked', 'Cannot delete post with comments. Hide it instead.')
  }

  await deleteCommunityPost(context.payload, input.postId, context.access)

  if (context.actor.kind === 'admin') {
    await createAuditEvent(context.payload, {
      actorType: 'admin',
      actorId: context.actor.administratorId,
      action: 'post.deleted',
      targetCollection: 'payload_space_posts',
      targetId: input.postId,
      before: { title: post.title },
    })
  }
}

export async function editCommunityCommentCommand(
  context: CommunityCommandContext,
  input: { commentId: string; expectedPostId: string; expectedSpaceId: string; body: string | { root: unknown } },
): Promise<PayloadDocument> {
  const { comment } = await findCommunityCommentInPost(
    context.payload,
    input.commentId,
    input.expectedPostId,
    input.expectedSpaceId,
    context.access,
  )
  if (!canEditCommunityComment(context.actor, relationshipId(comment.author))) throw ownershipError()

  const updated = await updateCommunityComment(
    context.payload,
    input.commentId,
    commentEditData(context.actor, input.body),
    context.access,
    context.actor.kind === 'admin',
  )

  if (context.actor.kind === 'admin') {
    await createAuditEvent(context.payload, {
      actorType: 'admin',
      actorId: context.actor.administratorId,
      action: 'comment.edited',
      targetCollection: 'payload_space_comments',
      targetId: input.commentId,
      after: { bodyType: isLexicalBody(input.body) ? 'lexical' : 'text' },
    })
  }

  return updated
}

export async function deleteCommunityCommentCommand(
  context: CommunityCommandContext,
  input: { commentId: string; expectedPostId: string; expectedSpaceId: string },
): Promise<void> {
  const { comment } = await findCommunityCommentInPost(
    context.payload,
    input.commentId,
    input.expectedPostId,
    input.expectedSpaceId,
    context.access,
  )
  if (!canDeleteCommunityComment(context.actor, relationshipId(comment.author))) throw ownershipError()

  await deleteCommunityComment(context.payload, input.commentId, context.access)

  if (context.actor.kind === 'admin') {
    await createAuditEvent(context.payload, {
      actorType: 'admin',
      actorId: context.actor.administratorId,
      action: 'comment.deleted',
      targetCollection: 'payload_space_comments',
      targetId: input.commentId,
      before: { displayName: comment.displayName },
    })
  }
}

export async function moderateCommunityPostCommand(
  context: CommunityCommandContext,
  input: { postId: string; expectedSpaceId: string; operation: CommunityPostModerationOperation },
): Promise<PayloadDocument> {
  if (!canModerateCommunityPost(context.actor) || context.actor.kind !== 'admin') {
    throw new PortalAdminActionError('forbidden', 'Administrator access is required.')
  }

  const post = await findCommunityPostInSpace(
    context.payload,
    input.postId,
    input.expectedSpaceId,
    context.access,
  )
  const operations: Record<CommunityPostModerationOperation, {
    data: Record<string, unknown>
    action: string
    before?: Record<string, unknown>
  }> = {
    pin: { data: { pinned: true }, action: 'post.pinned', before: { pinned: post.pinned } },
    unpin: { data: { pinned: false }, action: 'post.unpinned' },
    lock: { data: { locked: true }, action: 'post.locked' },
    unlock: { data: { locked: false }, action: 'post.unlocked' },
    hide: { data: { moderationStatus: 'hidden' }, action: 'post.hidden', before: { moderationStatus: post.moderationStatus } },
    unhide: { data: { moderationStatus: 'visible' }, action: 'post.unhidden' },
  }
  const operation = operations[input.operation]
  const updated = await updateCommunityPost(context.payload, input.postId, operation.data, context.access, true)

  await createAuditEvent(context.payload, {
    actorType: 'admin',
    actorId: context.actor.administratorId,
    action: operation.action,
    targetCollection: 'payload_space_posts',
    targetId: input.postId,
    before: operation.before,
    after: operation.data,
  })

  return updated
}

export async function moderateCommunityCommentCommand(
  context: CommunityCommandContext,
  input: { commentId: string; expectedPostId: string; expectedSpaceId: string; hidden: boolean },
): Promise<PayloadDocument> {
  if (!canModerateCommunityComment(context.actor) || context.actor.kind !== 'admin') {
    throw new PortalAdminActionError('forbidden', 'Administrator access is required.')
  }

  await findCommunityCommentInPost(
    context.payload,
    input.commentId,
    input.expectedPostId,
    input.expectedSpaceId,
    context.access,
  )
  const moderationStatus = input.hidden ? 'hidden' : 'visible'
  const updated = await updateCommunityComment(
    context.payload,
    input.commentId,
    { moderationStatus },
    context.access,
    true,
  )

  await createAuditEvent(context.payload, {
    actorType: 'admin',
    actorId: context.actor.administratorId,
    action: input.hidden ? 'comment.hidden' : 'comment.unhidden',
    targetCollection: 'payload_space_comments',
    targetId: input.commentId,
    after: { moderationStatus },
  })

  return updated
}
