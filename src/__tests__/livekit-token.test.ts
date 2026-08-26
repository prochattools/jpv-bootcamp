/**
 * Tests for POST /api/livekit/token
 *
 * Contract:
 *  - Body: { sessionId: string }
 *  - Auth: Payload session cookie (not billing token)
 *  - Role derived from session.hostUser — NOT from client
 *  - Response body: { ok: true, roomName, wsUrl, token }
 *  - Token delivered via httpOnly Set-Cookie livekit_room_token
 *  - Space sessions: all members canPublish (group call)
 *  - Course sessions: only host canPublish (webinar model)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as postLiveKitToken } from '@/app/api/livekit/token/route'

// ---- Mocks ----------------------------------------------------------------

vi.mock('server-only', () => ({}))

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers()),
}))

vi.mock('@/lib/livekit-config', () => ({
  getLiveKitConfig: vi.fn(() => ({
    apiKey: 'test-api-key',
    apiSecret: 'test-api-secret',
    wsUrl: 'wss://livekit-test.example.com',
  })),
  buildLiveKitToken: vi.fn(() => 'mock-jwt-token-12345'),
}))

vi.mock('@/lib/billing-portal-token', () => ({
  verifyBillingPortalToken: vi.fn(),
}))

vi.mock('@/lib/plans', () => ({
  normalizePlan: vi.fn((p: string) => p),
}))

const mockFindByID = vi.fn()
const mockFind = vi.fn()
const mockAuth = vi.fn()

vi.mock('payload', () => ({
  getPayload: vi.fn(async () => ({
    auth: mockAuth,
    findByID: mockFindByID,
    find: mockFind,
  })),
}))

// ---- Helpers ---------------------------------------------------------------

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/livekit/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const ACTIVE_MEMBER_AUTH = {
  user: { id: 'member-123', collection: 'payload_members', email: 'student@example.com' },
}

const HOST_ADMIN_AUTH = {
  user: { id: 'host-999', collection: 'payload_users', email: 'host@example.com' },
}

const NON_HOST_ADMIN_AUTH = {
  user: { id: 'other-admin', collection: 'payload_users', email: 'other@example.com' },
}

// Space-based live session — used for group call tests
const SPACE_LIVE_SESSION = {
  id: 'session-1',
  status: 'live',
  roomName: 'jpv-space-1-1724184000',
  space: 'space-1',
  course: null,
  hostUser: { id: 'host-999' },
}

// Course-based live session — used for enrollment-based tests
const COURSE_LIVE_SESSION = {
  id: 'session-2',
  status: 'live',
  roomName: 'jpv-course-course-1-module-general-lesson-general',
  course: 'course-1',
  space: null,
  hostUser: { id: 'host-999' },
}

const ACTIVE_MEMBER_DOC = {
  id: 'member-123',
  accountStatus: 'active',
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
  email: 'student@example.com',
}

// ---------------------------------------------------------------------------

describe('POST /api/livekit/token', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new NextRequest('http://localhost:3000/api/livekit/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    })
    const res = await postLiveKitToken(req)
    const data = await res.json()
    expect(res.status).toBe(400)
    expect(data.reason).toBe('invalid_json')
  })

  it('returns 400 when sessionId is missing', async () => {
    mockAuth.mockResolvedValue({ user: null })
    const req = makeRequest({})
    const res = await postLiveKitToken(req)
    const data = await res.json()
    expect(res.status).toBe(400)
    expect(data.reason).toBe('missing_session_id')
  })

  it('returns 401 when user is not authenticated', async () => {
    mockAuth.mockResolvedValue({ user: null })
    const req = makeRequest({ sessionId: 'session-1' })
    const res = await postLiveKitToken(req)
    const data = await res.json()
    expect(res.status).toBe(401)
    expect(data.reason).toBe('unauthorized')
  })

  it('returns 401 when user collection is not payload_members or payload_users', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'x', collection: 'unknown_collection', email: 'x@example.com' },
    })
    const req = makeRequest({ sessionId: 'session-1' })
    const res = await postLiveKitToken(req)
    const data = await res.json()
    expect(res.status).toBe(401)
    expect(data.reason).toBe('unauthorized')
  })

  it('returns 404 when session does not exist', async () => {
    mockAuth.mockResolvedValue(ACTIVE_MEMBER_AUTH)
    mockFindByID.mockRejectedValue(new Error('Not found'))
    const req = makeRequest({ sessionId: 'no-such-session' })
    const res = await postLiveKitToken(req)
    const data = await res.json()
    expect(res.status).toBe(404)
    expect(data.reason).toBe('session_not_found')
  })

  it('returns 403 when session status is ended', async () => {
    mockAuth.mockResolvedValue(ACTIVE_MEMBER_AUTH)
    mockFindByID.mockResolvedValue({ ...SPACE_LIVE_SESSION, status: 'ended' })
    const req = makeRequest({ sessionId: 'session-1' })
    const res = await postLiveKitToken(req)
    const data = await res.json()
    expect(res.status).toBe(403)
    expect(data.reason).toBe('session_closed')
  })

  it('returns 403 when session status is cancelled', async () => {
    mockAuth.mockResolvedValue(ACTIVE_MEMBER_AUTH)
    mockFindByID.mockResolvedValue({ ...SPACE_LIVE_SESSION, status: 'cancelled' })
    const req = makeRequest({ sessionId: 'session-1' })
    const res = await postLiveKitToken(req)
    const data = await res.json()
    expect(res.status).toBe(403)
    expect(data.reason).toBe('session_closed')
  })

  it('returns 403 when session has no course or space', async () => {
    mockAuth.mockResolvedValue(ACTIVE_MEMBER_AUTH)
    mockFindByID.mockResolvedValue({
      id: 'session-x',
      status: 'live',
      roomName: 'jpv-space-1-1000000000',
      course: null,
      space: null,
      hostUser: null,
    })
    const req = makeRequest({ sessionId: 'session-x' })
    const res = await postLiveKitToken(req)
    const data = await res.json()
    expect(res.status).toBe(403)
    expect(data.reason).toBe('session_misconfigured')
  })

  // ---- Space session tests -----------------------------------------------

  describe('space-based group calls', () => {
    it('returns token for active member with space membership', async () => {
      mockAuth.mockResolvedValue(ACTIVE_MEMBER_AUTH)
      mockFindByID
        .mockResolvedValueOnce(SPACE_LIVE_SESSION) // session
        .mockResolvedValueOnce(ACTIVE_MEMBER_DOC)  // member accountStatus check
      mockFind.mockResolvedValue({ docs: [{ id: 'membership-1' }] }) // space membership
      const req = makeRequest({ sessionId: 'session-1' })
      const res = await postLiveKitToken(req)
      const data = await res.json()
      expect(res.status).toBe(200)
      expect(data.ok).toBe(true)
      expect(data.roomName).toBe('jpv-space-1-1724184000')
    })

    it('sets canPublish=true for regular members in space sessions (group call)', async () => {
      const { buildLiveKitToken } = await import('@/lib/livekit-config')
      const spy = vi.mocked(buildLiveKitToken)
      mockAuth.mockResolvedValue(ACTIVE_MEMBER_AUTH)
      mockFindByID
        .mockResolvedValueOnce(SPACE_LIVE_SESSION)
        .mockResolvedValueOnce(ACTIVE_MEMBER_DOC)
      mockFind.mockResolvedValue({ docs: [{ id: 'membership-1' }] })
      const req = makeRequest({ sessionId: 'session-1' })
      await postLiveKitToken(req)
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          grant: expect.objectContaining({ canPublish: true }),
        }),
        expect.anything()
      )
    })

    it('returns 403 for member with blocked account status', async () => {
      mockAuth.mockResolvedValue(ACTIVE_MEMBER_AUTH)
      mockFindByID
        .mockResolvedValueOnce(SPACE_LIVE_SESSION)
        .mockResolvedValueOnce({ ...ACTIVE_MEMBER_DOC, accountStatus: 'blocked' })
      mockFind.mockResolvedValue({ docs: [] })
      const req = makeRequest({ sessionId: 'session-1' })
      const res = await postLiveKitToken(req)
      const data = await res.json()
      expect(res.status).toBe(403)
      expect(data.reason).toBe('not_entitled')
    })

    it('returns 403 for member without space membership', async () => {
      mockAuth.mockResolvedValue(ACTIVE_MEMBER_AUTH)
      mockFindByID
        .mockResolvedValueOnce(SPACE_LIVE_SESSION)
        .mockResolvedValueOnce(ACTIVE_MEMBER_DOC)
      mockFind.mockResolvedValue({ docs: [] }) // no membership
      const req = makeRequest({ sessionId: 'session-1' })
      const res = await postLiveKitToken(req)
      const data = await res.json()
      expect(res.status).toBe(403)
      expect(data.reason).toBe('not_entitled')
    })

    it('returns 403 when space session is not live', async () => {
      mockAuth.mockResolvedValue(ACTIVE_MEMBER_AUTH)
      mockFindByID.mockResolvedValueOnce({ ...SPACE_LIVE_SESSION, status: 'scheduled' })
      const req = makeRequest({ sessionId: 'session-1' })
      const res = await postLiveKitToken(req)
      const data = await res.json()
      expect(res.status).toBe(403)
      expect(data.reason).toBe('session_not_live')
    })

    it('sets roomAdmin=true for the host in a space session', async () => {
      const { buildLiveKitToken } = await import('@/lib/livekit-config')
      const spy = vi.mocked(buildLiveKitToken)
      // host-999 is the admin user who hosts
      mockAuth.mockResolvedValue(HOST_ADMIN_AUTH)
      mockFindByID.mockResolvedValueOnce(SPACE_LIVE_SESSION) // host matches hostUser.id
      const req = makeRequest({ sessionId: 'session-1' })
      await postLiveKitToken(req)
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          grant: expect.objectContaining({ canPublish: true, roomAdmin: true }),
        }),
        expect.anything()
      )
    })

    it('returns 403 for admin who is not the session host', async () => {
      mockAuth.mockResolvedValue(NON_HOST_ADMIN_AUTH)
      mockFindByID.mockResolvedValueOnce(SPACE_LIVE_SESSION) // hostUser.id='host-999', admin.id='other-admin'
      const req = makeRequest({ sessionId: 'session-1' })
      const res = await postLiveKitToken(req)
      const data = await res.json()
      expect(res.status).toBe(403)
      expect(data.reason).toBe('host_required')
    })
  })

  // ---- Course session tests -----------------------------------------------

  describe('course-based sessions', () => {
    it('returns token for member with active course enrollment', async () => {
      mockAuth.mockResolvedValue(ACTIVE_MEMBER_AUTH)
      mockFindByID.mockResolvedValueOnce(COURSE_LIVE_SESSION)
      mockFind.mockResolvedValue({ docs: [{ id: 'enrollment-1' }] })
      const req = makeRequest({ sessionId: 'session-2' })
      const res = await postLiveKitToken(req)
      const data = await res.json()
      expect(res.status).toBe(200)
      expect(data.ok).toBe(true)
    })

    it('sets canPublish=false for non-host member in course session', async () => {
      const { buildLiveKitToken } = await import('@/lib/livekit-config')
      const spy = vi.mocked(buildLiveKitToken)
      mockAuth.mockResolvedValue(ACTIVE_MEMBER_AUTH) // not host
      mockFindByID.mockResolvedValueOnce(COURSE_LIVE_SESSION)
      mockFind.mockResolvedValue({ docs: [{ id: 'enrollment-1' }] })
      const req = makeRequest({ sessionId: 'session-2' })
      await postLiveKitToken(req)
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          grant: expect.objectContaining({ canPublish: false }),
        }),
        expect.anything()
      )
    })

    it('returns 403 for member without enrollment', async () => {
      mockAuth.mockResolvedValue(ACTIVE_MEMBER_AUTH)
      mockFindByID.mockResolvedValueOnce(COURSE_LIVE_SESSION)
      mockFind.mockResolvedValue({ docs: [] }) // no enrollment
      const req = makeRequest({ sessionId: 'session-2' })
      const res = await postLiveKitToken(req)
      const data = await res.json()
      expect(res.status).toBe(403)
      expect(data.reason).toBe('not_entitled')
    })
  })

  // ---- Cookie / general tests --------------------------------------------

  it('sets Set-Cookie header with livekit_room_token', async () => {
    mockAuth.mockResolvedValue(ACTIVE_MEMBER_AUTH)
    mockFindByID
      .mockResolvedValueOnce(SPACE_LIVE_SESSION)
      .mockResolvedValueOnce(ACTIVE_MEMBER_DOC)
    mockFind.mockResolvedValue({ docs: [{ id: 'membership-1' }] })
    const req = makeRequest({ sessionId: 'session-1' })
    const res = await postLiveKitToken(req)
    expect(res.status).toBe(200)
    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain('livekit_room_token=')
    expect(setCookie).toContain('HttpOnly')
  })
})
