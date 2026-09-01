import { describe, expect, it, vi } from 'vitest'

import {
  getMemberBookmarkState,
  toggleMemberBookmark,
} from '@/lib/payloadCourse/bookmarks'
import type { PayloadCourseWriteAPI } from '@/lib/payloadCourse/accessService'

type Row = { id: number; actor_member_id: number; reaction_type: 'bookmark'; target_kind: 'post'; target_post_id: number }

function makePayload() {
  const rows: Row[] = []
  let nextId = 1
  const query = vi.fn(async ({ text, values }: { text: string; values?: readonly unknown[] }) => {
    if (text.startsWith('SELECT')) {
      const memberId = Number(values?.[0])
      const postId = Number(values?.[1])
      return { rows: rows.filter((row) => row.actor_member_id === memberId && row.target_post_id === postId) }
    }
    if (text.startsWith('INSERT')) {
      const memberId = Number(values?.[0])
      const postId = Number(values?.[1])
      if (rows.some((row) => row.actor_member_id === memberId && row.target_post_id === postId)) return { rows: [] }
      const row: Row = { id: nextId++, actor_member_id: memberId, reaction_type: 'bookmark', target_kind: 'post', target_post_id: postId }
      rows.push(row)
      return { rows: [row] }
    }
    const id = Number(values?.[0])
    const index = rows.findIndex((row) => row.id === id)
    if (index < 0) return { rows: [] }
    const [row] = rows.splice(index, 1)
    return { rows: [row] }
  })

  const payload = {
    db: { pool: { query } },
    find: vi.fn(),
    findByID: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as unknown as PayloadCourseWriteAPI

  return { payload, query }
}

describe('member bookmarks', () => {
  it('uses member/post-scoped SQL persistence without touching Payload relationships', async () => {
    const { payload, query } = makePayload()

    await expect(toggleMemberBookmark(payload, 42, 21)).resolves.toBe(true)
    await expect(getMemberBookmarkState(payload, '42', '21')).resolves.toBe(true)
    await expect(toggleMemberBookmark(payload, 42, 21)).resolves.toBe(false)
    await expect(getMemberBookmarkState(payload, '42', '21')).resolves.toBe(false)

    expect(payload.create).not.toHaveBeenCalled()
    expect(payload.find).not.toHaveBeenCalled()
    expect(query.mock.calls.every(([args]) => Array.isArray(args.values))).toBe(true)
  })
})
