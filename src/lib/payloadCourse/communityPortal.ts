import {
  evaluatePayloadSpaceAccess,
  type PayloadCourseAccessAPI,
  type PayloadDocument,
  type PayloadId,
} from '@/lib/payloadCourse/accessService'
import { relationshipId } from '@/lib/domain/relationships'
import {
  resolveMemberCommunityPostAttachments,
} from '@/lib/payloadCourse/communityDiscussion'
import type { MemberCommunityAttachmentResolution } from '@/lib/payloadCourse/communityFiles'

/**
 * Wraps a PayloadCourseAccessAPI so that identical find/findByID calls within
 * a single request share the same Promise. Eliminates redundant fetches of
 * member, access groups, and subscription data when evaluating access for
 * multiple spaces in parallel.
 *
 * The Promise (not the result) is cached: concurrent callers that race to
 * the same key before the first Promise resolves all receive the same
 * in-flight Promise — a single DB round-trip regardless of concurrency.
 *
 * count is never cached because each call has a distinct where clause.
 */
export function withQueryDedup(payload: PayloadCourseAccessAPI): PayloadCourseAccessAPI {
  const findByIdCache = new Map<string, Promise<unknown>>()
  const findCache = new Map<string, Promise<unknown>>()

  const wrapped: PayloadCourseAccessAPI = {
    find(args) {
      const key = JSON.stringify({
        c: args.collection,
        w: args.where ?? null,
        l: args.limit ?? null,
        d: args.depth ?? null,
        s: args.sort ?? null,
      })
      if (!findCache.has(key)) {
        findCache.set(key, payload.find(args))
      }
      return findCache.get(key) as ReturnType<typeof payload.find>
    },
    findByID(args) {
      const key = `${String(args.collection)}:${String(args.id)}`
      if (!findByIdCache.has(key)) {
        findByIdCache.set(key, payload.findByID(args))
      }
      return findByIdCache.get(key) as ReturnType<typeof payload.findByID>
    },
  }

  if (payload.count) {
    const count = payload.count
    wrapped.count = (args) => count(args)
  }

  return wrapped
}

type SpaceVisibility = 'public' | 'members' | 'private' | 'secret'

export type MemberCommunitySpace = {
  id: string
  name: string
  slug: string | null
  description: string | null
  spaceType: string | null
  visibility: SpaceVisibility
  allowed: boolean
  decisionReason: string
  lockReason: string | null
  canRequestAccess: boolean
  membership: {
    role: string | null
    status: string | null
  } | null
  linkedCourseSlug: string | null
  postCount: number | null
}

export type MemberCommunityDashboard = {
  memberId: string
  spaces: MemberCommunitySpace[]
}

export type MemberCommunityPost = {
  id: string
  title: string
  postType: string | null
  pinned: boolean
  createdAt: string | null
  commentCount: number
  authorName: string
  excerpt: string | null
  attachments: MemberCommunityAttachmentResolution[]
  moderationStatus?: string | null
}

export type MemberAnnouncement = {
  id: string
  title: string
  spaceId: string
  spaceName: string
  spaceSlug: string | null
  pinned: boolean
  createdAt: string | null
}

export type MemberCommunitySpaceDetail = MemberCommunitySpace & {
  posts: MemberCommunityPost[]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null
  return value as Record<string, unknown>
}

function asString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value
  if (typeof value === 'number') return String(value)
  return null
}

function asBoolean(value: unknown): boolean {
  return value === true
}

function asDateString(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString()
  return asString(value)
}

function memberDisplayName(member: PayloadDocument | null): string {
  const direct =
    asString(member?.displayName) ??
    asString(member?.fullName) ??
    asString(member?.name)
  if (direct) return direct.slice(0, 120)

  const firstName = asString(member?.firstName)
  const lastName = asString(member?.lastName)
  const combined = [firstName, lastName].filter(Boolean).join(' ').trim()
  return combined ? combined.slice(0, 120) : 'Community member'
}

