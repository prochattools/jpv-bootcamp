import type { PayloadCourseWriteAPI, PayloadDocument, PayloadId } from './accessService'
import { normalizeRelationshipId, relationshipId } from '@/lib/domain/relationships'

export type MemberFollowState = {
  isFollowing: boolean
  followerCount: number
  followingCount: number
}

function memberWhere(field: 'followerMember' | 'followedMember', memberId: PayloadId) {
  return { [field]: { equals: String(memberId) } }
}

async function count(payload: PayloadCourseWriteAPI, where: Record<string, unknown>): Promise<number> {
  if (payload.count) return (await payload.count({ collection: 'payload_member_follows', where, overrideAccess: true })).totalDocs
  const result = await payload.find({ collection: 'payload_member_follows', where, limit: 10_000, depth: 0, overrideAccess: true })
  return result.totalDocs ?? result.docs.length
}

export async function getMemberFollowState(
  payload: PayloadCourseWriteAPI,
  viewerMemberId: PayloadId,
  targetMemberId: PayloadId,
): Promise<MemberFollowState> {
  const viewer = String(viewerMemberId)
  const target = String(targetMemberId)
  const [following, followerCount, followingCount] = await Promise.all([
    payload.find({
      collection: 'payload_member_follows',
      where: { and: [memberWhere('followerMember', viewer), memberWhere('followedMember', target)] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    }),
    count(payload, memberWhere('followedMember', target)),
    count(payload, memberWhere('followerMember', target)),
  ])
  return { isFollowing: following.docs.length > 0, followerCount, followingCount }
}

export async function toggleMemberFollow(
  payload: PayloadCourseWriteAPI,
  viewerMemberId: PayloadId,
  targetMemberId: PayloadId,
): Promise<MemberFollowState> {
  const viewer = String(viewerMemberId)
  const target = String(targetMemberId)
  if (viewer === target) throw new Error('You cannot follow yourself.')
  const existing = await payload.find({
    collection: 'payload_member_follows',
    where: { and: [memberWhere('followerMember', viewer), memberWhere('followedMember', target)] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const relation = existing.docs[0] as PayloadDocument | undefined
  if (relation) {
    if (!payload.delete) throw new Error('Follow service is unavailable.')
    await payload.delete({ collection: 'payload_member_follows', id: relation.id, overrideAccess: true })
  } else {
    await payload.create({
      collection: 'payload_member_follows',
      data: {
        followerMember: normalizeRelationshipId(viewer),
        followedMember: normalizeRelationshipId(target),
      },
      overrideAccess: true,
    })
  }
  return getMemberFollowState(payload, viewer, target)
}

export function followTargetId(value: unknown): string | null {
  return relationshipId(value)
}
