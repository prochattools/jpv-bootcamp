import {
  evaluatePayloadSpaceAccess,
  type PayloadCourseAccessAPI,
  type PayloadDocument,
  type PayloadId,
} from '@/lib/payloadCourse/accessService'
import {
  resolveMemberCommunityAttachment,
  type MemberCommunityAttachmentResolution,
} from '@/lib/payloadCourse/communityFiles'

export type SafeCommunityTextMarks = {
  bold: boolean
  italic: boolean
  underline: boolean
  code: boolean
}

export type SafeCommunityRichTextNode =
  | {
      type: 'root'
      children: SafeCommunityRichTextNode[]
    }
  | {
      type: 'paragraph'
      children: SafeCommunityRichTextNode[]
    }
  | {
      type: 'heading'
      level: 1 | 2 | 3 | 4 | 5 | 6
      children: SafeCommunityRichTextNode[]
    }
  | {
      type: 'list'
      ordered: boolean
      children: SafeCommunityRichTextNode[]
    }
  | {
      type: 'list-item'
      children: SafeCommunityRichTextNode[]
    }
  | {
      type: 'quote'
      children: SafeCommunityRichTextNode[]
    }
  | {
      type: 'link'
      href: string
      children: SafeCommunityRichTextNode[]
    }
  | {
      type: 'text'
      text: string
      marks: SafeCommunityTextMarks
    }
  | {
      type: 'legacy-html'
      html: string
    }

export type MemberCommunityComment = {
  id: string
  authorName: string
  body: SafeCommunityRichTextNode
  createdAt: string | null
}

export type MemberCommunityPostDetail = {
  id: string
  title: string
  postType: 'discussion' | 'question' | 'announcement'
  pinned: boolean
  locked: boolean
  authorName: string
  createdAt: string | null
  space: {
    id: string
    name: string
    slug: string
  }
  body: SafeCommunityRichTextNode
  comments: MemberCommunityComment[]
  attachments: MemberCommunityAttachmentResolution[]
  canPublish: boolean
  canComment: boolean
}

export type MemberCommunityPostDetailDenied = {
  allowed: false
  reason: 'not_found'
}

export type MemberCommunityPostDetailResult =
  | {
      allowed: true
      post: MemberCommunityPostDetail
    }
  | MemberCommunityPostDetailDenied

const EMPTY_ROOT: SafeCommunityRichTextNode = {
  type: 'root',
  children: [],
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number') return String(value)
  return null
}

function asBoolean(value: unknown): boolean {
  return value === true
}

function asDateString(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString()
  const text = asString(value)
  if (!text) return null
  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function getDocumentId(value: unknown): string | null {
  const direct = asString(value)
  if (direct) return direct

  const record = asRecord(value)
  return record ? asString(record.id) : null
}

function normalizePostType(
  value: unknown
): 'discussion' | 'question' | 'announcement' {
  if (value === 'question' || value === 'announcement') return value
  return 'discussion'
}

function normalizeHeadingLevel(value: unknown): 1 | 2 | 3 | 4 | 5 | 6 {
  if (typeof value === 'string') {
    const match = /^h([1-6])$/.exec(value.trim().toLowerCase())
    if (match) return Number(match[1]) as 1 | 2 | 3 | 4 | 5 | 6
  }

  if (
    value === 1 ||
    value === 2 ||
    value === 3 ||
    value === 4 ||
    value === 5 ||
    value === 6
  ) {
    return value
  }

  return 2
}

function normalizeTextMarks(value: unknown): SafeCommunityTextMarks {
  const marks: SafeCommunityTextMarks = {
    bold: false,
    italic: false,
    underline: false,
    code: false,
  }

  if (typeof value === 'number' && Number.isInteger(value)) {
    marks.bold = Boolean(value & 1)
    marks.italic = Boolean(value & 2)
    marks.underline = Boolean(value & 8)
    marks.code = Boolean(value & 16)
    return marks
  }

  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[\s,|]+/)
      : []

  for (const item of values) {
    if (item === 'bold') marks.bold = true
    if (item === 'italic') marks.italic = true
    if (item === 'underline') marks.underline = true
    if (item === 'code') marks.code = true
  }

  return marks
}

