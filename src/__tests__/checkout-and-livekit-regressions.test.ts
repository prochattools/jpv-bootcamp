import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
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

import { provisionMemberFromCheckout } from '@/lib/members/provisionMemberFromCheckout'
import { buildLiveKitToken } from '@/lib/livekit-jwt'

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

  it('repairs an older checkout member missing email verification', async () => {
    mocks.find.mockResolvedValue({
      docs: [{ id: 'member-2', accountStatus: 'active', source: 'stripe_checkout', emailVerifiedAt: null }],
    })

    const result = await provisionMemberFromCheckout({ email: 'member@example.com' })

    expect(result).toEqual({ memberId: 'member-2', created: false, password: null })
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'payload_members',
      id: 'member-2',
      data: { emailVerifiedAt: expect.any(String) },
      overrideAccess: true,
    }))
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
