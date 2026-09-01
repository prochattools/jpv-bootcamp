import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@payload-config', () => ({ default: {} }))

import { calculateLeaderboardEntries } from '@/lib/payloadCourse/leaderboard'

describe('leaderboard scoring', () => {
  it('applies posts, comments, and all current engagement reactions', () => {
    const members = [
      { memberId: '1', displayName: 'First Member', email: 'first@example.test', avatarUrl: null, isAdministrator: false },
      { memberId: '2', displayName: 'Second Member', email: 'second@example.test', avatarUrl: null, isAdministrator: false },
    ]
    const entries = calculateLeaderboardEntries(members, {
      posts: [{ id: 10, author: 1 }],
      comments: [{ id: 20, author: 1 }, { id: 21, author: 2 }],
      reactions: [
        { id: 30, targetKind: 'space_post', targetPost: 10, reactionType: 'helpful' },
        { id: 31, targetKind: 'space_comment', targetSpaceComment: 20, reactionType: 'celebrate' },
      ],
    })

    expect(entries[0]).toMatchObject({ memberId: '1', postCount: 1, commentCount: 1, likesReceived: 2, totalScore: 13 })
    expect(entries[1]).toMatchObject({ memberId: '2', postCount: 0, commentCount: 1, likesReceived: 0, totalScore: 2 })
  })

  it('does not expose inactive or unknown activity identities', () => {
    const entries = calculateLeaderboardEntries(
      [{ memberId: '1', displayName: 'Active', email: 'active@example.test', avatarUrl: null, isAdministrator: false }],
      { posts: [{ id: 10, author: 99 }], comments: [], reactions: [] },
    )
    expect(entries).toEqual([])
  })
})