function safeHttpUrl(value: unknown): string | null {
  const raw = asString(value)
  if (!raw || raw.length > 2048) return null

  try {
    const url = new URL(raw)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (url.username || url.password) return null
    return url.toString()
  } catch {
    return null
  }
}

function safeLegacyHtml(value: unknown): string | null {
  const html = asString(value)
  if (!html || html.length > 100_000) return null

  // `safeHtml` is produced by the migration sanitizer. Reject stale or malformed
  // records defensively rather than allowing executable or remotely embedded HTML
  // to cross the community renderer boundary.
  if (/<\s*(?:script|style|iframe|video|audio|object|embed|form|svg)\b/i.test(html)) return null
  if (/\son[a-z]+\s*=|(?:javascript|vbscript|data):/i.test(html)) return null

  return html
}

function projectChildren(value: unknown): SafeCommunityRichTextNode[] {
  if (!Array.isArray(value)) return []

  const projected: SafeCommunityRichTextNode[] = []
  for (const child of value.slice(0, 500)) {
    const node = projectNode(child)
    if (node) projected.push(node)
  }
  return projected
}

function projectNode(value: unknown): SafeCommunityRichTextNode | null {
  const node = asRecord(value)
  if (!node) return null

  switch (node.type) {
    case 'root':
      return {
        type: 'root',
        children: projectChildren(node.children),
      }
    case 'paragraph':
      return {
        type: 'paragraph',
        children: projectChildren(node.children),
      }
    case 'heading':
      return {
        type: 'heading',
        level: normalizeHeadingLevel(node.tag ?? node.level),
        children: projectChildren(node.children),
      }
    case 'list':
      return {
        type: 'list',
        ordered:
          node.listType === 'number' ||
          node.listType === 'ordered' ||
          node.tag === 'ol',
        children: projectChildren(node.children),
      }
    case 'listitem':
    case 'list-item':
      return {
        type: 'list-item',
        children: projectChildren(node.children),
      }
    case 'quote':
      return {
        type: 'quote',
        children: projectChildren(node.children),
      }
    case 'link': {
      const href = safeHttpUrl(node.url ?? node.href)
      if (!href) return null
      return {
        type: 'link',
        href,
        children: projectChildren(node.children),
      }
    }
    case 'text': {
      const text = typeof node.text === 'string' ? node.text.slice(0, 20_000) : ''
      if (!text) return null
      return {
        type: 'text',
        text,
        marks: normalizeTextMarks(node.format),
      }
    }
    case 'block': {
      const fields = asRecord(node.fields)
      if (fields?.blockType !== 'legacyHTML') return null
      const html = safeLegacyHtml(fields.safeHtml)
      if (!html) return null
      return { type: 'legacy-html', html }
    }
    default:
      return null
  }
}

