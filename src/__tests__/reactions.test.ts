import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/payloadCourse/accessService', async () => {
  const actual = await vi.importActual<typeof import('@/lib/payloadCourse/accessService')>('@/lib/payloadCourse/accessService')
  return {
    ...actual,
    evaluatePayloadSpaceAccess: vi.fn(),
    evaluatePayloadLessonAccess: vi.fn(),
  }
})

import {
  evaluatePayloadLessonAccess,
  evaluatePayloadSpaceAccess,
} from '@/lib/payloadCourse/accessService'
import {
  getLessonCommentReactionSummaries,
  getReactionSummary,
  getSpaceCommentReactionSummaries,
  removeReaction,
  ReactionServiceError,
  setReaction,
  type PayloadReactionWriteAPI,
} from '@/lib/payloadCourse/reactions'

const mockedSpaceAccess = vi.mocked(evaluatePayloadSpaceAccess)
const mockedLessonAccess = vi.mocked(evaluatePayloadLessonAccess)

type Document = Record<string, any> & { id: number }

function idOf(value: unknown): string {
  if (value && typeof value === 'object' && 'id' in value) return String((value as { id: unknown }).id)
  return String(value)
}

function matches(document: Document | null, where: any): boolean {
  if (!document) return false
  if (!where) return true
  if (Array.isArray(where.and)) return where.and.every((condition) => matches(document, condition))
  if (Array.isArray(where.or)) return where.or.some((condition) => matches(document, condition))

  return Object.entries(where).every(([field, condition]: [string, any]) => {
    const value = document[field]
    if ('equals' in condition) return idOf(value) === String(condition.equals)
    if ('greater_than_equal' in condition) return String(value) >= String(condition.greater_than_equal)
    if ('in' in condition) return condition.in.map(String).includes(idOf(value))
    return true
  })
}

function makePayload(initial: Document[] = []) {
  const collections: Record<string, Document[]> = {
    payload_members: [{ id: 42, accountStatus: 'active', emailVerifiedAt: '2026-08-01T00:00:00.000Z', source: 'migration' }],
    payload_space_posts: [{ id: 10, space: 20, moderationStatus: 'visible' }],
    payload_space_comments: [{ id: 12, post: 10, moderationStatus: 'visible' }],
    payload_lesson_comments: [{ id: 11, lesson: 30, moderationStatus: 'visible' }],
    payload_audit_events: [],
    payload_engagement_reactions: initial,
  }
  let nextId = 100
  const findCalls: any[] = []

  const payload = {
    find: vi.fn(async (args: any) => {
      findCalls.push(args)
      return {
        docs: (collections[args.collection] ?? [])
          .filter((document) => matches(document, args.where))
          .slice(0, args.limit ?? Number.MAX_SAFE_INTEGER),
      }
    }),
    findByID: vi.fn(async (args: any) => {
      const document = (collections[args.collection] ?? []).find((candidate) => String(candidate.id) === String(args.id))
      if (!document) throw new Error('not found')
      return document
    }),
    count: vi.fn(async (args: any) => ({
      totalDocs: (collections[args.collection] ?? []).filter((document) => matches(document, args.where)).length,
    })),
    create: vi.fn(async (args: any) => {
      const document = { id: nextId++, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...args.data }
      ;(collections[args.collection] ??= []).push(document)
      return document
    }),
    update: vi.fn(async (args: any) => {
      const document = (collections[args.collection] ?? []).find((candidate) => candidate.id === args.id)
      if (!document) throw new Error('not found')
      Object.assign(document, args.data, { updatedAt: new Date().toISOString() })
      return document
    }),
    delete: vi.fn(async (args: any) => {
      const documents = collections[args.collection] ?? []
      const index = documents.findIndex((candidate) => candidate.id === args.id)
      if (index >= 0) documents.splice(index, 1)
      return { id: args.id }
    }),
  }

  return { payload: payload as unknown as PayloadReactionWriteAPI, collections, findCalls }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedSpaceAccess.mockResolvedValue({ decision: { allowed: true, reason: 'allowed' } as never, resource: { type: 'space', id: '20' } })
  mockedLessonAccess.mockResolvedValue({ decision: { allowed: true, reason: 'allowed' } as never, resource: { type: 'lesson', id: '30' } })
})

