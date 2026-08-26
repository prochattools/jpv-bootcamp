/**
 * Behavioral tests for community post notification recipient resolution.
 *
 * Verifies that:
 *   - Only active members with verified email in the space receive notifications
 *   - The post author is excluded
 *   - Members with non-active status are excluded
 *   - Members without emailVerifiedAt are excluded
 *   - dryRun mode returns recipients without creating email events
 *
 * Run with: pnpm exec vitest run src/__tests__/community-post-notifications.test.ts
 */

import { describe, it, expect, vi } from 'vitest'

import {
  resolvePostNotificationRecipients,
  notifySpaceMembersOfNewPost,
  notifyPostAuthorOfNewComment,
} from '@/lib/payloadCourse/communityPostNotifications'

function makeMockPayload(
  memberships: Array<{ member: string; status: string }>,
  members: Record<string, { accountStatus: string; emailVerifiedAt: string | null; email: string }>,
  profiles: Record<string, { displayName: string }> = {},
) {
  return {
    find: vi.fn(async ({ collection, where }: any) => {
      if (collection === 'payload_space_memberships') {
        const statusFilter = where?.and?.find((c: any) => c.status)?.status?.equals
        const filtered = statusFilter
          ? memberships.filter((m) => m.status === statusFilter)
          : memberships
        return { docs: filtered.map((m, i) => ({ id: `sm-${i}`, ...m })) }
      }
      if (collection === 'payload_member_profiles') {
        const memberId = where?.member?.equals
        const profile = memberId && profiles[memberId]
        return { docs: profile ? [profile] : [] }
      }
      return { docs: [] }
    }),
    findByID: vi.fn(async ({ collection, id }: any) => {
      if (collection === 'payload_members' && members[id]) {
        return { id, ...members[id] }
      }
      return null
    }),
    create: vi.fn(async ({ data }: any) => ({
      id: `email-${data.dedupeKey}`,
      ...data,
    })),
  } as any
}

describe('resolvePostNotificationRecipients', () => {
  it('includes active verified members except author', async () => {
    const payload = makeMockPayload(
      [
        { member: 'author-1', status: 'active' },
        { member: 'member-2', status: 'active' },
        { member: 'member-3', status: 'active' },
      ],
      {
        'author-1': { accountStatus: 'active', emailVerifiedAt: '2026-01-01', email: 'author@test.com' },
        'member-2': { accountStatus: 'active', emailVerifiedAt: '2026-01-01', email: 'two@test.com' },
        'member-3': { accountStatus: 'active', emailVerifiedAt: '2026-01-01', email: 'three@test.com' },
      },
    )

    const recipients = await resolvePostNotificationRecipients(payload, {
      spaceId: 'space-1',
      authorMemberId: 'author-1',
    })

    expect(recipients).toHaveLength(2)
    expect(recipients.map((r) => r.memberId)).toEqual(['member-2', 'member-3'])
  })

  it('excludes members without verified email', async () => {
    const payload = makeMockPayload(
      [
        { member: 'author-1', status: 'active' },
        { member: 'member-2', status: 'active' },
      ],
      {
        'member-2': { accountStatus: 'active', emailVerifiedAt: null, email: 'two@test.com' },
      },
    )

    const recipients = await resolvePostNotificationRecipients(payload, {
      spaceId: 'space-1',
      authorMemberId: 'author-1',
    })

    expect(recipients).toHaveLength(0)
  })

  it('excludes members with non-active account status', async () => {
    const payload = makeMockPayload(
      [
        { member: 'author-1', status: 'active' },
        { member: 'member-2', status: 'active' },
      ],
      {
        'member-2': { accountStatus: 'blocked', emailVerifiedAt: '2026-01-01', email: 'blocked@test.com' },
      },
    )

    const recipients = await resolvePostNotificationRecipients(payload, {
      spaceId: 'space-1',
      authorMemberId: 'author-1',
    })

    expect(recipients).toHaveLength(0)
  })

  it('excludes memberships with non-active status', async () => {
    const payload = makeMockPayload(
      [
        { member: 'author-1', status: 'active' },
        { member: 'member-2', status: 'muted' },
      ],
      {
        'member-2': { accountStatus: 'active', emailVerifiedAt: '2026-01-01', email: 'muted@test.com' },
      },
    )

    const recipients = await resolvePostNotificationRecipients(payload, {
      spaceId: 'space-1',
      authorMemberId: 'author-1',
    })

    expect(recipients).toHaveLength(0)
  })
})

