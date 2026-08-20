import type {
  PayloadCourseWriteAPI,
  PayloadDocument,
  PayloadId,
} from '@/lib/payloadCourse/accessService'
import { queueAndAttemptEmailEvent } from '@/lib/payloadCourse/events'

export type PostNotificationInput = {
  spaceId: PayloadId
  postId: PayloadId
  authorMemberId: PayloadId
  postTitle: string
  spaceName: string
  spaceSlug: string | null
  dryRun?: boolean
}

export type NotificationRecipient = {
  memberId: string
  email: string
  displayName: string
}

export type PostNotificationResult = {
  recipients: NotificationRecipient[]
  emailEventsCreated: number
  dryRun: boolean
}

function asString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value
  if (typeof value === 'number') return String(value)
  return null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null
  return value as Record<string, unknown>
}

function getDocumentId(value: unknown): string | null {
  const direct = asString(value)
  if (direct) return direct

  const record = asRecord(value)
  if (!record) return null

  return asString(record.id)
}

async function findAll(
  payload: PayloadCourseWriteAPI,
  collection: string,
  args: {
    where?: Record<string, unknown>
    limit?: number
  }
): Promise<PayloadDocument[]> {
  const result = await payload.find({
    collection,
    where: args.where,
    limit: args.limit ?? 500,
    depth: 0,
    overrideAccess: true,
  })

  return result.docs
}

export async function resolvePostNotificationRecipients(
  payload: PayloadCourseWriteAPI,
  input: Pick<PostNotificationInput, 'spaceId' | 'authorMemberId'>
): Promise<NotificationRecipient[]> {
  const memberships = await findAll(payload, 'payload_space_memberships', {
    where: {
      and: [
        { space: { equals: String(input.spaceId) } },
        { status: { equals: 'active' } },
      ],
    },
    limit: 1000,
  })

  const authorId = String(input.authorMemberId)
  const memberIds = memberships
    .map((m) => getDocumentId(m.member))
    .filter((id): id is string => Boolean(id) && id !== authorId)

  if (memberIds.length === 0) return []

  const recipients: NotificationRecipient[] = []

  for (const memberId of memberIds) {
    let member: PayloadDocument | null = null
    try {
      member = await payload.findByID({
        collection: 'payload_members',
        id: memberId,
        depth: 0,
        overrideAccess: true,
      })
    } catch {
      continue
    }

    if (!member) continue
    if (asString(member.accountStatus) !== 'active') continue
    if (!asString(member.emailVerifiedAt)) continue

    const email = asString(member.email)
    if (!email) continue

    let displayName: string | null = null
    try {
      const profiles = await payload.find({
        collection: 'payload_member_profiles',
        where: { member: { equals: memberId } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      displayName = asString(profiles.docs[0]?.displayName)
    } catch {
      // profile lookup is best-effort
    }

    recipients.push({
      memberId,
      email,
      displayName: displayName ?? email.split('@')[0] ?? 'Member',
    })
  }

  return recipients
}

export async function notifySpaceMembersOfNewPost(
  payload: PayloadCourseWriteAPI,
  input: PostNotificationInput
): Promise<PostNotificationResult> {
  const recipients = await resolvePostNotificationRecipients(payload, {
    spaceId: input.spaceId,
    authorMemberId: input.authorMemberId,
  })

  if (input.dryRun) {
    return { recipients, emailEventsCreated: 0, dryRun: true }
  }

  let emailEventsCreated = 0
  for (const recipient of recipients) {
    const { created } = await queueAndAttemptEmailEvent(payload, {
      toEmail: recipient.email,
      templateKey: 'community-post-published',
      dedupeKey: `community-post-published:${input.postId}:${recipient.memberId}`,
      metadata: {
        postId: String(input.postId),
        spaceId: String(input.spaceId),
        spaceName: input.spaceName,
        spaceSlug: input.spaceSlug,
        postTitle: input.postTitle,
        authorMemberId: String(input.authorMemberId),
      },
    })
    if (created) emailEventsCreated++
  }

  return { recipients, emailEventsCreated, dryRun: false }
}

export type CommentNotificationInput = {
  postId: PayloadId
  commentId: PayloadId
  commenterMemberId: PayloadId
  postTitle: string
  spaceName: string
  spaceSlug: string | null
  dryRun?: boolean
}

export type CommentNotificationResult = {
  recipient: NotificationRecipient | null
  emailEventCreated: boolean
  dryRun: boolean
  skippedReason?: 'self_comment' | 'author_not_found' | 'author_not_eligible'
}

export async function notifyPostAuthorOfNewComment(
  payload: PayloadCourseWriteAPI,
  input: CommentNotificationInput
): Promise<CommentNotificationResult> {
  const post = await payload.findByID({
    collection: 'payload_space_posts',
    id: input.postId,
    depth: 0,
    overrideAccess: true,
  })

  const postAuthorId = asString(
    typeof post.author === 'object' && post.author
      ? (post.author as Record<string, unknown>).id
      : post.author
  )
  if (!postAuthorId) {
    return { recipient: null, emailEventCreated: false, dryRun: Boolean(input.dryRun), skippedReason: 'author_not_found' }
  }

  if (postAuthorId === String(input.commenterMemberId)) {
    return { recipient: null, emailEventCreated: false, dryRun: Boolean(input.dryRun), skippedReason: 'self_comment' }
  }

  let author: PayloadDocument | null = null
  try {
    author = await payload.findByID({
      collection: 'payload_members',
      id: postAuthorId,
      depth: 0,
      overrideAccess: true,
    })
  } catch {
    return { recipient: null, emailEventCreated: false, dryRun: Boolean(input.dryRun), skippedReason: 'author_not_found' }
  }

  if (!author) {
    return { recipient: null, emailEventCreated: false, dryRun: Boolean(input.dryRun), skippedReason: 'author_not_found' }
  }
  if (asString(author.accountStatus) !== 'active') {
    return { recipient: null, emailEventCreated: false, dryRun: Boolean(input.dryRun), skippedReason: 'author_not_eligible' }
  }
  if (!asString(author.emailVerifiedAt)) {
    return { recipient: null, emailEventCreated: false, dryRun: Boolean(input.dryRun), skippedReason: 'author_not_eligible' }
  }

  const email = asString(author.email)
  if (!email) {
    return { recipient: null, emailEventCreated: false, dryRun: Boolean(input.dryRun), skippedReason: 'author_not_eligible' }
  }

  let displayName: string | null = null
  try {
    const profiles = await payload.find({
      collection: 'payload_member_profiles',
      where: { member: { equals: postAuthorId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    displayName = asString(profiles.docs[0]?.displayName)
  } catch {
    // best-effort
  }

  const recipient: NotificationRecipient = {
    memberId: postAuthorId,
    email,
    displayName: displayName ?? email.split('@')[0] ?? 'Member',
  }

  if (input.dryRun) {
    return { recipient, emailEventCreated: false, dryRun: true }
  }

  const { created } = await queueAndAttemptEmailEvent(payload, {
    toEmail: recipient.email,
    templateKey: 'community-reply',
    dedupeKey: `community-reply:${input.commentId}:${recipient.memberId}`,
    metadata: {
      postId: String(input.postId),
      commentId: String(input.commentId),
      spaceName: input.spaceName,
      spaceSlug: input.spaceSlug,
      postTitle: input.postTitle,
      commenterMemberId: String(input.commenterMemberId),
    },
  })

  return { recipient, emailEventCreated: created, dryRun: false }
}