function collectRichTextText(value: unknown, output: string[] = []): string[] {
  const record = asRecord(value)
  if (!record) return output

  if (typeof record.text === 'string') output.push(record.text)
  if (Array.isArray(record.children)) {
    for (const child of record.children) collectRichTextText(child, output)
  }

  return output
}

function richTextExcerpt(value: unknown): string | null {
  const document = asRecord(value)
  const text = collectRichTextText(document?.root ?? value)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return null
  return text.length > 240 ? `${text.slice(0, 237).trimEnd()}…` : text
}

function normalizeSpaceVisibility(value: unknown): SpaceVisibility {
  if (value === 'public' || value === 'members' || value === 'private' || value === 'secret') {
    return value
  }

  return 'private'
}

function bySortOrder(a: PayloadDocument, b: PayloadDocument): number {
  const aOrder = typeof a.sortOrder === 'number' ? a.sortOrder : 0
  const bOrder = typeof b.sortOrder === 'number' ? b.sortOrder : 0
  if (aOrder !== bOrder) return aOrder - bOrder
  return String(a.name ?? a.title ?? '').localeCompare(String(b.name ?? b.title ?? ''))
}

function byPinnedAndDate(a: PayloadDocument, b: PayloadDocument): number {
  const aPinned = a.pinned === true ? 1 : 0
  const bPinned = b.pinned === true ? 1 : 0
  if (aPinned !== bPinned) return bPinned - aPinned

  const aTime = new Date(asDateString(a.createdAt) ?? 0).getTime()
  const bTime = new Date(asDateString(b.createdAt) ?? 0).getTime()
  return bTime - aTime
}

function lockReason(reason: string): string {
  switch (reason) {
    case 'authentication_required':
      return 'Sign in to view this community space.'
    case 'account_not_active':
      return 'Your account is not active for this space.'
    case 'billing_not_active':
      return 'Billing must be active before this space unlocks.'
    case 'email_not_verified':
      return 'Verify your email before opening this space.'
    case 'policy_not_active':
      return 'This space is not currently open for access.'
    case 'no_matching_entitlement':
      return 'Your account does not currently include this space.'
    case 'content_not_published':
      return 'This space is not published.'
    default:
      return 'This space is locked for your account.'
  }
}

async function findAll(
  payload: PayloadCourseAccessAPI,
  collection: string,
  args: {
    where?: Record<string, unknown>
    limit?: number
    sort?: string
  } = {}
): Promise<PayloadDocument[]> {
  const result = await payload.find({
    collection,
    where: args.where,
    limit: args.limit ?? 100,
    depth: 0,
    sort: args.sort,
    overrideAccess: true,
  })

  return result.docs
}

async function findOne(
  payload: PayloadCourseAccessAPI,
  collection: string,
  where: Record<string, unknown>,
  sort?: string
): Promise<PayloadDocument | null> {
  const docs = await findAll(payload, collection, { where, limit: 1, sort })
  return docs[0] ?? null
}

async function findByIdSafe(
  payload: PayloadCourseAccessAPI,
  collection: string,
  id: PayloadId | null | undefined
): Promise<PayloadDocument | null> {
  if (!id) return null

  try {
    return await payload.findByID({
      collection,
      id,
      depth: 0,
      overrideAccess: true,
    })
  } catch {
    return null
  }
}

async function countAll(
  payload: PayloadCourseAccessAPI,
  collection: string,
  where: Record<string, unknown>
): Promise<number> {
  if (payload.count) {
    const result = await payload.count({
      collection,
      where,
      overrideAccess: true,
    })
    return result.totalDocs
  }

  const docs = await findAll(payload, collection, {
    where,
    limit: 1000,
  })
  return docs.length
}

async function findLinkedCourseSlug(
  payload: PayloadCourseAccessAPI,
  linkedCourse: unknown
): Promise<string | null> {
  const linkedCourseId = relationshipId(linkedCourse)
  if (!linkedCourseId) return null

  try {
    const course = await payload.findByID({
      collection: 'payload_courses',
      id: linkedCourseId,
      depth: 0,
      overrideAccess: true,
    })
    return asString(course.slug)
  } catch {
    return null
  }
}