export function projectCommunityRichText(value: unknown): SafeCommunityRichTextNode {
  const document = asRecord(value)
  const rootCandidate = document?.root ?? value
  const projected = projectNode(rootCandidate)
  return projected?.type === 'root' ? projected : EMPTY_ROOT
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
  where: Record<string, unknown>
): Promise<PayloadDocument | null> {
  const docs = await findAll(payload, collection, { where, limit: 1 })
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

async function findVisiblePostAttachments(
  payload: PayloadCourseAccessAPI,
  memberId: string,
  postId: string
): Promise<MemberCommunityAttachmentResolution[]> {
  const files = await findAll(payload, 'payload_space_files', {
    where: {
      and: [
        { post: { equals: postId } },
        { moderationStatus: { equals: 'visible' } },
      ],
    },
    sort: 'sortOrder',
    limit: 100,
  })

  const attachments: MemberCommunityAttachmentResolution[] = []
  for (const file of files) {
    const resolved = await resolveMemberCommunityAttachment(
      payload,
      memberId,
      file.id
    )
    if (resolved.allowed) attachments.push(resolved)
  }

  return attachments
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

function commentDisplayName(
  comment: PayloadDocument,
  member: PayloadDocument | null
): string {
  return (asString(comment.displayName) ?? memberDisplayName(member)).slice(0, 120)
}

function byCreatedAtThenId(a: PayloadDocument, b: PayloadDocument): number {
  const aTime = new Date(asDateString(a.createdAt) ?? 0).getTime()
  const bTime = new Date(asDateString(b.createdAt) ?? 0).getTime()
  if (aTime !== bTime) return aTime - bTime
  return String(a.id).localeCompare(String(b.id))
}

async function publishingCapability(
  payload: PayloadCourseAccessAPI,
  memberId: string,
  spaceId: string
): Promise<boolean> {
  const membership = await findOne(payload, 'payload_space_memberships', {
    and: [
      { member: { equals: memberId } },
      { space: { equals: spaceId } },
    ],
  })

  return (
    membership?.status === 'active' &&
    (membership.role === 'moderator' || membership.role === 'admin')
  )
}

function denied(): MemberCommunityPostDetailDenied {
  return { allowed: false, reason: 'not_found' }
}

export async function getMemberCommunityPostDetail(
  payload: PayloadCourseAccessAPI,
  memberIdInput: PayloadId,
  spaceSlugInput: string,
  postIdInput: PayloadId
): Promise<MemberCommunityPostDetailResult> {
  const memberId = String(memberIdInput)
  const spaceSlug = spaceSlugInput.trim()
  const postId = String(postIdInput)
  if (!spaceSlug || !postId) return denied()

  const space = await findOne(payload, 'payload_spaces', {
    and: [
      { slug: { equals: spaceSlug } },
      { status: { equals: 'published' } },
    ],
  })
  if (!space) return denied()

  const spaceId = String(space.id)
  const access = await evaluatePayloadSpaceAccess(payload, {
    memberId,
    spaceId,
  })
  if (!access.decision.allowed) return denied()

  const post = await findByIdSafe(payload, 'payload_space_posts', postId)
  if (
    !post ||
    post.moderationStatus !== 'visible' ||
    getDocumentId(post.space) !== spaceId
  ) {
    return denied()
  }

  const comments = (
    await findAll(payload, 'payload_space_comments', {
      where: {
        and: [
          { post: { equals: postId } },
          { moderationStatus: { equals: 'visible' } },
        ],
      },
      sort: 'createdAt',
      limit: 500,
    })
  ).sort(byCreatedAtThenId)

  const postAuthorId = getDocumentId(post.author)
  const postAuthor = await findByIdSafe(payload, 'payload_members', postAuthorId)
  const canPublish = await publishingCapability(payload, memberId, spaceId)
  const attachments = await findVisiblePostAttachments(payload, memberId, postId)

  const commentProjections: MemberCommunityComment[] = []
  for (const comment of comments) {
    const authorId = getDocumentId(comment.author)
    const author = await findByIdSafe(payload, 'payload_members', authorId)
    commentProjections.push({
      id: String(comment.id),
      authorName: commentDisplayName(comment, author),
      body: projectCommunityRichText(comment.body),
      createdAt: asDateString(comment.createdAt),
    })
  }

  return {
    allowed: true,
    post: {
      id: String(post.id),
      title: (asString(post.title) ?? 'Community discussion').slice(0, 200),
      postType: normalizePostType(post.postType),
      pinned: asBoolean(post.pinned),
      locked: asBoolean(post.locked),
      authorName: memberDisplayName(postAuthor),
      createdAt: asDateString(post.createdAt),
      space: {
        id: spaceId,
        name: (asString(space.name) ?? 'Community space').slice(0, 160),
        slug: spaceSlug,
      },
      body: projectCommunityRichText(post.body),
      comments: commentProjections,
      attachments,
      canPublish,
      canComment: canPublish && !asBoolean(post.locked),
    },
  }
}
