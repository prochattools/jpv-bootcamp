/**
 * Behavioral tests for GET /api/bunny/video
 *
 * Covers:
 *  1. Unauthenticated request → 401
 *  2. Authenticated member with active enrollment → 200 + signed URL
 *  3. Authenticated member without a legacy enrollment → central entitlement result
 *  4. Authenticated admin bypasses member entitlement check → 200 + signed URL
 *  5. Signed URL does not contain the signing key value
 *  6. Valid auth but unknown lessonId → 404
 *
 * Security invariants:
 *  - BUNNY_CDN_KEY / BUNNY_SIGNING_KEY are NEVER present in any response body
 *  - BUNNY_API_KEY is NEVER present in any response body
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// ── Environment setup (must be set before importing the route) ────────────────
// Use placeholder values that bear no resemblance to real credentials
process.env.BUNNY_CDN_KEY = 'test-signing-key-placeholder'
process.env.BUNNY_PULL_ZONE = 'test-pull-zone'
process.env.BUNNY_LIBRARY_ID = '999'

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Mock `next/headers` — the route does `const reqHeaders = await headers()`
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}))

vi.mock('server-only', () => ({}))

// Mock Payload module
vi.mock('payload', () => ({
  getPayload: vi.fn(),
}))

// Mock @payload-config (not a real file in test env)
vi.mock('@payload-config', () => ({ default: {} }))

// Lesson playback must use the same centralized entitlement decision as the
// member lesson page. The service itself is covered by the Payload access
// tests; this route test verifies delegation and the removal of the legacy
// enrollment-only gate.
vi.mock('@/lib/payloadCourse/accessService', async () => {
  const actual = await vi.importActual<typeof import('@/lib/payloadCourse/accessService')>('@/lib/payloadCourse/accessService')
  return {
    ...actual,
    evaluatePayloadLessonAccess: vi.fn(),
  }
})

// Pull the mocked functions after registering mocks
const { getPayload } = await import('payload')
const { evaluatePayloadLessonAccess } = await import('@/lib/payloadCourse/accessService')
const { GET } = await import('@/app/api/bunny/video/route')

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(lessonId: string, videoGuid?: string) {
  const query = new URLSearchParams({ lessonId })
  if (videoGuid) query.set('videoGuid', videoGuid)
  return new NextRequest(`http://localhost:3000/api/bunny/video?${query.toString()}`)
}

function makeContentRequest(kind: 'page' | 'post', slug: string) {
  const key = kind === 'page' ? 'pageSlug' : 'postSlug'
  return new NextRequest(`http://localhost:3000/api/bunny/video?${key}=${encodeURIComponent(slug)}`)
}

function makeContentPayload(kind: 'page' | 'post', found = true) {
  const collection = kind === 'page' ? 'payload_pages' : 'payload_posts'
  const videoDoc = {
    id: 'video-1',
    status: 'ready',
    videoGuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  }

  return {
    auth: vi.fn().mockResolvedValue({
      user: { id: 'member-42', collection: 'payload_members' },
    }),
    find: vi.fn(async (args: { collection: string }) => {
      if (args.collection === collection) {
        return {
          docs: found
            ? [{ id: `${kind}-1`, slug: `published-${kind}`, status: 'published', featuredVideo: 'video-1' }]
            : [],
        }
      }
      return { docs: [] }
    }),
    findByID: vi.fn(async () => videoDoc),
  }
}

/** Build a minimal mock payload instance for the given auth scenario */
function makeMockPayload(opts: {
  user: { id: string | number; collection: string } | null
  lessonFound?: boolean
  moduleCourseId?: string | null
  enrollmentFound?: boolean
  videoFound?: boolean
  inlineVideoGuid?: string | null
}) {
  const {
    user,
    lessonFound = true,
    moduleCourseId = 'course-101',
    enrollmentFound = true,
    videoFound = true,
    inlineVideoGuid = null,
  } = opts

  // Lesson doc returned by depth:1 query (includes module.course)
  const lessonDocWithModule = {
    id: 'lesson-id-1',
    slug: 'intro-to-course',
    module: moduleCourseId !== null
      ? { id: 'module-id-1', course: moduleCourseId }
      : null,
    ...(inlineVideoGuid
      ? {
          content: {
            root: {
              type: 'root',
              children: [
                {
                  type: 'block',
                  fields: {
                    blockType: 'bunnyVideo',
                    videoGuid: inlineVideoGuid,
                    libraryId: 999,
                  },
                },
              ],
            },
          },
        }
      : {}),
  }

  // Lesson doc returned by depth:0 query (flat)
  const lessonDocFlat = { id: 'lesson-id-1', slug: 'intro-to-course' }

  // Video record — videoGuid (UUID) is required by the signed URL builder;
  // videoId and libraryId are kept for backwards-compatibility assertions.
  const videoDoc = { id: 1, videoId: 42, libraryId: 999, videoGuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' }

  // Enrollment record
  const enrollmentDoc = { id: 'enrollment-1', member: String(opts.user?.id ?? ''), course: 'course-101', status: 'active' }

  const findImpl = vi.fn(async (args: { collection: string; depth?: number }) => {
    const { collection, depth } = args

    if (collection === 'payload_lessons' && (depth === 1 || depth === undefined)) {
      // depth:1 call for member entitlement check
      if (depth === 1) {
        return { docs: lessonFound ? [lessonDocWithModule] : [] }
      }
      // depth:0 / no-depth call for final lookup
      return { docs: lessonFound ? [lessonDocFlat] : [] }
    }

    if (collection === 'payload_lessons') {
      return { docs: lessonFound ? [lessonDocFlat] : [] }
    }

    if (collection === 'payload_course_enrollments') {
      return { docs: enrollmentFound ? [enrollmentDoc] : [] }
    }

    if (collection === 'bunny_videos') {
      return { docs: videoFound ? [videoDoc] : [] }
    }

    return { docs: [] }
  })

  return {
    auth: vi.fn().mockResolvedValue({ user }),
    find: findImpl,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/bunny/video — authentication and entitlement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(evaluatePayloadLessonAccess).mockResolvedValue({
      decision: { allowed: true, reason: 'active_member_resource' },
    } as never)
  })

  // ── 1. Unauthenticated → 401 ─────────────────────────────────────────────

  it('anonymous request returns 401', async () => {
    const mockPayload = makeMockPayload({ user: null })
    vi.mocked(getPayload).mockResolvedValue(mockPayload as never)

    const res = await GET(makeRequest('intro-to-course'))
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.ok).toBe(false)
    expect(data.reason).toBe('unauthorized')
  })

  // ── 2. Member + active enrollment → 200 ─────────────────────────────────

  it('authenticated member with enrollment returns signed URL', async () => {
    const mockPayload = makeMockPayload({
      user: { id: 'member-42', collection: 'payload_members' },
      lessonFound: true,
      moduleCourseId: 'course-101',
      enrollmentFound: true,
      videoFound: true,
    })
    vi.mocked(getPayload).mockResolvedValue(mockPayload as never)

    const res = await GET(makeRequest('intro-to-course'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(typeof data.url).toBe('string')
    expect(data.url).toContain('b-cdn.net')
    expect(data.url).toContain('playlist.m3u8')
  })

  // ── 3. Member without legacy enrollment uses central entitlement ─────────

  it('authenticated member without legacy enrollment returns a signed URL when central access allows it', async () => {
    const mockPayload = makeMockPayload({
      user: { id: 'member-99', collection: 'payload_members' },
      lessonFound: true,
      moduleCourseId: 'course-101',
      enrollmentFound: false,
    })
    vi.mocked(getPayload).mockResolvedValue(mockPayload as never)

    const res = await GET(makeRequest('intro-to-course'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(mockPayload.find.mock.calls.some((call) => call[0]?.collection === 'payload_course_enrollments')).toBe(false)
    expect(evaluatePayloadLessonAccess).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ memberId: 'member-99', lessonId: 'lesson-id-1' }),
    )
  })

  // ── 4. Admin bypasses enrollment check → 200 ────────────────────────────

  it('authenticated admin bypasses enrollment check and returns signed URL', async () => {
    const mockPayload = makeMockPayload({
      user: { id: 'admin-1', collection: 'payload_users' },
      lessonFound: true,
      // enrollment would be absent, but admin should never query it
      enrollmentFound: false,
      videoFound: true,
    })
    vi.mocked(getPayload).mockResolvedValue(mockPayload as never)

    const res = await GET(makeRequest('intro-to-course'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(typeof data.url).toBe('string')

    // Verify enrollment collection was never queried for admins
    const enrollmentCall = mockPayload.find.mock.calls.find(
      (call) => call[0]?.collection === 'payload_course_enrollments'
    )
    expect(enrollmentCall).toBeUndefined()
  })

  // ── 5. Signed URL does not contain the signing key ───────────────────────

  it('signed URL does not contain the signing key value in the response', async () => {
    const signingKeyValue = process.env.BUNNY_CDN_KEY as string

    const mockPayload = makeMockPayload({
      user: { id: 'member-42', collection: 'payload_members' },
      lessonFound: true,
      moduleCourseId: 'course-101',
      enrollmentFound: true,
      videoFound: true,
    })
    vi.mocked(getPayload).mockResolvedValue(mockPayload as never)

    const res = await GET(makeRequest('intro-to-course'))
    const rawBody = await res.text()

    // The signing key must never appear verbatim in any response body
    expect(rawBody).not.toContain(signingKeyValue)
    // Confirm we got a real response, not empty
    expect(rawBody.length).toBeGreaterThan(0)
  })

  // ── 6. Unknown lesson → 404 ──────────────────────────────────────────────

  it('lesson not found returns 404', async () => {
    const mockPayload = makeMockPayload({
      user: { id: 'member-42', collection: 'payload_members' },
      lessonFound: false,
    })
    vi.mocked(getPayload).mockResolvedValue(mockPayload as never)

    const res = await GET(makeRequest('nonexistent-lesson'))
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data.ok).toBe(false)
    expect(data.reason).toBe('lesson_not_found')
  })

  it('central entitlement denial fails closed', async () => {
    vi.mocked(evaluatePayloadLessonAccess).mockResolvedValueOnce({
      decision: { allowed: false, reason: 'billing_not_active' },
    } as never)
    const mockPayload = makeMockPayload({
      user: { id: 'member-42', collection: 'payload_members' },
      moduleCourseId: 'course-101',
      videoFound: true,
    })
    vi.mocked(getPayload).mockResolvedValue(mockPayload as never)

    const res = await GET(makeRequest('intro-to-course'))
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.reason).toBe('not_entitled')
  })

  it('authenticated member can play a video linked to a published page', async () => {
    vi.mocked(getPayload).mockResolvedValue(makeContentPayload('page') as never)

    const res = await GET(makeContentRequest('page', 'published-page'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.url).toContain('playlist.m3u8')
  })

  it('authenticated member can play a video linked to a published post', async () => {
    vi.mocked(getPayload).mockResolvedValue(makeContentPayload('post') as never)

    const res = await GET(makeContentRequest('post', 'published-post'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.url).toContain('playlist.m3u8')
  })

  it('missing or unpublished content does not expose linked video', async () => {
    vi.mocked(getPayload).mockResolvedValue(makeContentPayload('page', false) as never)

    const res = await GET(makeContentRequest('page', 'draft-page'))
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data.reason).toBe('content_not_found')
  })

  it('member can play an inline Bunny GUID only when that block exists in the authorized lesson', async () => {
    const inlineGuid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
    const mockPayload = makeMockPayload({
      user: { id: 'member-42', collection: 'payload_members' },
      lessonFound: true,
      moduleCourseId: 'course-101',
      enrollmentFound: true,
      videoFound: true,
      inlineVideoGuid: inlineGuid,
    })
    vi.mocked(getPayload).mockResolvedValue(mockPayload as never)

    const res = await GET(makeRequest('intro-to-course', inlineGuid))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.url).toContain('playlist.m3u8')
    const videoLookup = mockPayload.find.mock.calls.find((call) => call[0]?.collection === 'bunny_videos')
    expect(videoLookup?.[0]?.where).toEqual({ videoGuid: { equals: inlineGuid } })
  })

  it('member cannot request an arbitrary Bunny GUID that is not present in the lesson content', async () => {
    const inlineGuid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
    const arbitraryGuid = 'ffffffff-1111-2222-3333-444444444444'
    const mockPayload = makeMockPayload({
      user: { id: 'member-42', collection: 'payload_members' },
      lessonFound: true,
      moduleCourseId: 'course-101',
      enrollmentFound: true,
      videoFound: true,
      inlineVideoGuid: inlineGuid,
    })
    vi.mocked(getPayload).mockResolvedValue(mockPayload as never)

    const res = await GET(makeRequest('intro-to-course', arbitraryGuid))
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data.reason).toBe('no_video_linked')
    expect(mockPayload.find.mock.calls.some((call) => call[0]?.collection === 'bunny_videos')).toBe(false)
  })

  it('page and post playback reject a videoGuid override', async () => {
    vi.mocked(getPayload).mockResolvedValue(makeContentPayload('page') as never)
    const pageRequest = new NextRequest('http://localhost:3000/api/bunny/video?pageSlug=published-page&videoGuid=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
    const pageRes = await GET(pageRequest)
    const pageData = await pageRes.json()
    expect(pageRes.status).toBe(400)
    expect(pageData.reason).toBe('invalid_video_target')

    vi.mocked(getPayload).mockResolvedValue(makeContentPayload('post') as never)
    const postRequest = new NextRequest('http://localhost:3000/api/bunny/video?postSlug=published-post&videoGuid=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
    const postRes = await GET(postRequest)
    const postData = await postRes.json()
    expect(postRes.status).toBe(400)
    expect(postData.reason).toBe('invalid_video_target')
  })
})