async function findMemberSpaceMembership(
  payload: PayloadCourseAccessAPI,
  memberId: string,
  spaceId: PayloadId
): Promise<PayloadDocument | null> {
  return findOne(
    payload,
    'payload_space_memberships',
    {
      and: [
        { member: { equals: memberId } },
        { space: { equals: String(spaceId) } },
      ],
    },
    '-updatedAt'
  )
}

async function getVisibleSpacePosts(
  payload: PayloadCourseAccessAPI,
  spaceId: PayloadId
): Promise<PayloadDocument[]> {
  const posts = await findAll(payload, 'payload_space_posts', {
    where: {
      and: [
        { space: { equals: String(spaceId) } },
        { moderationStatus: { equals: 'visible' } },
      ],
    },
    sort: '-createdAt',
    limit: 50,
  })

  return posts.sort(byPinnedAndDate)
}

async function countVisibleSpacePosts(
  payload: PayloadCourseAccessAPI,
  spaceId: PayloadId
): Promise<number> {
  return countAll(payload, 'payload_space_posts', {
    and: [
      { space: { equals: String(spaceId) } },
      { moderationStatus: { equals: 'visible' } },
    ],
  })
}

async function countVisibleComments(
  payload: PayloadCourseAccessAPI,
  postId: PayloadId
): Promise<number> {
  return countAll(payload, 'payload_space_comments', {
    and: [
      { post: { equals: String(postId) } },
      { moderationStatus: { equals: 'visible' } },
    ],
  })
}

async function buildSpaceProjection(
  payload: PayloadCourseAccessAPI,
  memberId: string,
  space: PayloadDocument,
  membershipMap: Map<string, PayloadDocument> | null
): Promise<MemberCommunitySpace | null> {
  const [access, linkedCourseSlug] = await Promise.all([
    evaluatePayloadSpaceAccess(payload, { memberId, spaceId: space.id }),
    findLinkedCourseSlug(payload, space.linkedCourse),
  ])

  const membership = membershipMap
    ? (membershipMap.get(String(space.id)) ?? null)
    : await findMemberSpaceMembership(payload, memberId, space.id)
  const visibility = normalizeSpaceVisibility(space.visibility)
  const allowed = access.decision.allowed

  if (!allowed && visibility === 'secret') {
    return null
  }

  const postCount = allowed ? await countVisibleSpacePosts(payload, space.id) : null

  return {
    id: String(space.id),
    name: asString(space.name) ?? 'Untitled space',
    slug: asString(space.slug),
    description: asString(space.description),
    spaceType: asString(space.spaceType),
    visibility,
    allowed,
    decisionReason: access.decision.reason,
    lockReason: allowed ? null : lockReason(access.decision.reason),
    canRequestAccess: !allowed && visibility === 'private',
    membership: membership
      ? {
          role: asString(membership.role),
          status: asString(membership.status),
        }
      : null,
    linkedCourseSlug,
    postCount,
  }
}

export async function getMemberCommunityDashboard(
  payload: PayloadCourseAccessAPI,
  memberId: PayloadId
): Promise<MemberCommunityDashboard> {
  const normalizedMemberId = String(memberId)

  const [spaces, memberships] = await Promise.all([
    findAll(payload, 'payload_spaces', {
      where: { status: { equals: 'published' } },
      sort: 'sortOrder',
      limit: 100,
    }),
    findAll(payload, 'payload_space_memberships', {
      where: { member: { equals: normalizedMemberId } },
      limit: 200,
    }),
  ])

  const membershipMap = new Map<string, PayloadDocument>()
  for (const m of memberships) {
    const spaceId = relationshipId(m.space)
    if (spaceId) membershipMap.set(spaceId, m)
  }

  const sorted = spaces.sort(bySortOrder)
  const results = await Promise.all(
    sorted.map((space) => buildSpaceProjection(payload, normalizedMemberId, space, membershipMap))
  )
  const projections = results.filter((p): p is MemberCommunitySpace => p !== null)

  return {
    memberId: normalizedMemberId,
    spaces: projections,
  }
}

