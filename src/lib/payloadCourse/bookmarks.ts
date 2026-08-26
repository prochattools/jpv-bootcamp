import type { PayloadCourseAccessAPI } from '@/lib/payloadCourse/accessService'

export async function getMemberBookmarkState(
  payload: PayloadCourseAccessAPI,
  memberId: string,
  postId: string,
): Promise<boolean> {
  const result = await payload.find({
    collection: 'payload_space_reactions',
    where: {
      and: [
        { actorMember: { equals: String(memberId) } },
        { reactionType: { equals: 'bookmark' } },
        { targetKind: { equals: 'post' } },
        { targetPost: { equals: String(postId) } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return result.docs.length > 0
}
