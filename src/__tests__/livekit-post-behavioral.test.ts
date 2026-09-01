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
  audience: 'enrolled',
  course: { id: 'course-1' },
  hostUser: { id: 'admin-host' },
}

const MEMBER = {
  user: { id: 'member-1', collection: 'payload_members', email: 'member@example.com' },
}

const HOST = {
  user: { id: 'admin-host', collection: 'payload_users', email: 'host@example.com' },
}

const ACTIVE_MEMBER = {
  id: 'member-1',
  email: 'member@example.com',
  accountStatus: 'active',
  emailVerifiedAt: '2026-01-01',
}

function configureMemberAccess(
  session: Record<string, unknown> = LIVE_SESSION,
  options: { courseEnrollment?: boolean; spaceMembership?: boolean; displayName?: string } = {},
) {
  mockFindByID.mockImplementation(async ({ collection }: { collection: string }) => {
    if (collection === 'live_sessions') return session
    if (collection === 'payload_members') return ACTIVE_MEMBER
    if (collection === 'payload_users') return { id: 'admin-host', email: 'host@example.com' }
    throw new Error(`Unexpected collection: ${collection}`)
  })
  mockFind.mockImplementation(async ({ collection }: { collection: string }) => {
    if (collection === 'payload_room_access') return { docs: [] }
    if (collection === 'payload_member_profiles') return { docs: options.displayName ? [{ displayName: options.displayName }] : [] }
    if (collection === 'payload_course_enrollments') return { docs: options.courseEnrollment ? [{ id: 'enrollment-1' }] : [] }
    if (collection === 'payload_space_memberships') return { docs: options.spaceMembership ? [{ id: 'membership-1' }] : [] }
    if (collection === 'payload_members' || collection === 'payload_users') return { docs: [] }
    throw new Error(`Unexpected collection: ${collection}`)
  })
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

  it('rejects invalid room names and allows targeted unlinked sessions', async () => {
    mockAuth.mockResolvedValue(MEMBER)
    mockFindByID.mockResolvedValue({ ...LIVE_SESSION, roomName: 'Invalid Room!' })
    let response = await postLiveKitToken(request({ sessionId: 'session-1' }))
    expect(response.status).toBe(403)
    expect((await response.json()).reason).toBe('invalid_room_name')

    mockFindByID
      .mockResolvedValueOnce({
        ...LIVE_SESSION,
        course: null,
        space: null,
        roomName: 'jpv-live-1724184000-ab12cd34',
        audience: 'selected',
        targetMemberIds: ['member-1'],
      })
      .mockResolvedValueOnce({ id: 'member-1', email: 'member@example.com', accountStatus: 'active', emailVerifiedAt: '2026-01-01' })
    response = await postLiveKitToken(request({ sessionId: 'session-1' }))
    expect(response.status).toBe(200)
    expect((await response.json()).ok).toBe(true)
  })

  it('allows members only for live sessions with active course enrollment', async () => {
    mockAuth.mockResolvedValue(MEMBER)
    configureMemberAccess({ ...LIVE_SESSION, status: 'scheduled' })
    let response = await postLiveKitToken(request({ sessionId: 'session-1' }))
    expect(response.status).toBe(403)
    expect((await response.json()).reason).toBe('session_not_live')

    configureMemberAccess(LIVE_SESSION)
    response = await postLiveKitToken(request({ sessionId: 'session-1' }))
    expect(response.status).toBe(403)
    expect((await response.json()).reason).toBe('not_entitled')
  })

  it('issues an enrolled member token with subscribe-only grants', async () => {
    const { buildLiveKitToken } = await import('@/lib/livekit-config')
    mockAuth.mockResolvedValue(MEMBER)
    configureMemberAccess(LIVE_SESSION, { courseEnrollment: true, displayName: 'Learner Name' })

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
        name: 'Learner Name',
        grant: expect.objectContaining({
          room: ROOM_NAME,
          roomJoin: true,
          canPublish: false,
          canPublishData: true,
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

  it('issues a space session token with canPublish=true for all members', async () => {
    const { buildLiveKitToken } = await import('@/lib/livekit-config')
    const spaceSession = {
      id: 'space-session-1',
      status: 'live',
      roomName: 'jpv-space-1-1755691200',
      space: { id: 'space-1' },
      course: null,
      hostUser: { id: 'admin-host' },
      audience: 'enrolled',
    }
    mockAuth.mockResolvedValue(MEMBER)
    configureMemberAccess(spaceSession, { spaceMembership: true })

    const response = await postLiveKitToken(request({ sessionId: 'space-session-1' }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(vi.mocked(buildLiveKitToken)).toHaveBeenCalledWith(
      expect.objectContaining({
        grant: expect.objectContaining({ canPublish: true, canPublishData: true, canSubscribe: true }),
      }),
      expect.anything(),
    )
  })

  it('denies space session access to members without space membership', async () => {
    const spaceSession = {
      id: 'space-session-1',
      status: 'live',
      roomName: 'jpv-space-1-1755691200',
      space: { id: 'space-1' },
      course: null,
      hostUser: { id: 'admin-host' },
      audience: 'enrolled',
    }
    mockAuth.mockResolvedValue(MEMBER)
    configureMemberAccess(spaceSession) // no membership

    const response = await postLiveKitToken(request({ sessionId: 'space-session-1' }))
    expect(response.status).toBe(403)
    expect((await response.json()).reason).toBe('not_entitled')
  })

  it('allows only the assigned administrator to join as host', async () => {
    const { buildLiveKitToken } = await import('@/lib/livekit-config')
    mockAuth.mockResolvedValue(HOST)
    mockFindByID.mockImplementation(async ({ collection, id }: { collection: string; id: string }) => {
      if (collection === 'live_sessions') return { ...LIVE_SESSION, status: 'scheduled' }
      if (collection === 'payload_users' && id === 'admin-host') return { id, email: 'host@example.com', portalMember: 'member-host' }
      if (collection === 'payload_users') return { id, email: 'other@example.com' }
      if (collection === 'payload_members' && id === 'member-host') return { id, email: 'host@example.com', accountStatus: 'active', emailVerifiedAt: '2026-01-01' }
      throw new Error(`Unexpected collection: ${collection}`)
    })
    mockFind.mockImplementation(async ({ collection }: { collection: string }) => {
      if (collection === 'payload_member_profiles') return { docs: [{ displayName: 'Host Name' }] }
      if (collection === 'payload_room_access' || collection === 'payload_members') return { docs: [] }
      throw new Error(`Unexpected collection: ${collection}`)
    })

    let response = await postLiveKitToken(request({ sessionId: 'session-1' }))
    expect(response.status).toBe(200)
    expect(vi.mocked(buildLiveKitToken)).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Host Name',
        grant: expect.objectContaining({ canPublish: true, canPublishData: true, roomJoin: true }),
      }),
      expect.anything(),
    )
    expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({ collection: 'payload_member_profiles' }))

    mockAuth.mockResolvedValue({
      user: { id: 'other-admin', collection: 'payload_users', email: 'other@example.com' },
    })
    response = await postLiveKitToken(request({ sessionId: 'session-1' }))
    expect(response.status).toBe(403)
    expect((await response.json()).reason).toBe('not_entitled')
  })
})
