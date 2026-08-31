import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  listParticipants: vi.fn(),
  getLiveKitConfig: vi.fn(() => ({
    apiKey: 'fixture-key',
    apiSecret: 'fixture-secret',
    wsUrl: 'wss://livekit.example.com',
  })),
}))

vi.mock('server-only', () => ({}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({
  getPayload: vi.fn(async () => ({
    find: mocks.find,
    create: mocks.create,
    update: mocks.update,
  })),
}))
vi.mock('livekit-server-sdk', () => ({
  RoomServiceClient: class MockRoomServiceClient {
    listParticipants = mocks.listParticipants
  },
}))
vi.mock('@/lib/livekit-config', () => ({
  getLiveKitConfig: mocks.getLiveKitConfig,
}))

import { provisionMemberFromCheckout } from '@/lib/members/provisionMemberFromCheckout'
import { buildLiveKitToken } from '@/lib/livekit-jwt'
import { getRoomParticipantCount } from '@/lib/rooms/participantCount'

describe('checkout and LiveKit regressions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('marks a newly provisioned checkout member as email verified', async () => {
    mocks.find.mockResolvedValue({ docs: [] })
    mocks.create
      .mockResolvedValueOnce({ id: 'member-1' })
      .mockResolvedValueOnce({ id: 'profile-1' })

    const result = await provisionMemberFromCheckout({ email: ' New@Example.com ' })

    expect(result).toMatchObject({ memberId: 'member-1', created: true })
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'payload_members',
      data: expect.objectContaining({
        email: 'new@example.com',
        accountStatus: 'active',
        emailVerifiedAt: expect.any(String),
        source: 'stripe_checkout',
      }),
      overrideAccess: true,
    }))
  })

  it('prepares credentials for an unclaimed shadow-provisioned checkout member', async () => {
    mocks.find.mockResolvedValue({
      docs: [{ id: 'member-2', accountStatus: 'active', source: 'stripe_checkout', emailVerifiedAt: null, lastLoginAt: null }],
    })

    const result = await provisionMemberFromCheckout({ email: 'member@example.com', issueCredentials: true })

    expect(result).toMatchObject({ memberId: 'member-2', created: false, password: expect.any(String) })
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'payload_members',
      id: 'member-2',
      data: {
        password: expect.any(String),
        emailVerifiedAt: expect.any(String),
      },
      overrideAccess: true,
    }))
  })

  it('does not rotate credentials for a checkout member that has already logged in', async () => {
    mocks.find.mockResolvedValue({
      docs: [{ id: 'member-3', accountStatus: 'active', source: 'stripe_checkout', emailVerifiedAt: '2026-01-01', lastLoginAt: '2026-01-02' }],
    })

    const result = await provisionMemberFromCheckout({ email: 'member@example.com', issueCredentials: true })

    expect(result).toEqual({ memberId: 'member-3', created: false, password: null })
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('reports an uncreated LiveKit room as zero participants', async () => {
    mocks.listParticipants.mockRejectedValueOnce(new Error('requested room does not exist'))

    await expect(getRoomParticipantCount('jpv-live-1788184196-d1b3ec68')).resolves.toBe(0)
  })

  it('keeps unexpected LiveKit failures unavailable', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    mocks.listParticipants.mockRejectedValueOnce(new Error('LiveKit service unavailable'))

    await expect(getRoomParticipantCount('jpv-live-1788184196-d1b3ec68')).resolves.toBeNull()
    expect(warn).toHaveBeenCalledWith('room_participant_count_unavailable', expect.objectContaining({
      roomName: 'jpv-live-1788184196-d1b3ec68',
      error: 'LiveKit service unavailable',
    }))
    warn.mockRestore()
  })

  it('includes data publishing for LiveKit chat without changing media grants', () => {
    const token = buildLiveKitToken(
      {
        identity: 'member-1-device-1',
        name: 'Member',
        grant: {
          room: 'jpv-space-1-123',
          roomJoin: true,
          canPublish: false,
          canPublishData: true,
          canSubscribe: true,
        },
      },
      { apiKey: 'key', apiSecret: 'secret', wsUrl: 'wss://livekit.example.com' },
    )

    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
    expect(payload.video).toMatchObject({
      canPublish: false,
      canPublishData: true,
      canSubscribe: true,
    })
  })
})
