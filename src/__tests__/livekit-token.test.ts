/**
 * Tests for POST /api/livekit/token
 *
 * Contract:
 *  - Body: { sessionId: string }
 *  - Auth: Payload session cookie (not billing token)
 *  - Role derived from session.hostUser — NOT from client
 *  - Response body: { ok: true, roomName, wsUrl } — NO token
 *  - Token delivered via httpOnly Set-Cookie livekit_room_token
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

// Mock billing helpers that GET still uses but POST does not touch
vi.mock('@/lib/billing-portal-token', () => ({
  verifyBillingPortalToken: vi.fn(),
}))

vi.mock('@/lib/plans', () => ({
  normalizePlan: vi.fn((p: string) => p),
}))

const mockFindByID = vi.fn()
const mockAuth = vi.fn()

vi.mock('payload', () => ({
  getPayload: vi.fn(async () => ({
    auth: mockAuth,
    findByID: mockFindByID,
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

const HOST_MEMBER_AUTH = {
  user: { id: 'host-999', collection: 'payload_members', email: 'host@example.com' },
}

const LIVE_SESSION = {
  id: 'session-1',
  status: 'live',
  roomName: 'room-abc',
  hostUser: { id: 'host-999' },
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
    mockAuth.mockResolvedValue(ACTIVE_MEMBER_AUTH)
    // Even without auth we get 400 before auth check when sessionId absent
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
    mockFindByID.mockResolvedValue({ ...LIVE_SESSION, status: 'ended' })
    const req = makeRequest({ sessionId: 'session-1' })
    const res = await postLiveKitToken(req)
    const data = await res.json()
    expect(res.status).toBe(403)
    expect(data.reason).toBe('session_closed')
  })

  it('returns 403 when session status is cancelled', async () => {
    mockAuth.mockResolvedValue(ACTIVE_MEMBER_AUTH)
    mockFindByID.mockResolvedValue({ ...LIVE_SESSION, status: 'cancelled' })
    const req = makeRequest({ sessionId: 'session-1' })
    const res = await postLiveKitToken(req)
    const data = await res.json()
    expect(res.status).toBe(403)
    expect(data.reason).toBe('session_closed')
  })

  it('returns { ok, roomName, wsUrl } with NO token in body for a valid member', async () => {
    mockAuth.mockResolvedValue(ACTIVE_MEMBER_AUTH)
    mockFindByID.mockResolvedValue(LIVE_SESSION)
    const req = makeRequest({ sessionId: 'session-1' })
    const res = await postLiveKitToken(req)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.roomName).toBe('room-abc')
    expect(data.wsUrl).toBe('wss://livekit-test.example.com')
    // Token MUST NOT appear in the response body
    expect(data.token).toBeUndefined()
    expect(data.jwt).toBeUndefined()
  })

  it('sets Set-Cookie header with livekit_room_token', async () => {
    mockAuth.mockResolvedValue(ACTIVE_MEMBER_AUTH)
    mockFindByID.mockResolvedValue(LIVE_SESSION)
    const req = makeRequest({ sessionId: 'session-1' })
    const res = await postLiveKitToken(req)
    expect(res.status).toBe(200)
    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain('livekit_room_token=')
    expect(setCookie).toContain('HttpOnly')
  })

  it('sets canPublish=false for a non-host member', async () => {
    const { buildLiveKitToken } = await import('@/lib/livekit-config')
    const spy = vi.mocked(buildLiveKitToken)
    mockAuth.mockResolvedValue(ACTIVE_MEMBER_AUTH) // id='member-123', NOT the hostUser
    mockFindByID.mockResolvedValue(LIVE_SESSION)   // hostUser.id='host-999'
    const req = makeRequest({ sessionId: 'session-1' })
    await postLiveKitToken(req)
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        grant: expect.objectContaining({ canPublish: false }),
      }),
      expect.anything()
    )
  })

  it('sets canPublish=true when user is the session hostUser', async () => {
    const { buildLiveKitToken } = await import('@/lib/livekit-config')
    const spy = vi.mocked(buildLiveKitToken)
    mockAuth.mockResolvedValue(HOST_MEMBER_AUTH)   // id='host-999'
    mockFindByID.mockResolvedValue(LIVE_SESSION)   // hostUser.id='host-999'
    const req = makeRequest({ sessionId: 'session-1' })
    await postLiveKitToken(req)
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        grant: expect.objectContaining({ canPublish: true }),
      }),
      expect.anything()
    )
  })

  it('falls back to session-{id} roomName when session has no roomName', async () => {
    mockAuth.mockResolvedValue(ACTIVE_MEMBER_AUTH)
    mockFindByID.mockResolvedValue({ id: 'session-1', status: 'live', hostUser: null })
    const req = makeRequest({ sessionId: 'session-1' })
    const res = await postLiveKitToken(req)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.roomName).toBe('session-session-1')
  })

  it('accepts payload_users (admin) collection', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'admin-1', collection: 'payload_users', email: 'admin@example.com' },
    })
    mockFindByID.mockResolvedValue(LIVE_SESSION)
    const req = makeRequest({ sessionId: 'session-1' })
    const res = await postLiveKitToken(req)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
  })
})
