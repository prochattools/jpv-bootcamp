/**
 * Behavioral tests for POST /api/livekit/token
 *
 * These tests verify the observable security and functional behaviour of the
 * POST endpoint:
 *
 *  1. Unauthenticated request → 401
 *  2. Authenticated member → { ok, roomName, wsUrl } with NO token in body
 *  3. Response always sets Set-Cookie livekit_room_token
 *  4. Non-host member → canPublish=false
 *  5. Host (session.hostUser matches user.id) → canPublish=true
 *  6. Ended session → 403
 *  7. Non-existent session → 404
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as postLiveKitToken } from '@/app/api/livekit/token/route'

// ---- Mocks -----------------------------------------------------------------

vi.mock('server-only', () => ({}))

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers()),
}))

vi.mock('@/lib/livekit-config', () => ({
  getLiveKitConfig: vi.fn(() => ({
    apiKey: 'test-api-key',
    apiSecret: 'test-api-secret',
    wsUrl: 'wss://livekit-behavioral.example.com',
  })),
  buildLiveKitToken: vi.fn(() => 'behavioral-jwt-token'),
}))

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

const SESSION_LIVE = {
  id: 'sess-42',
  status: 'live',
  roomName: 'behavioral-room',
  hostUser: { id: 'host-uid' },
}

// ---------------------------------------------------------------------------

describe('POST /api/livekit/token — behavioral', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // 1. POST without auth returns 401
  it('POST without auth returns 401', async () => {
    mockAuth.mockResolvedValue({ user: null })
    const res = await postLiveKitToken(makeRequest({ sessionId: 'sess-42' }))
    const data = await res.json()
    expect(res.status).toBe(401)
    expect(data.ok).toBe(false)
    expect(data.reason).toBe('unauthorized')
  })

  // 2. POST with auth returns { ok, roomName, wsUrl } — no token in body
  it('POST with auth returns {ok, roomName, wsUrl} — no token in body', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'member-1', collection: 'payload_members', email: 'user@test.com' },
    })
    mockFindByID.mockResolvedValue(SESSION_LIVE)
    const res = await postLiveKitToken(makeRequest({ sessionId: 'sess-42' }))
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.roomName).toBe('behavioral-room')
    expect(data.wsUrl).toBe('wss://livekit-behavioral.example.com')
    // Token must not leak into the body
    expect(data.token).toBeUndefined()
    expect(data.jwt).toBeUndefined()
    expect(JSON.stringify(data)).not.toContain('behavioral-jwt-token')
  })

  // 3. POST response has Set-Cookie livekit_room_token
  it('POST response has Set-Cookie livekit_room_token', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'member-1', collection: 'payload_members', email: 'user@test.com' },
    })
    mockFindByID.mockResolvedValue(SESSION_LIVE)
    const res = await postLiveKitToken(makeRequest({ sessionId: 'sess-42' }))
    expect(res.status).toBe(200)
    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain('livekit_room_token=')
    expect(setCookie).toContain('HttpOnly')
  })

  // 4. POST sets canPublish=false for non-host member
  it('POST sets canPublish=false for non-host member', async () => {
    const { buildLiveKitToken } = await import('@/lib/livekit-config')
    const spy = vi.mocked(buildLiveKitToken)
    mockAuth.mockResolvedValue({
      user: { id: 'other-member', collection: 'payload_members', email: 'other@test.com' },
    })
    mockFindByID.mockResolvedValue(SESSION_LIVE) // hostUser.id='host-uid' != 'other-member'
    await postLiveKitToken(makeRequest({ sessionId: 'sess-42' }))
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        grant: expect.objectContaining({ canPublish: false }),
      }),
      expect.anything()
    )
  })

  // 5. POST sets canPublish=true for host (session.hostUser matches user.id)
  it('POST sets canPublish=true for host (session.hostUser matches user.id)', async () => {
    const { buildLiveKitToken } = await import('@/lib/livekit-config')
    const spy = vi.mocked(buildLiveKitToken)
    mockAuth.mockResolvedValue({
      user: { id: 'host-uid', collection: 'payload_members', email: 'host@test.com' },
    })
    mockFindByID.mockResolvedValue(SESSION_LIVE) // hostUser.id='host-uid' matches
    await postLiveKitToken(makeRequest({ sessionId: 'sess-42' }))
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        grant: expect.objectContaining({ canPublish: true }),
      }),
      expect.anything()
    )
  })

  // 6. POST to ended session returns 403
  it('POST to ended session returns 403', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'member-1', collection: 'payload_members', email: 'user@test.com' },
    })
    mockFindByID.mockResolvedValue({ ...SESSION_LIVE, status: 'ended' })
    const res = await postLiveKitToken(makeRequest({ sessionId: 'sess-42' }))
    const data = await res.json()
    expect(res.status).toBe(403)
    expect(data.ok).toBe(false)
    expect(data.reason).toBe('session_closed')
  })

  // 7. POST to non-existent session returns 404
  it('POST to non-existent session returns 404', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'member-1', collection: 'payload_members', email: 'user@test.com' },
    })
    mockFindByID.mockRejectedValue(new Error('Not found'))
    const res = await postLiveKitToken(makeRequest({ sessionId: 'does-not-exist' }))
    const data = await res.json()
    expect(res.status).toBe(404)
    expect(data.ok).toBe(false)
    expect(data.reason).toBe('session_not_found')
  })
})