export async function getMemberCommunitySpaceDetail(
  payload: PayloadCourseAccessAPI,
  memberId: PayloadId,
  spaceSlug: string
): Promise<MemberCommunitySpaceDetail | null> {
  const normalizedMemberId = String(memberId)
  const space = await findOne(payload, 'payload_spaces', {
    and: [
      { slug: { equals: spaceSlug } },
      { status: { equals: 'published' } },
    ],
  })

  if (!space) return null

  const projection = await buildSpaceProjection(payload, normalizedMemberId, space, null)
  if (!projection) return null

  if (!projection.allowed) {
    return {
      ...projection,
      posts: [],
    }
  }

  const posts = await getVisibleSpacePosts(payload, space.id)
  const [commentCounts, postAttachments] = await Promise.all([
    Promise.all(posts.map((post) => countVisibleComments(payload, post.id))),
    Promise.all(posts.map((post) => resolveMemberCommunityPostAttachments(payload, normalizedMemberId, String(post.id)))),
  ])

  // Batch-fetch all post authors in a single query (N+1 → 1).
  const postAuthorIdSet = new Set<string>()
  for (const post of posts) {
    const authorId = relationshipId(post.author)
    if (authorId) postAuthorIdSet.add(authorId)
  }

  const postAuthorMap = new Map<string, PayloadDocument>()
  if (postAuthorIdSet.size > 0) {
    const uniqueAuthorIds = Array.from(postAuthorIdSet)
    const authorBatch = await payload.find({
      collection: 'payload_members',
      where: { id: { in: uniqueAuthorIds } },
      limit: 200,
      depth: 0,
      overrideAccess: true,
    })
    for (const member of authorBatch.docs) {
      postAuthorMap.set(String(member.id), member)
    }
  }

  const postProjections: MemberCommunityPost[] = posts.map((post, i) => {
    const authorId = relationshipId(post.author)
    const author = authorId ? (postAuthorMap.get(authorId) ?? null) : null
    return {
      id: String(post.id),
      title: asString(post.title) ?? 'Untitled post',
      postType: asString(post.postType),
      pinned: asBoolean(post.pinned),
      createdAt: asDateString(post.createdAt),
      commentCount: commentCounts[i],
      authorName: memberDisplayName(author),
      excerpt: richTextExcerpt(post.body),
      attachments: postAttachments[i] ?? [],
    }
  })

  return {
    ...projection,
    posts: postProjections,
  }
}



export async function getMemberAnnouncements(
  payload: PayloadCourseAccessAPI,
  memberId: PayloadId
): Promise<MemberAnnouncement[]> {
  const normalizedMemberId = String(memberId)
  const spaces = await findAll(payload, 'payload_spaces', {
    where: {
      and: [
        { status: { equals: 'published' } },
        { spaceType: { equals: 'announcement' } },
      ],
    },
    sort: 'sortOrder',
    limit: 100,
  })

  const spaceResults = await Promise.all(
    spaces.sort(bySortOrder).map(async (space) => {
      const access = await evaluatePayloadSpaceAccess(payload, {
        memberId: normalizedMemberId,
        spaceId: space.id,
      })
      if (!access.decision.allowed) return []

      const posts = await findAll(payload, 'payload_space_posts', {
        where: {
          and: [
            { space: { equals: String(space.id) } },
            { postType: { equals: 'announcement' } },
            { moderationStatus: { equals: 'visible' } },
          ],
        },
        sort: '-createdAt',
        limit: 100,
      })

      return posts.map((post) => ({ post, space }))
    })
  )

  return spaceResults
    .flat()
    .sort((a, b) => byPinnedAndDate(a.post, b.post))
    .map(({ post, space }) => ({
      id: String(post.id),
      title: asString(post.title) ?? 'Untitled announcement',
      spaceId: String(space.id),
      spaceName: asString(space.name) ?? 'Announcements',
      spaceSlug: asString(space.slug),
      pinned: asBoolean(post.pinned),
      createdAt: asDateString(post.createdAt),
    }))
}
