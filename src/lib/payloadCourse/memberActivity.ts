import {
  evaluatePayloadSpaceAccess,
  type PayloadCourseAccessAPI,
  type PayloadDocument,
} from '@/lib/payloadCourse/accessService'
import { relationshipId } from '@/lib/domain/relationships'
import { extractPlainText, projectCommunityRichText } from '@/lib/payloadCourse/communityDiscussion'

export type MemberActivityViewer =
  | { kind: 'admin' }
  | { kind: 'member'; memberId: string }

export type MemberActivityItem = {
  id: string
  source: 'post' | 'comment' | 'reaction'
  action: 'posted' | 'replied' | 'reacted'
  actor: {
    memberId: string | null
    displayName: string
    avatarUrl: string | null
  }
  context: string
  excerpt: string | null
  createdAt: string | null
  href: string
}

export type MemberActivityPage = {
  items: MemberActivityItem[]
  page: number
  pageSize: number
  hasMore: boolean
}

function stringValue(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number') return String(value)
  return null
}

function dateValue(value: unknown): string | null {
  const text = stringValue(value)
  if (!text) return null
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function mediaUrl(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  return stringValue((value as Record<string, unknown>).url)
}

function memberName(member: PayloadDocument | null): string {
  const name = stringValue(member?.displayName) ?? stringValue(member?.fullName) ?? stringValue(member?.name)
  if (name) return name.slice(0, 120)
  const combined = [stringValue(member?.firstName), stringValue(member?.lastName)].filter(Boolean).join(' ')
  return combined ? combined.slice(0, 120) : 'Community member'
}

function excerpt(value: unknown): string | null {
  const text = extractPlainText(projectCommunityRichText(value)).replace(/\s+/g, ' ').trim()
  return text ? text.slice(0, 240) : null
}

function compareNewest(left: { createdAt: string | null; id: string }, right: { createdAt: string | null; id: string }): number {
  const leftTime = left.createdAt ? Date.parse(left.createdAt) : 0
  const rightTime = right.createdAt ? Date.parse(right.createdAt) : 0
  if (leftTime !== rightTime) return rightTime - leftTime
  return right.id.localeCompare(left.id)
}

async function findAll(
  payload: PayloadCourseAccessAPI,
  collection: string,
  args: { where?: Record<string, unknown>; limit?: number; sort?: string } = {},
): Promise<PayloadDocument[]> {
  const result = await payload.find({
    collection,
    where: args.where,
    limit: args.limit ?? 100,
    depth: 0,
    sort: args.sort,
    overrideAccess: true,
  })
  return result.docs as PayloadDocument[]
}

function uniqueDocuments(documents: PayloadDocument[]): PayloadDocument[] {
  const seen = new Set<string>()
  return documents.filter((document) => {
    const id = String(document.id)
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
}

async function accessibleSpaces(
  payload: PayloadCourseAccessAPI,
  viewer: MemberActivityViewer,
): Promise<PayloadDocument[]> {
  const spaces = await findAll(payload, 'payload_spaces', {
    where: { status: { equals: 'published' } },
    limit: 500,
    sort: 'name',
  })
  if (viewer.kind === 'admin') return spaces

  const checked = await Promise.all(spaces.map(async (space) => {
    const access = await evaluatePayloadSpaceAccess(payload, { memberId: viewer.memberId, spaceId: space.id })
    return access.decision.allowed ? space : null
  }))
  return checked.filter((space): space is PayloadDocument => Boolean(space))
}

export async function getMemberActivity(
  payload: PayloadCourseAccessAPI,
  viewer: MemberActivityViewer,
  options: { page?: number; pageSize?: number } = {},
): Promise<MemberActivityPage> {
  const page = Math.max(1, Math.min(100, Math.floor(options.page ?? 1)))
  const pageSize = Math.max(1, Math.min(50, Math.floor(options.pageSize ?? 20)))
  const spaces = await accessibleSpaces(payload, viewer)
  const spaceById = new Map(spaces.map((space) => [String(space.id), space]))
  const spaceIds = Array.from(spaceById.keys())
  if (spaceIds.length === 0) return { items: [], page, pageSize, hasMore: false }

  const queryLimit = Math.min(250, page * pageSize * 4)
  const posts = await findAll(payload, 'payload_space_posts', {
    where: {
      and: [
        { space: { in: spaceIds } },
        { moderationStatus: { equals: 'visible' } },
      ],
    },
    limit: queryLimit,
    sort: '-createdAt',
  })
  // Query each activity source by its own recency. A fresh reply or reaction
  // can target an older post, so limiting comments to the newest posts would
  // silently omit the newest activity item.
  const recentComments = await findAll(payload, 'payload_space_comments', {
    where: { moderationStatus: { equals: 'visible' } },
    limit: queryLimit,
    sort: '-createdAt',
  })
  const [engagementReactions, legacyReactions] = await Promise.all([
    findAll(payload, 'payload_engagement_reactions', {
      where: {
        targetKind: { in: ['space_post', 'space_comment'] },
      },
      limit: queryLimit,
      sort: '-createdAt',
    }),
    findAll(payload, 'payload_space_reactions', {
      where: {
        and: [
          { reactionType: { equals: 'like' } },
          { targetKind: { in: ['post', 'comment'] } },
        ],
      },
      limit: queryLimit,
      sort: '-sourceCreatedAt',
    }),
  ])
  const reactions = [
    ...engagementReactions.map((document) => ({ source: 'engagement' as const, document })),
    ...legacyReactions.map((document) => ({ source: 'legacy' as const, document })),
  ]

  const reactionTargetId = (entry: (typeof reactions)[number]): string | null => {
    const reaction = entry.document
    const targetKind = entry.source === 'legacy'
      ? String(reaction.targetKind) === 'comment' ? 'space_comment' : 'space_post'
      : String(reaction.targetKind)
    return targetKind === 'space_post'
      ? relationshipId(reaction.targetPost)
      : relationshipId(entry.source === 'legacy' ? reaction.targetComment : reaction.targetSpaceComment)
  }
  const recentCommentById = new Map(recentComments.map((comment) => [String(comment.id), comment]))
  const reactionCommentIds = Array.from(new Set(
    reactions
      .filter((entry) => {
        const targetKind = entry.source === 'legacy'
          ? String(entry.document.targetKind) === 'comment' ? 'space_comment' : 'space_post'
          : String(entry.document.targetKind)
        return targetKind === 'space_comment'
      })
      .map(reactionTargetId)
      .filter((id): id is string => Boolean(id)),
  ))
  const missingCommentIds = reactionCommentIds.filter((id) => !recentCommentById.has(id))
  const relatedComments = missingCommentIds.length === 0
    ? []
    : await findAll(payload, 'payload_space_comments', {
        where: {
          and: [
            { id: { in: missingCommentIds } },
            { moderationStatus: { equals: 'visible' } },
          ],
        },
        limit: missingCommentIds.length,
      })
  const comments = uniqueDocuments([...recentComments, ...relatedComments])
  const referencedPostIds = Array.from(new Set([
    ...posts.map((post) => String(post.id)),
    ...comments.map((comment) => relationshipId(comment.post)).filter((id): id is string => Boolean(id)),
    ...reactions
      .filter((entry) => {
        const targetKind = entry.source === 'legacy'
          ? String(entry.document.targetKind) === 'comment' ? 'space_comment' : 'space_post'
          : String(entry.document.targetKind)
        return targetKind === 'space_post'
      })
      .map(reactionTargetId)
      .filter((id): id is string => Boolean(id)),
  ]))
  const knownPostIds = new Set(posts.map((post) => String(post.id)))
  const missingPostIds = referencedPostIds.filter((id) => !knownPostIds.has(id))
  const relatedPosts = missingPostIds.length === 0
    ? []
    : await findAll(payload, 'payload_space_posts', {
        where: {
          and: [
            { id: { in: missingPostIds } },
            { moderationStatus: { equals: 'visible' } },
            { space: { in: spaceIds } },
          ],
        },
        limit: missingPostIds.length,
      })
  const allPosts = uniqueDocuments([...posts, ...relatedPosts])
  const postById = new Map(allPosts.map((post) => [String(post.id), post]))
  const commentById = new Map(comments.map((comment) => [String(comment.id), comment]))
  const candidateItems: Array<MemberActivityItem & { actorId: string | null }> = []
  const spaceName = (spaceId: string): string => stringValue(spaceById.get(spaceId)?.name) ?? 'Community space'
  const spaceSlug = (spaceId: string): string => encodeURIComponent(stringValue(spaceById.get(spaceId)?.slug) ?? spaceId)
  const postHref = (spaceId: string, postId: string): string => `/portal/community/${spaceSlug(spaceId)}/posts/${encodeURIComponent(postId)}`

  for (const post of posts) {
    const spaceId = relationshipId(post.space)
    if (!spaceId || !spaceById.has(spaceId)) continue
    const actorId = relationshipId(post.author)
    candidateItems.push({
      id: `post:${post.id}`,
      source: 'post',
      action: 'posted',
      actorId,
      actor: { memberId: actorId, displayName: 'Community member', avatarUrl: null },
      context: `in ${spaceName(spaceId)}`,
      excerpt: excerpt(post.body),
      createdAt: dateValue(post.createdAt),
      href: postHref(spaceId, String(post.id)),
    })
  }

  for (const comment of recentComments) {
    const postId = relationshipId(comment.post)
    const post = postId ? postById.get(postId) : null
    const spaceId = post ? relationshipId(post.space) : null
    if (!post || !spaceId || !spaceById.has(spaceId)) continue
    const actorId = relationshipId(comment.author)
    candidateItems.push({
      id: `comment:${comment.id}`,
      source: 'comment',
      action: 'replied',
      actorId,
      actor: { memberId: actorId, displayName: 'Community member', avatarUrl: null },
      context: `in ${spaceName(spaceId)}`,
      excerpt: excerpt(comment.body),
      createdAt: dateValue(comment.createdAt),
      href: `${postHref(spaceId, String(post.id))}#comment-${encodeURIComponent(String(comment.id))}`,
    })
  }

  for (const entry of reactions) {
    const reaction = entry.document
    const targetKind = entry.source === 'legacy'
      ? String(reaction.targetKind) === 'comment' ? 'space_comment' : 'space_post'
      : String(reaction.targetKind)
    const allowedReactionTypes = entry.source === 'legacy' ? ['like'] : ['helpful', 'insightful', 'celebrate']
    if (!allowedReactionTypes.includes(String(reaction.reactionType))) continue
    const targetId = targetKind === 'space_post'
      ? relationshipId(reaction.targetPost)
      : relationshipId(entry.source === 'legacy' ? reaction.targetComment : reaction.targetSpaceComment)
    const targetPost = targetKind === 'space_post'
      ? (targetId ? postById.get(targetId) : null)
      : (targetId ? commentById.get(targetId) : null)
    const postId = targetKind === 'space_post'
      ? targetId
      : targetPost ? relationshipId(targetPost.post) : null
    const post = postId ? postById.get(postId) : null
    const spaceId = post ? relationshipId(post.space) : null
    if (!targetId || !post || !spaceId || !spaceById.has(spaceId)) continue
    const actorId = relationshipId(entry.source === 'legacy' ? reaction.actorMember : reaction.member)
    const reactionLabel = String(reaction.reactionType)
    candidateItems.push({
      id: `reaction:${reaction.id}`,
      source: 'reaction',
      action: 'reacted',
      actorId,
      actor: { memberId: actorId, displayName: 'Community member', avatarUrl: null },
      context: `${reactionLabel} in ${spaceName(spaceId)}`,
      excerpt: excerpt(targetPost?.body ?? post.body),
      createdAt: dateValue(entry.source === 'legacy' ? reaction.sourceCreatedAt : reaction.createdAt),
      href: postHref(spaceId, String(post.id)),
    })
  }

  const actorIds = Array.from(new Set(candidateItems.map((item) => item.actorId).filter((id): id is string => Boolean(id))))
  const [members, profiles] = await Promise.all([
    actorIds.length === 0 ? [] : findAll(payload, 'payload_members', { where: { id: { in: actorIds } }, limit: actorIds.length }),
    actorIds.length === 0 ? [] : findAll(payload, 'payload_member_profiles', { where: { member: { in: actorIds } }, limit: actorIds.length, }),
  ])
  const memberById = new Map(members.map((member) => [String(member.id), member]))
  const profileByMemberId = new Map(profiles.map((profile) => {
    const id = relationshipId(profile.member)
    return [id ?? String(profile.id), profile] as const
  }))
  const items = candidateItems.map(({ actorId, ...item }) => ({
    ...item,
    actor: {
      memberId: actorId,
      displayName: memberName(memberById.get(actorId ?? '') ?? null) === 'Community member'
        ? memberName(profileByMemberId.get(actorId ?? '') ?? null)
        : memberName(memberById.get(actorId ?? '') ?? null),
      avatarUrl: mediaUrl(profileByMemberId.get(actorId ?? '')?.avatar),
    },
  })).sort(compareNewest)

  const start = (page - 1) * pageSize
  return {
    items: items.slice(start, start + pageSize),
    page,
    pageSize,
    hasMore: items.length > start + pageSize,
  }
}