describe('P2-05 member reactions', () => {
  it('creates a member-owned post reaction without touching the legacy collection', async () => {
    const { payload, collections } = makePayload()

    const result = await setReaction(payload, 42, { kind: 'space_post', id: 10 }, 'helpful')

    expect(result).toEqual({ operation: 'created', reaction: 'helpful' })
    expect(collections.payload_engagement_reactions).toHaveLength(1)
    expect(collections.payload_engagement_reactions[0]).toMatchObject({
      member: 42,
      reactionType: 'helpful',
      targetKind: 'space_post',
      targetPost: 10,
    })
    expect(payload.create).not.toHaveBeenCalledWith(expect.objectContaining({ collection: 'payload_space_reactions' }))
  })

  it('keeps the reaction successful when the non-critical audit write is unavailable', async () => {
    const { payload, collections } = makePayload()
    const create = payload.create
    payload.create = vi.fn(async (args: any) => {
      if (args.collection === 'payload_audit_events') throw new Error('audit table unavailable')
      return create(args)
    }) as any

    await expect(setReaction(payload, 42, { kind: 'space_post', id: 10 }, 'helpful')).resolves.toEqual({
      operation: 'created',
      reaction: 'helpful',
    })
    expect(collections.payload_engagement_reactions).toHaveLength(1)
  })

  it('keeps the reaction successful when the audit rate-limit read is unavailable', async () => {
    const { payload, collections } = makePayload()
    const find = payload.find
    payload.find = vi.fn(async (args: any) => {
      if (args.collection === 'payload_audit_events') throw new Error('audit table unavailable')
      return find(args)
    }) as any

    await expect(setReaction(payload, 42, { kind: 'space_post', id: 10 }, 'helpful')).resolves.toEqual({
      operation: 'created',
      reaction: 'helpful',
    })
    expect(collections.payload_engagement_reactions).toHaveLength(1)
  })

  it('falls back to find when reaction counts cannot use Payload count', async () => {
    const { payload } = makePayload([
      { id: 1, member: 42, reactionType: 'helpful', targetKind: 'space_post', targetPost: 10 },
    ])
    payload.count = vi.fn(async () => {
      throw new Error('count helper unavailable')
    }) as any

    const summary = await getReactionSummary(payload, 42, { kind: 'space_post', id: 10 })

    expect(summary.totalCount).toBe(1)
    expect(summary.viewerReaction).toBe('helpful')
  })

  it('ignores null and invalid rows when returning a reaction summary', async () => {
    const { payload, collections, findCalls } = makePayload([
      { id: 1, member: 42, reactionType: 'helpful', targetKind: 'space_post', targetPost: 10 },
    ])
    ;(collections.payload_engagement_reactions as unknown[]).push(
      null,
      { id: 2, member: 99, reactionType: null, targetKind: 'space_post', targetPost: 10 },
    )

    const summary = await getReactionSummary(payload, 42, { kind: 'space_post', id: 10 })

    expect(summary.totalCount).toBe(1)
    expect(summary.viewerReaction).toBe('helpful')
    expect(summary.counts[0].count).toBe(1)

    const reactionFinds = findCalls.filter((args) => args.collection === 'payload_engagement_reactions')
    expect(reactionFinds.length).toBeGreaterThan(0)
    expect(reactionFinds.every((args) =>
      args.where.and.some((condition: any) =>
        condition.reactionType?.in?.join(',') === 'helpful,insightful,celebrate',
      ),
    )).toBe(true)
  })

  it('switches reaction type in place and toggles the selected type off', async () => {
    const { payload, collections } = makePayload()

    await setReaction(payload, 42, { kind: 'space_post', id: 10 }, 'helpful')
    await setReaction(payload, 42, { kind: 'space_post', id: 10 }, 'insightful')
    expect(collections.payload_engagement_reactions).toHaveLength(1)
    expect(collections.payload_engagement_reactions[0].reactionType).toBe('insightful')

    const result = await setReaction(payload, 42, { kind: 'space_post', id: 10 }, 'insightful')
    expect(result).toEqual({ operation: 'removed', reaction: null })
    expect(collections.payload_engagement_reactions).toHaveLength(0)
  })

  it('creates a reaction for a visible space comment after checking its parent post access', async () => {
    const { payload, collections } = makePayload()

    const result = await setReaction(payload, 42, { kind: 'space_comment', id: 12 }, 'insightful')

    expect(result).toEqual({ operation: 'created', reaction: 'insightful' })
    expect(collections.payload_engagement_reactions[0]).toMatchObject({
      member: 42,
      reactionType: 'insightful',
      targetKind: 'space_comment',
      targetSpaceComment: 12,
    })
    expect(mockedSpaceAccess).toHaveBeenCalledWith(payload, { memberId: 42, spaceId: '20' })
  })

  it('returns server-derived counts and the authenticated member state', async () => {
    const { payload } = makePayload([
      { id: 1, member: 42, reactionType: 'helpful', targetKind: 'space_post', targetPost: 10 },
      { id: 2, member: 99, reactionType: 'celebrate', targetKind: 'space_post', targetPost: 10 },
    ])

    const summary = await getReactionSummary(payload, 42, { kind: 'space_post', id: 10 })

    expect(summary.totalCount).toBe(2)
    expect(summary.viewerReaction).toBe('helpful')
    expect(summary.counts).toEqual([
      { reactionType: 'helpful', label: 'Helpful', count: 1 },
      { reactionType: 'insightful', label: 'Insightful', count: 0 },
      { reactionType: 'celebrate', label: 'Celebrate', count: 1 },
    ])
  })

  it('batch-loads lesson discussion reaction summaries with one projection', async () => {
    const { payload } = makePayload([
      { id: 1, member: 42, reactionType: 'helpful', targetKind: 'lesson_comment', targetLessonComment: 11 },
      { id: 2, member: 99, reactionType: 'celebrate', targetKind: 'lesson_comment', targetLessonComment: 11 },
    ])

    const summaries = await getLessonCommentReactionSummaries(payload, 42, 30, [11])
    expect(summaries.get('11')).toMatchObject({
      totalCount: 2,
      viewerReaction: 'helpful',
      counts: [
        { reactionType: 'helpful', count: 1 },
        { reactionType: 'insightful', count: 0 },
        { reactionType: 'celebrate', count: 1 },
      ],
    })
    expect(payload.find.mock.calls.filter(([args]) => args.collection === 'payload_engagement_reactions')).toHaveLength(1)
  })

  it('does not expose or mutate nested lesson discussion reactions in v1', async () => {
    const { payload, collections } = makePayload()
    collections.payload_lesson_comments.push({
      id: 13,
      lesson: 30,
      parent: 11,
      moderationStatus: 'visible',
    })

    await expect(
      setReaction(payload, 42, { kind: 'lesson_comment', id: 13 }, 'helpful'),
    ).rejects.toMatchObject<ReactionServiceError>({ code: 'target_not_supported' })

    const summaries = await getLessonCommentReactionSummaries(payload, 42, 30, [11, 13])
    expect([...summaries.keys()]).toEqual(['11'])
  })

  it('batch-loads visible space comment reaction summaries within the parent post', async () => {
    const { payload } = makePayload([
      { id: 1, member: 42, reactionType: 'helpful', targetKind: 'space_comment', targetSpaceComment: 12 },
    ])

    const summaries = await getSpaceCommentReactionSummaries(payload, 42, 10, [12])

    expect(summaries.get('12')).toMatchObject({
      target: { kind: 'space_comment', id: '12' },
      totalCount: 1,
      viewerReaction: 'helpful',
    })
    expect(payload.find.mock.calls.filter(([args]) => args.collection === 'payload_engagement_reactions')).toHaveLength(1)
  })

  it('fails closed for hidden, inaccessible, and unsupported targets', async () => {
    const { payload } = makePayload()
    const post = (await payload.findByID({ collection: 'payload_space_posts', id: 10 })) as any
    post.moderationStatus = 'hidden'
    await expect(setReaction(payload, 42, { kind: 'space_post', id: 10 }, 'helpful')).rejects.toMatchObject<ReactionServiceError>({ code: 'target_hidden' })

    post.moderationStatus = 'visible'
    mockedSpaceAccess.mockResolvedValueOnce({ decision: { allowed: false, reason: 'account_ineligible' } as never })
    await expect(setReaction(payload, 42, { kind: 'space_post', id: 10 }, 'helpful')).rejects.toMatchObject<ReactionServiceError>({ code: 'target_inaccessible' })

    await expect(setReaction(payload, 42, { kind: 'space_comment', id: 99 }, 'helpful')).rejects.toMatchObject<ReactionServiceError>({ code: 'target_not_found' })
  })

  it('does not remove another member reaction', async () => {
    const { payload, collections } = makePayload([
      { id: 1, member: 99, reactionType: 'helpful', targetKind: 'space_post', targetPost: 10 },
    ])

    const result = await removeReaction(
      payload,
      42,
      { kind: 'space_post', id: 10 },
    )

    expect(result).toEqual({ operation: 'removed', reaction: null })
    expect(collections.payload_engagement_reactions).toEqual([
      expect.objectContaining({ id: 1, member: 99, reactionType: 'helpful' }),
    ])
    expect(payload.delete).not.toHaveBeenCalled()
  })

  it('rejects an ineligible member before target mutation', async () => {
    const { payload, collections } = makePayload()
    collections.payload_members.push({
      id: 77,
      accountStatus: 'blocked',
      emailVerifiedAt: '2026-08-01T00:00:00.000Z',
      source: 'migration',
    })

    await expect(
      setReaction(payload, 77, { kind: 'space_post', id: 10 }, 'helpful'),
    ).rejects.toMatchObject<ReactionServiceError>({ code: 'ineligible' })
    expect(payload.create).not.toHaveBeenCalledWith(expect.objectContaining({ collection: 'payload_engagement_reactions' }))
  })

  it('rejects an unauthenticated member before target access is evaluated', async () => {
    const { payload } = makePayload()

    await expect(
      setReaction(payload, 404, { kind: 'space_post', id: 10 }, 'helpful'),
    ).rejects.toMatchObject<ReactionServiceError>({ code: 'unauthenticated' })
    expect(mockedSpaceAccess).not.toHaveBeenCalled()
  })

  it('rejects mutation after the member reaction rate limit is reached', async () => {
    const { payload } = makePayload()
    const auditEvents = Array.from({ length: 30 }, (_, index) => ({
      id: index + 1,
      actorType: 'member',
      actorId: '42',
      action: 'reaction_created',
      createdAt: new Date().toISOString(),
    }))
    payload.create({ collection: 'payload_audit_events', data: auditEvents[0] })
    const collection = (payload as any)
    // Seed the fake audit collection without using a production/runtime write path.
    ;(collection as any).__audit = auditEvents
    const originalFind = payload.find
    payload.find = vi.fn(async (args: any) => {
      if (args.collection === 'payload_audit_events') return { docs: auditEvents }
      return originalFind(args)
    }) as any

    await expect(setReaction(payload, 42, { kind: 'space_post', id: 10 }, 'helpful')).rejects.toMatchObject<ReactionServiceError>({ code: 'rate_limited' })
  })
})
