import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { POST as postLiveKitToken } from '@/app/api/livekit/token/route'

vi.mock('server-only', () => ({}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers()),
}))
vi.mock('@/lib/livekit-config', () => ({
  getLiveKitConfig: vi.fn(() => ({
    apiKey: 'fixture-key',
    apiSecret: 'fixture-value',
    wsUrl: 'wss://livekit-behavioral.example.com',
  })),
  buildLiveKitToken: vi.fn(() => 'fixture-room-access'),
}))
vi.mock('@/lib/billing-portal-token', () => ({ verifyBillingPortalToken: vi.fn() }))
vi.mock('@/lib/plans', () => ({ normalizePlan: vi.fn((plan: string) => plan) }))

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

function request(body: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/livekit/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const ROOM_NAME = 'jpv-course-course-1-module-general-lesson-general'
const LIVE_SESSION = {
  id: 'session-1',
  status: 'live',
  roomName: ROOM_NAME,
  course: { id: 'course-1' },
  hostUser: { id: 'admin-host' },
}

const MEMBER = {
  user: { id: 'member-1', collection: 'payload_members', email: 'member@example.com' },
}

const HOST = {
  user: { id: 'admin-host', collection: 'payload_users', email: 'host@example.com' },
}

describe('POST /api/livekit/token — operator-to-member delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFind.mockResolvedValue({ docs: [{ id: 'enrollment-1' }] })
  })

  it('rejects unauthenticated users and missing sessions', async () => {
    mockAuth.mockResolvedValue({ user: null })
    let response = await postLiveKitToken(request({ sessionId: 'session-1' }))
    expect(response.status).toBe(401)

    mockAuth.mockResolvedValue(MEMBER)
    mockFindByID.mockRejectedValue(new Error('missing'))
    response = await postLiveKitToken(request({ sessionId: 'missing' }))
    expect(response.status).toBe(404)
    expect((await response.json()).reason).toBe('session_not_found')
  })

  it.each(['completed', 'cancelled', 'ended'])(
    'rejects %s sessions',
    async (status) => {
      mockAuth.mockResolvedValue(MEMBER)
      mockFindByID.mockResolvedValue({ ...LIVE_SESSION, status })

      const response = await postLiveKitToken(request({ sessionId: 'session-1' }))
      expect(response.status).toBe(403)
      expect((await response.json()).reason).toBe('session_closed')
    },
  )

  it('rejects invalid room names and missing course relationships', async () => {
    mockAuth.mockResolvedValue(MEMBER)
    mockFindByID.mockResolvedValue({ ...LIVE_SESSION, roomName: 'Invalid Room!' })
    let response = await postLiveKitToken(request({ sessionId: 'session-1' }))
    expect(response.status).toBe(403)
    expect((await response.json()).reason).toBe('invalid_room_name')

    mockFindByID.mockResolvedValue({ ...LIVE_SESSION, course: null })
    response = await postLiveKitToken(request({ sessionId: 'session-1' }))
    expect(response.status).toBe(403)
    expect((await response.json()).reason).toBe('session_course_missing')
  })

  it('allows members only for live sessions with active course enrollment', async () => {
    mockAuth.mockResolvedValue(MEMBER)
    mockFindByID.mockResolvedValue({ ...LIVE_SESSION, status: 'scheduled' })
    let response = await postLiveKitToken(request({ sessionId: 'session-1' }))
    expect(response.status).toBe(403)
    expect((await response.json()).reason).toBe('session_not_live')

    mockFindByID.mockResolvedValue(LIVE_SESSION)
    mockFind.mockResolvedValue({ docs: [] })
    response = await postLiveKitToken(request({ sessionId: 'session-1' }))
    expect(response.status).toBe(403)
    expect((await response.json()).reason).toBe('not_entitled')
  })

  it('issues an enrolled member token with subscribe-only grants', async () => {
    const { buildLiveKitToken } = await import('@/lib/livekit-config')
    mockAuth.mockResolvedValue(MEMBER)
    mockFindByID.mockResolvedValue(LIVE_SESSION)

    const response = await postLiveKitToken(request({ sessionId: 'session-1' }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toMatchObject({
      ok: true,
      roomName: ROOM_NAME,
      wsUrl: 'wss://livekit-behavioral.example.com',
      token: 'fixture-room-access',
    })
    expect(response.headers.get('set-cookie')).toContain('livekit_room_token=')
    expect(vi.mocked(buildLiveKitToken)).toHaveBeenCalledWith(
      expect.objectContaining({
        grant: expect.objectContaining({
          room: ROOM_NAME,
          roomJoin: true,
          canPublish: false,
          canSubscribe: true,
        }),
      }),
      expect.anything(),
    )
    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'payload_course_enrollments',
        where: {
          and: [
            { member: { equals: 'member-1' } },
            { course: { equals: 'course-1' } },
            { status: { equals: 'active' } },
          ],
        },
      }),
    )
  })

  it('allows only the assigned administrator to join as host', async () => {
    const { buildLiveKitToken } = await import('@/lib/livekit-config')
    mockAuth.mockResolvedValue(HOST)
    mockFindByID.mockResolvedValue({ ...LIVE_SESSION, status: 'scheduled' })

    let response = await postLiveKitToken(request({ sessionId: 'session-1' }))
    expect(response.status).toBe(200)
    expect(vi.mocked(buildLiveKitToken)).toHaveBeenCalledWith(
      expect.objectContaining({
        grant: expect.objectContaining({ canPublish: true, roomJoin: true }),
      }),
      expect.anything(),
    )
    expect(mockFind).not.toHaveBeenCalled()

    mockAuth.mockResolvedValue({
      user: { id: 'other-admin', collection: 'payload_users', email: 'other@example.com' },
    })
    response = await postLiveKitToken(request({ sessionId: 'session-1' }))
    expect(response.status).toBe(403)
    expect((await response.json()).reason).toBe('host_required')
  })
})
