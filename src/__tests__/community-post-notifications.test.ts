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