describe('notifySpaceMembersOfNewPost', () => {
  it('dryRun returns recipients without creating email events', async () => {
    const payload = makeMockPayload(
      [
        { member: 'author-1', status: 'active' },
        { member: 'member-2', status: 'active' },
      ],
      {
        'member-2': { accountStatus: 'active', emailVerifiedAt: '2026-01-01', email: 'two@test.com' },
      },
    )

    const result = await notifySpaceMembersOfNewPost(payload, {
      spaceId: 'space-1',
      postId: 'post-1',
      authorMemberId: 'author-1',
      postTitle: 'Test post',
      spaceName: 'Test Space',
      spaceSlug: 'test-space',
      dryRun: true,
    })

    expect(result.dryRun).toBe(true)
    expect(result.recipients).toHaveLength(1)
    expect(result.emailEventsCreated).toBe(0)
    expect(payload.create).not.toHaveBeenCalled()
  })
})

describe('notifyPostAuthorOfNewComment', () => {
  function makeCommentPayload(
    post: { author: string; title?: string },
    members: Record<string, { accountStatus: string; emailVerifiedAt: string | null; email: string }>,
    profiles: Record<string, { displayName: string }> = {},
  ) {
    return {
      find: vi.fn(async ({ collection, where }: any) => {
        if (collection === 'payload_member_profiles') {
          const memberId = where?.member?.equals
          const profile = memberId && profiles[memberId]
          return { docs: profile ? [profile] : [] }
        }
        return { docs: [] }
      }),
      findByID: vi.fn(async ({ collection, id }: any) => {
        if (collection === 'payload_space_posts') {
          return { id, author: post.author, title: post.title ?? 'Test post' }
        }
        if (collection === 'payload_members' && members[id]) {
          return { id, ...members[id] }
        }
        return null
      }),
      create: vi.fn(async ({ data }: any) => ({
        id: `email-${data.dedupeKey}`,
        ...data,
      })),
    } as any
  }

  it('notifies post author when commenter is different', async () => {
    const payload = makeCommentPayload(
      { author: 'post-author' },
      {
        'post-author': { accountStatus: 'active', emailVerifiedAt: '2026-01-01', email: 'author@test.com' },
      },
      { 'post-author': { displayName: 'Author Name' } },
    )

    const result = await notifyPostAuthorOfNewComment(payload, {
      postId: 'post-1',
      commentId: 'comment-1',
      commenterMemberId: 'commenter-1',
      postTitle: 'Test post',
      spaceName: 'Test Space',
      spaceSlug: 'test-space',
    })

    expect(result.recipient).not.toBeNull()
    expect(result.recipient!.memberId).toBe('post-author')
    expect(result.recipient!.email).toBe('author@test.com')
    expect(result.emailEventCreated).toBe(true)
  })

  it('skips notification when commenter is the post author', async () => {
    const payload = makeCommentPayload(
      { author: 'same-member' },
      {
        'same-member': { accountStatus: 'active', emailVerifiedAt: '2026-01-01', email: 'self@test.com' },
      },
    )

    const result = await notifyPostAuthorOfNewComment(payload, {
      postId: 'post-1',
      commentId: 'comment-1',
      commenterMemberId: 'same-member',
      postTitle: 'Test post',
      spaceName: 'Test Space',
      spaceSlug: 'test-space',
    })

    expect(result.recipient).toBeNull()
    expect(result.skippedReason).toBe('self_comment')
    expect(result.emailEventCreated).toBe(false)
  })

  it('skips notification when post author is blocked', async () => {
    const payload = makeCommentPayload(
      { author: 'blocked-author' },
      {
        'blocked-author': { accountStatus: 'blocked', emailVerifiedAt: '2026-01-01', email: 'blocked@test.com' },
      },
    )

    const result = await notifyPostAuthorOfNewComment(payload, {
      postId: 'post-1',
      commentId: 'comment-1',
      commenterMemberId: 'commenter-1',
      postTitle: 'Test post',
      spaceName: 'Test Space',
      spaceSlug: 'test-space',
    })

    expect(result.recipient).toBeNull()
    expect(result.skippedReason).toBe('author_not_eligible')
  })

  it('dryRun returns recipient without creating email event', async () => {
    const payload = makeCommentPayload(
      { author: 'post-author' },
      {
        'post-author': { accountStatus: 'active', emailVerifiedAt: '2026-01-01', email: 'author@test.com' },
      },
    )

    const result = await notifyPostAuthorOfNewComment(payload, {
      postId: 'post-1',
      commentId: 'comment-1',
      commenterMemberId: 'commenter-1',
      postTitle: 'Test post',
      spaceName: 'Test Space',
      spaceSlug: 'test-space',
      dryRun: true,
    })

    expect(result.dryRun).toBe(true)
    expect(result.recipient).not.toBeNull()
    expect(result.emailEventCreated).toBe(false)
    expect(payload.create).not.toHaveBeenCalled()
  })
})
