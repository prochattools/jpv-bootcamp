import 'server-only'

import config from '@payload-config'
import { getPayload } from 'payload'

import type { PayloadCourseAccessAPI, PayloadDocument } from './accessService'
import { listActiveMembers, type MemberDirectoryItem } from './memberDirectory'

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
  const value = (obj as Record<string, unknown>)[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export type LeaderboardActivity = {
  posts: readonly PayloadDocument[]
  comments: readonly PayloadDocument[]
  reactions: readonly PayloadDocument[]
  legacyLikes?: readonly PayloadDocument[]
}

function increment(counts: Map<string, number>, memberId: string): void {
  counts.set(memberId, (counts.get(memberId) ?? 0) + 1)
}

/** Pure scoring projection kept separate so the formula is regression-tested. */
export function calculateLeaderboardEntries(
  members: readonly MemberDirectoryItem[],
  activity: LeaderboardActivity,
  limit = 20,
): LeaderboardEntry[] {
  const activeMemberIds = new Set(members.map((member) => member.memberId))
  const postAuthors = new Map<string, string>()
  const commentAuthors = new Map<string, string>()
  const postCounts = new Map<string, number>()
  const commentCounts = new Map<string, number>()
  const likesReceived = new Map<string, number>()

  for (const post of activity.posts) {
    const authorId = getId(post.author)
    if (!authorId || !activeMemberIds.has(authorId)) continue
    postAuthors.set(String(post.id), authorId)
    increment(postCounts, authorId)
  }
  for (const comment of activity.comments) {
    const authorId = getId(comment.author)
    if (!authorId || !activeMemberIds.has(authorId)) continue
    commentAuthors.set(String(comment.id), authorId)
    increment(commentCounts, authorId)
  }

  const countReaction = (reaction: PayloadDocument, legacy = false): void => {
    const kind = reaction.targetKind
    const targetId = kind === 'space_post' || (legacy && kind === 'post')
      ? getId(reaction.targetPost)
      : kind === 'space_comment' || (legacy && kind === 'comment')
        ? getId(reaction.targetSpaceComment ?? reaction.targetComment)
        : kind === 'lesson_comment'
          ? getId(reaction.targetLessonComment)
          : null
    const authorId = targetId
      ? kind === 'space_post' || (legacy && kind === 'post')
        ? postAuthors.get(targetId)
        : commentAuthors.get(targetId)
      : undefined
    if (authorId) increment(likesReceived, authorId)
  }

  for (const reaction of activity.reactions) countReaction(reaction)
  for (const reaction of activity.legacyLikes ?? []) countReaction(reaction, true)

  const memberMap = new Map(members.map((member) => [member.memberId, member]))
  const activeIds = new Set([...postCounts.keys(), ...commentCounts.keys(), ...likesReceived.keys()])
  const entries = Array.from(activeIds).map((memberId): LeaderboardEntry => {
    const member = memberMap.get(memberId)
    const postCount = postCounts.get(memberId) ?? 0
    const commentCount = commentCounts.get(memberId) ?? 0
    const likes = likesReceived.get(memberId) ?? 0
    return {
      rank: 0,
      memberId,
      displayName: member?.displayName ?? 'Member',
      avatarUrl: member?.avatarUrl ?? null,
      postCount,
      commentCount,
      likesReceived: likes,
      totalScore: postCount * 5 + commentCount * 2 + likes * 3,
    }
  })

  entries.sort((left, right) => right.totalScore - left.totalScore || right.postCount - left.postCount || left.displayName.localeCompare(right.displayName))
  return entries.slice(0, limit).map((entry, index) => ({ ...entry, rank: index + 1 }))
}

async function findAll(
  payload: PayloadCourseAccessAPI,
  collection: string,
  where?: Record<string, unknown>,
): Promise<PayloadDocument[]> {
  const documents: PayloadDocument[] = []
  for (let page = 1; page <= 1000; page += 1) {
    const result = await payload.find({
      collection,
      limit: 100,
      page,
      depth: 0,
      overrideAccess: true,
      ...(where ? { where } : {}),
    })
    documents.push(...(result.docs as PayloadDocument[]))
    if (!result.hasNextPage) return documents
  }
  throw new Error(`leaderboard_${collection}_page_limit_exceeded`)
}

export async function getLeaderboard(limit = 20): Promise<LeaderboardEntry[]> {
  const payload = await getPayload({ config }) as unknown as PayloadCourseAccessAPI
  const visibleOnly = { moderationStatus: { equals: 'visible' } }
  const [members, posts, comments, lessonComments, reactions, legacyLikes] = await Promise.all([
    listActiveMembers(payload),
    findAll(payload, 'payload_space_posts', visibleOnly),
    findAll(payload, 'payload_space_comments', visibleOnly),
    findAll(payload, 'payload_lesson_comments', visibleOnly),
    findAll(payload, 'payload_engagement_reactions'),
    findAll(payload, 'payload_space_reactions'),
  ])

  return calculateLeaderboardEntries(members, {
    posts,
    comments: [...comments, ...lessonComments],
    reactions,
    legacyLikes: legacyLikes.filter((reaction) => reaction.reactionType === 'like'),
  }, limit)
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
      postSlug: getString(post, 'slug'),
      spaceName: getString(space, 'name') ?? spaceSlug,
      spaceSlug,
      createdAt: typeof reaction.createdAt === 'string' ? reaction.createdAt : null,
    })
  }

  return bookmarks
}
