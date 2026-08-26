import 'server-only'

import config from '@payload-config'
import { getPayload } from 'payload'

export interface LeaderboardEntry {
  rank: number
  memberId: string
  displayName: string
  avatarUrl: string | null
  postCount: number
  commentCount: number
  likesReceived: number
  totalScore: number
}

export interface MemberBookmark {
  reactionId: number | string
  postId: number | string
  postTitle: string
  postSlug: string | null
  spaceName: string
  spaceSlug: string
  createdAt: string | null
}

function mediaUrl(media: unknown): string | null {
  if (!media || typeof media !== 'object') return null
  const m = media as Record<string, unknown>
  return typeof m.url === 'string' ? m.url : null
}

function getId(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'number' || typeof value === 'string') return String(value)
  if (typeof value === 'object') {
    const id = (value as Record<string, unknown>).id
    return id != null ? String(id) : null
  }
  return null
}

function getString(obj: unknown, key: string): string | null {
  if (!obj || typeof obj !== 'object') return null
  const v = (obj as Record<string, unknown>)[key]
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

export async function getLeaderboard(limit = 20): Promise<LeaderboardEntry[]> {
  const payload = await getPayload({ config })

  const [postsResult, commentsResult, reactionsResult, profilesResult] = await Promise.all([
    payload.find({
      collection: 'payload_space_posts',
      limit: 500,
      depth: 0,
      overrideAccess: true,
      select: { author: true },
    }),
    payload.find({
      collection: 'payload_space_comments',
      limit: 500,
      depth: 0,
      overrideAccess: true,
      select: { author: true, post: true },
    }),
    payload.find({
      collection: 'payload_space_reactions',
      limit: 500,
      depth: 2,
      overrideAccess: true,
      where: { reactionType: { equals: 'like' } },
      select: { targetKind: true, targetPost: true, targetComment: true },
    }),
    payload.find({
      collection: 'payload_member_profiles',
      limit: 200,
      depth: 1,
      overrideAccess: true,
      select: { member: true, displayName: true, avatar: true },
    }),
  ])

  // Map member ID → post count
  const postCounts = new Map<string, number>()
  for (const post of postsResult.docs) {
    const authorId = getId(post.author)
    if (authorId) postCounts.set(authorId, (postCounts.get(authorId) ?? 0) + 1)
  }

  // Map post ID → author member ID (for computing likes received)
  const postAuthorMap = new Map<string, string>()
  for (const post of postsResult.docs) {
    const postId = String(post.id)
    const authorId = getId(post.author)
    if (authorId) postAuthorMap.set(postId, authorId)
  }

  // Map comment ID → author member ID
  const commentAuthorMap = new Map<string, string>()
  const commentCounts = new Map<string, number>()
  for (const comment of commentsResult.docs) {
    const commentId = String(comment.id)
    const authorId = getId(comment.author)
    if (authorId) {
      commentAuthorMap.set(commentId, authorId)
      commentCounts.set(authorId, (commentCounts.get(authorId) ?? 0) + 1)
    }
  }

  // Map member ID → likes received
  const likesReceived = new Map<string, number>()
  for (const reaction of reactionsResult.docs) {
    const kind = reaction.targetKind
    let authorId: string | null = null

    if (kind === 'post' && reaction.targetPost) {
      const postId = getId(reaction.targetPost)
      if (postId) authorId = postAuthorMap.get(postId) ?? null
    } else if (kind === 'comment' && reaction.targetComment) {
      const commentId = getId(reaction.targetComment)
      if (commentId) authorId = commentAuthorMap.get(commentId) ?? null
    }

    if (authorId) likesReceived.set(authorId, (likesReceived.get(authorId) ?? 0) + 1)
  }

  // Build profile map
  const profileMap = new Map<string, { displayName: string; avatarUrl: string | null }>()
  for (const profile of profilesResult.docs) {
    const memberId = getId(profile.member)
    if (!memberId) continue
    profileMap.set(memberId, {
      displayName: String(profile.displayName ?? ''),
      avatarUrl: mediaUrl(profile.avatar),
    })
  }

  // Collect all member IDs that have any activity
  const allMemberIds = new Set([
    ...postCounts.keys(),
    ...commentCounts.keys(),
    ...likesReceived.keys(),
  ])

  const entries: LeaderboardEntry[] = []
  for (const memberId of allMemberIds) {
    const profile = profileMap.get(memberId)
    if (!profile) continue
    const posts = postCounts.get(memberId) ?? 0
    const comments = commentCounts.get(memberId) ?? 0
    const likes = likesReceived.get(memberId) ?? 0
    const score = posts * 5 + comments * 2 + likes * 3
    entries.push({
      rank: 0,
      memberId,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      postCount: posts,
      commentCount: comments,
      likesReceived: likes,
      totalScore: score,
    })
  }

  entries.sort((a, b) => b.totalScore - a.totalScore || b.postCount - a.postCount)

  return entries.slice(0, limit).map((entry, i) => ({ ...entry, rank: i + 1 }))
}

export async function getMemberBookmarks(memberId: string): Promise<MemberBookmark[]> {
  const payload = await getPayload({ config })

  const result = await payload.find({
    collection: 'payload_space_reactions',
    limit: 100,
    depth: 2,
    overrideAccess: true,
    where: {
      and: [
        { reactionType: { equals: 'bookmark' } },
        { actorMember: { equals: memberId } },
      ],
    },
    sort: '-createdAt',
  })

  const bookmarks: MemberBookmark[] = []
  for (const reaction of result.docs) {
    if (reaction.targetKind !== 'post' || !reaction.targetPost) continue
    const post = reaction.targetPost as unknown as Record<string, unknown>
    const postId = getId(post)
    const space = post.space as Record<string, unknown> | null
    if (!postId || !space) continue

    const spaceSlug = getString(space, 'slug')
    if (!spaceSlug) continue

    bookmarks.push({
      reactionId: reaction.id,
      postId: postId,
      postTitle: getString(post, 'title') ?? 'Untitled',
      postSlug: null,
      spaceName: getString(space, 'name') ?? spaceSlug,
      spaceSlug,
      createdAt: typeof reaction.createdAt === 'string' ? reaction.createdAt : null,
    })
  }

  return bookmarks
}
