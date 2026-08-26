import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/payloadCourse/accessService', async () => {
  const actual = await vi.importActual<typeof import('@/lib/payloadCourse/accessService')>('@/lib/payloadCourse/accessService')
  return {
    ...actual,
    evaluatePayloadLessonAccess: vi.fn(),
  }
})

import { evaluatePayloadLessonAccess } from '@/lib/payloadCourse/accessService'
import {
  createLessonComment,
  listLessonDiscussion,
  plainTextLessonCommentBody,
} from '@/lib/payloadCourse/lessonDiscussion'

const mockedLessonAccess = vi.mocked(evaluatePayloadLessonAccess)

function allowLesson(id = '11') {
  mockedLessonAccess.mockResolvedValue({
    decision: { allowed: true, reason: 'allowed' } as never,
    resource: { type: 'lesson', id, title: 'Lesson' },
    memberId: '42',
  })
}

function denyLesson() {
  mockedLessonAccess.mockResolvedValue({
    decision: { allowed: false, reason: 'account_ineligible' } as never,
    resource: { type: 'lesson', id: '11', title: 'Lesson' },
    memberId: '42',
  })
}

function makePayload({
  comments = [] as Record<string, unknown>[],
  parent = null as Record<string, unknown> | null,
  profileName = 'Member Example',
} = {}) {
  let nextId = 100
  const created: Array<{ collection: string; data: Record<string, unknown> }> = []

  const find = vi.fn(async (args: { collection: string; where?: unknown }) => {
    if (args.collection === 'payload_lesson_comments') return { docs: comments }
    if (args.collection === 'payload_member_profiles') {
      return { docs: profileName ? [{ id: 3, displayName: profileName, member: 42 }] : [] }
    }
    return { docs: [] }
  })

  const findByID = vi.fn(async (args: { collection: string; id: string | number }) => {
    if (args.collection === 'payload_lesson_comments') {
      if (!parent || String(parent.id) !== String(args.id)) throw new Error('not found')
      return parent
    }
    if (args.collection === 'payload_members') {
      return { id: 42, email: 'member@example.test' }
    }
    throw new Error(`Unexpected findByID ${args.collection}`)
  })

  const create = vi.fn(async (args: { collection: string; data: Record<string, unknown> }) => {
    const doc = {
      id: nextId++,
      createdAt: '2026-08-14T20:00:00.000Z',
      updatedAt: '2026-08-14T20:00:00.000Z',
      ...args.data,
    }
    created.push({ collection: args.collection, data: args.data })
    return doc
  })

  const update = vi.fn()

  return {
    payload: { find, findByID, create, update },
    find,
    findByID,
    create,
    created,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('lesson discussion feature parity', () => {
  it('lists visible historical comments in source chronology after lesson access passes', async () => {
    allowLesson()
    const payload = makePayload({
      comments: [
        {
          id: 2,
          lesson: 11,
          author: 8,
          parent: null,
          displayName: 'Second',
          body: plainTextLessonCommentBody('Second'),
          moderationStatus: 'visible',
          sourceCreatedAt: '2025-01-02T00:00:00.000Z',
          createdAt: '2026-08-14T00:00:00.000Z',
          legacyCommentId: 'legacy-2',
        },
        {
          id: 1,
          lesson: 11,
          author: 7,
          parent: null,
          displayName: 'First',
          body: plainTextLessonCommentBody('First'),
          moderationStatus: 'visible',
          sourceCreatedAt: '2025-01-01T00:00:00.000Z',
          createdAt: '2026-08-14T00:00:00.000Z',
          legacyCommentId: 'legacy-1',
        },
      ],
    })

    const result = await listLessonDiscussion(payload.payload as never, 42, 11)
    expect(result.allowed).toBe(true)
    expect(result.comments.map((comment) => comment.displayName)).toEqual(['First', 'Second'])
    expect(result.comments[0]).toMatchObject({ legacyCommentId: 'legacy-1', authorId: '7' })
    expect(mockedLessonAccess).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ memberId: 42, lessonId: 11 }))
  })

  it('fails closed for blocked or non-enrolled members before listing comments', async () => {
    denyLesson()
    const payload = makePayload()
    const result = await listLessonDiscussion(payload.payload as never, 42, 11)

    expect(result).toEqual({ allowed: false, lessonId: null, comments: [] })
    expect(payload.find).not.toHaveBeenCalled()
  })

  it('creates a visible top-level comment for an entitled active member and audits it', async () => {
    allowLesson()
    const payload = makePayload()
    const body = plainTextLessonCommentBody('A new lesson comment')

    const result = await createLessonComment(payload.payload as never, {
      memberId: 42,
      lessonId: 11,
      body: body as never,
    })

    expect(result.document).toMatchObject({
      lesson: 11,
      author: 42,
      displayName: 'Member Example',
      moderationStatus: 'visible',
    })
    const commentCreate = payload.created.find((entry) => entry.collection === 'payload_lesson_comments')
    expect(commentCreate?.data.parent).toBeUndefined()
    const auditCreate = payload.created.find((entry) => entry.collection === 'payload_audit_events')
    expect(auditCreate?.data.action).toBe('lesson_comment.created')
  })

  it('creates a reply only when the parent is visible and belongs to the same lesson', async () => {
    allowLesson()
    const payload = makePayload({
      parent: {
        id: 9,
        lesson: 11,
        author: 7,
        moderationStatus: 'visible',
      },
    })

    const result = await createLessonComment(payload.payload as never, {
      memberId: 42,
      lessonId: 11,
      parentId: 9,
      body: plainTextLessonCommentBody('Reply') as never,
    })

    expect(result.document).toMatchObject({ parent: 9, lesson: 11 })
    const auditCreate = payload.created.find((entry) => entry.collection === 'payload_audit_events')
    expect(auditCreate?.data.action).toBe('lesson_comment.reply.created')
  })

  it('rejects a reply whose parent belongs to another lesson', async () => {
    allowLesson()
    const payload = makePayload({
      parent: {
        id: 9,
        lesson: 99,
        author: 7,
        moderationStatus: 'visible',
      },
    })

    await expect(createLessonComment(payload.payload as never, {
      memberId: 42,
      lessonId: 11,
      parentId: 9,
      body: plainTextLessonCommentBody('Wrong lesson') as never,
    })).rejects.toThrow('same lesson')

    expect(payload.created.some((entry) => entry.collection === 'payload_lesson_comments')).toBe(false)
  })

  it('rejects a reply to a hidden historical comment', async () => {
    allowLesson()
    const payload = makePayload({
      parent: {
        id: 9,
        lesson: 11,
        author: 7,
        moderationStatus: 'hidden',
      },
    })

    await expect(createLessonComment(payload.payload as never, {
      memberId: 42,
      lessonId: 11,
      parentId: 9,
      body: plainTextLessonCommentBody('Hidden parent') as never,
    })).rejects.toThrow('visible comments')
  })

  it('rate limits rapid lesson comment creation using the same five-per-minute policy as community comments', async () => {
    allowLesson()
    const now = new Date().toISOString()
    const payload = makePayload({
      comments: Array.from({ length: 5 }, (_, index) => ({
        id: index + 1,
        author: 42,
        lesson: 11,
        createdAt: now,
      })),
    })

    await expect(createLessonComment(payload.payload as never, {
      memberId: 42,
      lessonId: 11,
      body: plainTextLessonCommentBody('Too many') as never,
    })).rejects.toThrow('rate limit')
  })
})
