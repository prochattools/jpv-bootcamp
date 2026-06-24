import {
  evaluatePayloadSpaceAccess,
  type PayloadCourseAccessAPI,
  type PayloadDocument,
  type PayloadId,
} from '@/lib/payloadCourse/accessService'

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

function getDocumentId(value: unknown): string | null {
  const direct = asString(value)
  if (direct) return direct

  const record = asRecord(value)
  if (!record) return null

  return asString(record.id)
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
  const linkedCourseId = getDocumentId(linkedCourse)
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
    limit: 100,
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
  space: PayloadDocument
): Promise<MemberCommunitySpace | null> {
  const access = await evaluatePayloadSpaceAccess(payload, {
    memberId,
    spaceId: space.id,
  })
  const visibility = normalizeSpaceVisibility(space.visibility)
  const allowed = access.decision.allowed

  if (!allowed && visibility === 'secret') {
    return null
  }

  const membership = await findMemberSpaceMembership(payload, memberId, space.id)
  const linkedCourseSlug = await findLinkedCourseSlug(payload, space.linkedCourse)
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
  const spaces = await findAll(payload, 'payload_spaces', {
    where: {
      status: { equals: 'published' },
    },
    sort: 'sortOrder',
    limit: 100,
  })

  const projections: MemberCommunitySpace[] = []
  for (const space of spaces.sort(bySortOrder)) {
    const projection = await buildSpaceProjection(payload, normalizedMemberId, space)
    if (projection) projections.push(projection)
  }

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

  const projection = await buildSpaceProjection(payload, normalizedMemberId, space)
  if (!projection) return null

  if (!projection.allowed) {
    return {
      ...projection,
      posts: [],
    }
  }

  const posts = await getVisibleSpacePosts(payload, space.id)
  const postProjections: MemberCommunityPost[] = []
  for (const post of posts) {
    postProjections.push({
      id: String(post.id),
      title: asString(post.title) ?? 'Untitled post',
      postType: asString(post.postType),
      pinned: asBoolean(post.pinned),
      createdAt: asDateString(post.createdAt),
      commentCount: await countVisibleComments(payload, post.id),
    })
  }

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

  const announcements: Array<{
    post: PayloadDocument
    space: PayloadDocument
  }> = []

  for (const space of spaces.sort(bySortOrder)) {
    const access = await evaluatePayloadSpaceAccess(payload, {
      memberId: normalizedMemberId,
      spaceId: space.id,
    })
    if (!access.decision.allowed) continue

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

    for (const post of posts) {
      announcements.push({ post, space })
    }
  }

  return announcements
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
