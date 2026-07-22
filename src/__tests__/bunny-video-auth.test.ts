/**
 * Behavioral tests for GET /api/bunny/video
 *
 * Covers:
 *  1. Unauthenticated request → 401
 *  2. Authenticated member with active enrollment → 200 + signed URL
 *  3. Authenticated member without enrollment → 403
 *  4. Authenticated admin bypasses enrollment check → 200 + signed URL
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

// Mock Payload module
vi.mock('payload', () => ({
  getPayload: vi.fn(),
}))

// Mock @payload-config (not a real file in test env)
vi.mock('@payload-config', () => ({ default: {} }))

// Pull the mocked functions after registering mocks
const { getPayload } = await import('payload')
const { GET } = await import('@/app/api/bunny/video/route')

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(lessonId: string) {
  return new NextRequest(`http://localhost:3000/api/bunny/video?lessonId=${encodeURIComponent(lessonId)}`)
}

/** Build a minimal mock payload instance for the given auth scenario */
function makeMockPayload(opts: {
  user: { id: string | number; collection: string } | null
  lessonFound?: boolean
  moduleCourseId?: string | null
  enrollmentFound?: boolean
  videoFound?: boolean
}) {
  const {
    user,
    lessonFound = true,
    moduleCourseId = 'course-101',
    enrollmentFound = true,
    videoFound = true,
  } = opts

  // Lesson doc returned by depth:1 query (includes module.course)
  const lessonDocWithModule = {
    id: 'lesson-id-1',
    slug: 'intro-to-course',
    module: moduleCourseId !== null
      ? { id: 'module-id-1', course: moduleCourseId }
      : null,
  }

  // Lesson doc returned by depth:0 query (flat)
  const lessonDocFlat = { id: 'lesson-id-1', slug: 'intro-to-course' }

  // Video record
  const videoDoc = { id: 1, videoId: 42, libraryId: 999 }

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

  // ── 3. Member + no enrollment → 403 ─────────────────────────────────────

  it('authenticated member without enrollment returns 403', async () => {
    const mockPayload = makeMockPayload({
      user: { id: 'member-99', collection: 'payload_members' },
      lessonFound: true,
      moduleCourseId: 'course-101',
      enrollmentFound: false,
    })
    vi.mocked(getPayload).mockResolvedValue(mockPayload as never)

    const res = await GET(makeRequest('intro-to-course'))
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.ok).toBe(false)
    expect(data.reason).toBe('not_entitled')
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
})
