import type { PortalActor } from '@/lib/auth/portalActor'
import { PortalAdminActionError, type PortalAdminErrorCode } from '@/lib/portalAdmin/actionResult'
import type {
  PayloadCourseWriteAPI,
  PayloadDocument,
  PayloadId,
} from '@/lib/payloadCourse/accessService'
import { relationshipId } from '@/lib/domain/relationships'

export type CommunityMutationAccess = {
  readonly overrideAccess: true
}

export type CommunityErrorCode =
  | 'space_not_found'
  | 'post_not_found'
  | 'post_space_mismatch'
  | 'comment_not_found'
  | 'comment_post_mismatch'
  | 'not_owner'

/** Expected domain failures are safe to translate at either transport. */
export class CommunityDomainError extends PortalAdminActionError {
  readonly communityCode: CommunityErrorCode

  constructor(
    communityCode: CommunityErrorCode,
    message: string,
    adminCode: PortalAdminErrorCode = 'invalid_input',
  ) {
    super(adminCode, message)
    this.name = 'CommunityDomainError'
    this.communityCode = communityCode
  }
}

export function communityMutationAccess(
  actor: PortalActor,
  privilegedAccess?: CommunityMutationAccess,
): CommunityMutationAccess {
  if (actor.kind === 'admin') {
    if (!privilegedAccess) {
      throw new PortalAdminActionError('forbidden', 'Administrator access is required.')
    }
    return privilegedAccess
  }

  // The collection read/delete policies require the same narrowly scoped
  // service override that the pre-A3 member mutation path already used.
  return { overrideAccess: true }
}

export async function findCommunitySpaceBySlug(
  payload: PayloadCourseWriteAPI,
  spaceSlug: string,
  access: CommunityMutationAccess,
): Promise<PayloadDocument | null> {
  const result = await payload.find({
    collection: 'payload_spaces',
    where: { slug: { equals: spaceSlug } },
    limit: 1,
    depth: 0,
    ...access,
  })

  return (result.docs[0] as PayloadDocument | undefined) ?? null
}

async function findByID(
  payload: PayloadCourseWriteAPI,
  collection: string,
  id: PayloadId,
  access: CommunityMutationAccess,
): Promise<PayloadDocument | null> {
  try {
    const document = await payload.findByID({ collection, id, depth: 0, ...access })
    return (document as PayloadDocument | null) ?? null
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'status' in error &&
      (error as { status?: unknown }).status === 404
    ) {
      return null
    }
    throw error
  }
}

export async function findCommunityPostInSpace(
  payload: PayloadCourseWriteAPI,
  postId: PayloadId,
  expectedSpaceId: string,
  access: CommunityMutationAccess,
): Promise<PayloadDocument> {
  const post = await findByID(payload, 'payload_space_posts', postId, access)
  if (!post) throw new CommunityDomainError('post_not_found', 'Post not found.', 'not_found')

  if (relationshipId(post.space) !== expectedSpaceId) {
    throw new CommunityDomainError(
      'post_space_mismatch',
      'Post does not belong to the specified space.',
    )
  }

  return post
}

export async function findCommunityCommentInPost(
  payload: PayloadCourseWriteAPI,
  commentId: PayloadId,
  expectedPostId: string,
  expectedSpaceId: string,
  access: CommunityMutationAccess,
): Promise<{ comment: PayloadDocument; post: PayloadDocument }> {
  const comment = await findByID(payload, 'payload_space_comments', commentId, access)
  if (!comment) {
    throw new CommunityDomainError('comment_not_found', 'Comment not found.', 'not_found')
  }

  if (relationshipId(comment.post) !== expectedPostId) {
    throw new CommunityDomainError(
      'comment_post_mismatch',
      'Comment does not belong to the specified post.',
    )
  }

  const post = await findCommunityPostInSpace(payload, expectedPostId, expectedSpaceId, access)
  return { comment, post }
}

export async function updateCommunityPost(
  payload: PayloadCourseWriteAPI,
  postId: PayloadId,
  data: Record<string, unknown>,
  access: CommunityMutationAccess,
  overrideLock: boolean,
): Promise<PayloadDocument> {
  return payload.update({
    collection: 'payload_space_posts',
    id: postId,
    data,
    ...access,
    ...(overrideLock ? { overrideLock: true } : {}),
  }) as Promise<PayloadDocument>
}

export async function updateCommunityComment(
  payload: PayloadCourseWriteAPI,
  commentId: PayloadId,
  data: Record<string, unknown>,
  access: CommunityMutationAccess,
  overrideLock: boolean,
): Promise<PayloadDocument> {
  return payload.update({
    collection: 'payload_space_comments',
    id: commentId,
    data,
    ...access,
    ...(overrideLock ? { overrideLock: true } : {}),
  }) as Promise<PayloadDocument>
}

export async function deleteCommunityPost(
  payload: PayloadCourseWriteAPI,
  postId: PayloadId,
  access: CommunityMutationAccess,
): Promise<void> {
  if (!payload.delete) throw new PortalAdminActionError('internal_error', 'Community deletion is unavailable.')
  await payload.delete({ collection: 'payload_space_posts', id: postId, ...access })
}

export async function deleteCommunityComment(
  payload: PayloadCourseWriteAPI,
  commentId: PayloadId,
  access: CommunityMutationAccess,
): Promise<void> {
  if (!payload.delete) throw new PortalAdminActionError('internal_error', 'Community deletion is unavailable.')
  await payload.delete({ collection: 'payload_space_comments', id: commentId, ...access })
}

export async function communityPostHasComments(
  payload: PayloadCourseWriteAPI,
  postId: PayloadId,
  access: CommunityMutationAccess,
): Promise<boolean> {
  const comments = await payload.find({
    collection: 'payload_space_comments',
    where: { post: { equals: String(postId) } },
    limit: 1,
    depth: 0,
    ...access,
  })

  return comments.docs.length > 0
}
