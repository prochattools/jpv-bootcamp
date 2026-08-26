import { describe, expect, it, vi } from 'vitest'

import {
  MEMBER_COVER_IMAGE_MAX_BYTES,
  removeMemberCoverImage,
  uploadMemberCoverImage,
  validateMemberCoverUpload,
} from '@/lib/members/memberCoverImage'
import { getMemberAccountOverview } from '@/lib/payloadCourse/memberPortal'

function testFile({
  name = 'cover.jpg',
  type = 'image/jpeg',
  size = 128,
}: {
  name?: string
  type?: string
  size?: number
} = {}) {
  return {
    name,
    type,
    size,
    async arrayBuffer() {
      return new Uint8Array(Math.max(1, Math.min(size, 1024))).buffer
    },
  }
}

function makeCoverPayload({
  accountStatus = 'active',
  emailVerifiedAt = '2026-08-01T00:00:00.000Z',
  existingCover = 10 as number | null,
} = {}) {
  const profile = {
    id: 7,
    member: 42,
    displayName: 'Member Example',
    coverImage: existingCover,
  }

  const findByID = vi.fn(async (args: { collection: string }) => {
    if (args.collection === 'payload_members') {
      return {
        id: 42,
        email: 'member@example.test',
        accountStatus,
        source: 'migration',
        emailVerifiedAt,
      }
    }
    throw new Error(`Unexpected findByID: ${args.collection}`)
  })

  const find = vi.fn(async (args: { collection: string }) => {
    if (args.collection === 'payload_member_profiles') return { docs: [profile] }
    return { docs: [] }
  })

  const create = vi.fn(async (args: { collection: string; data?: Record<string, unknown>; file?: unknown }) => {
    if (args.collection === 'payload_media') return { id: 22, url: '/media/new-cover.jpg', ...args.data }
    if (args.collection === 'payload_member_security_events') return { id: 33, ...args.data }
    if (args.collection === 'payload_audit_events') return { id: 44, ...args.data }
    throw new Error(`Unexpected create: ${args.collection}`)
  })

  const update = vi.fn(async (args: { collection: string; id: string | number; data?: Record<string, unknown> }) => {
    if (args.collection === 'payload_member_profiles') {
      return { ...profile, ...args.data, id: args.id }
    }
    throw new Error(`Unexpected update: ${args.collection}`)
  })

  const deleteFn = vi.fn()

  return {
    payload: { findByID, find, create, update, delete: deleteFn },
    findByID,
    find,
    create,
    update,
    deleteFn,
  }
}

describe('member cover image feature parity', () => {
  it('accepts the supported image formats and rejects unsafe/oversized files', () => {
    expect(validateMemberCoverUpload(testFile({ type: 'image/jpeg' }))).toBeNull()
    expect(validateMemberCoverUpload(testFile({ type: 'image/png' }))).toBeNull()
    expect(validateMemberCoverUpload(testFile({ type: 'image/webp' }))).toBeNull()
    expect(validateMemberCoverUpload(testFile({ type: 'image/gif' }))).toBeNull()
    expect(validateMemberCoverUpload(testFile({ type: 'image/svg+xml' }))).toBe('unsupported_type')
    expect(validateMemberCoverUpload(testFile({ type: 'application/pdf' }))).toBe('unsupported_type')
    expect(validateMemberCoverUpload(testFile({ size: 0 }))).toBe('empty_file')
    expect(validateMemberCoverUpload(testFile({ size: MEMBER_COVER_IMAGE_MAX_BYTES + 1 }))).toBe('file_too_large')
  })

  it('uploads and replaces a cover for an eligible member while auditing the change', async () => {
    const fixture = makeCoverPayload({ existingCover: 10 })
    const result = await uploadMemberCoverImage(fixture.payload as never, 42, testFile())

    expect(result).toEqual({ ok: true, mediaId: '22', previousMediaId: '10' })
    const mediaCreate = fixture.create.mock.calls.find((call) => call[0].collection === 'payload_media')?.[0]
    expect(mediaCreate?.data?.alt).toBe('Member Example cover image')
    expect(mediaCreate?.file).toMatchObject({ mimetype: 'image/jpeg', name: 'cover.jpg' })
    expect(fixture.update).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'payload_member_profiles',
      id: 7,
      data: { coverImage: 22 },
    }))
    expect(fixture.create.mock.calls.some((call) => call[0].collection === 'payload_member_security_events')).toBe(true)
    const audit = fixture.create.mock.calls.find((call) => call[0].collection === 'payload_audit_events')?.[0]
    expect(audit?.data?.action).toBe('member.profile.cover.changed')
    expect(fixture.deleteFn).not.toHaveBeenCalled()
  })

  it('removes the profile relationship but deliberately retains the underlying media asset', async () => {
    const fixture = makeCoverPayload({ existingCover: 10 })
    const result = await removeMemberCoverImage(fixture.payload as never, 42)

    expect(result).toEqual({ ok: true, mediaId: null, previousMediaId: '10' })
    expect(fixture.update).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'payload_member_profiles',
      id: 7,
      data: { coverImage: null },
    }))
    expect(fixture.deleteFn).not.toHaveBeenCalled()
    const audit = fixture.create.mock.calls.find((call) => call[0].collection === 'payload_audit_events')?.[0]
    expect(audit?.data?.action).toBe('member.profile.cover.removed')
  })

  it('blocks cover mutations for a deactivated legacy member before any media write', async () => {
    const fixture = makeCoverPayload({ accountStatus: 'blocked', emailVerifiedAt: null })
    const upload = await uploadMemberCoverImage(fixture.payload as never, 42, testFile())
    const remove = await removeMemberCoverImage(fixture.payload as never, 42)

    expect(upload).toEqual({ ok: false, error: 'account_ineligible' })
    expect(remove).toEqual({ ok: false, error: 'account_ineligible' })
    expect(fixture.create).not.toHaveBeenCalled()
    expect(fixture.update).not.toHaveBeenCalled()
  })

  it('projects an imported historical cover through the normal member account overview', async () => {
    const payload = {
      find: vi.fn(async (args: { collection: string }) => {
        if (args.collection === 'payload_member_profiles') {
          return {
            docs: [{
              id: 7,
              member: 42,
              displayName: 'Historical Member',
              timezone: null,
              phone: null,
              company: null,
              coverImage: 99,
            }],
          }
        }
        if (args.collection === 'payload_billing_accounts') return { docs: [] }
        if (args.collection === 'payload_subscriptions') return { docs: [] }
        if (args.collection === 'payload_access_groups') return { docs: [] }
        return { docs: [] }
      }),
      findByID: vi.fn(async (args: { collection: string; id: string | number }) => {
        if (args.collection === 'payload_media' && String(args.id) === '99') {
          return {
            id: 99,
            url: '/media/historical-cover.jpg',
            alt: 'Historical cover',
            filename: 'historical-cover.jpg',
            mimeType: 'image/jpeg',
            filesize: 2048,
          }
        }
        throw new Error(`Unexpected findByID: ${args.collection}`)
      }),
    }

    const overview = await getMemberAccountOverview(payload as never, 42)
    expect(overview.profile?.coverImage).toMatchObject({
      id: '99',
      url: '/media/historical-cover.jpg',
      alt: 'Historical cover',
    })
  })
})
