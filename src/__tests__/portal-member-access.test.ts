/**
 * Behavioral tests for portal member access control.
 *
 * Verifies that:
 *   - payloadAccess helpers correctly identify member requests
 *   - requirePayloadAdminOrMemberSelf allows self-access for members
 *   - requirePayloadAdminOrMemberSelf denies access for mismatched member IDs
 *   - Admin users receive unrestricted access
 *   - The session wrapper shape (without collection/id) is NOT treated as a valid user
 *
 * Run with: pnpm exec vitest run src/__tests__/portal-member-access.test.ts
 */

import { describe, it, expect } from 'vitest'
import type { PayloadRequest } from 'payload'

import {
  isPayloadAdminRequest,
  isPayloadMemberRequest,
  getAuthenticatedUserId,
  requirePayloadAdminOrMemberSelf,
} from '@/lib/access/payloadAccess'

function makeReq(user: unknown): PayloadRequest {
  return { user } as unknown as PayloadRequest
}

describe('isPayloadMemberRequest', () => {
  it('returns true for user with collection=payload_members', () => {
    const req = makeReq({ id: '42', collection: 'payload_members' })
    expect(isPayloadMemberRequest(req)).toBe(true)
  })

  it('returns false for user with collection=payload_users', () => {
    const req = makeReq({ id: '42', collection: 'payload_users' })
    expect(isPayloadMemberRequest(req)).toBe(false)
  })

  it('returns false for session wrapper without collection property', () => {
    const sessionWrapper = {
      administratorId: null,
      member: { id: '42', accountStatus: 'active', emailVerifiedAt: '2026-01-01' },
      unresolvedCollection: false,
      authenticatedCollection: 'payload_members',
    }
    const req = makeReq(sessionWrapper)
    expect(isPayloadMemberRequest(req)).toBe(false)
  })

  it('returns false for null user', () => {
    const req = makeReq(null)
    expect(isPayloadMemberRequest(req)).toBe(false)
  })
})

describe('isPayloadAdminRequest', () => {
  it('returns true for admin user', () => {
    const req = makeReq({ id: '1', collection: 'payload_users' })
    expect(isPayloadAdminRequest(req)).toBe(true)
  })

  it('returns false for member user', () => {
    const req = makeReq({ id: '42', collection: 'payload_members' })
    expect(isPayloadAdminRequest(req)).toBe(false)
  })
})

describe('getAuthenticatedUserId', () => {
  it('returns string id for member', () => {
    const req = makeReq({ id: 42, collection: 'payload_members' })
    expect(getAuthenticatedUserId(req)).toBe('42')
  })

  it('returns null for session wrapper missing id', () => {
    const req = makeReq({ member: { id: '42' }, authenticatedCollection: 'payload_members' })
    expect(getAuthenticatedUserId(req)).toBeNull()
  })
})

describe('requirePayloadAdminOrMemberSelf', () => {
  it('allows admin unconditionally', () => {
    const req = makeReq({ id: '1', collection: 'payload_users' })
    const result = requirePayloadAdminOrMemberSelf({ req, id: '42' } as any)
    expect(result).toBe(true)
  })

  it('allows member reading their own document', () => {
    const req = makeReq({ id: '42', collection: 'payload_members' })
    const result = requirePayloadAdminOrMemberSelf({ req, id: '42' } as any)
    expect(result).toBe(true)
  })

  it('denies member reading another member document', () => {
    const req = makeReq({ id: '42', collection: 'payload_members' })
    const result = requirePayloadAdminOrMemberSelf({ req, id: '99' } as any)
    expect(result).toBe(false)
  })

  it('denies session wrapper passed as user (root cause of 403 bug)', () => {
    const sessionWrapper = {
      administratorId: null,
      member: { id: '42', accountStatus: 'active', emailVerifiedAt: '2026-01-01' },
      unresolvedCollection: false,
      authenticatedCollection: 'payload_members',
    }
    const req = makeReq(sessionWrapper)
    const result = requirePayloadAdminOrMemberSelf({ req, id: '42' } as any)
    expect(result).toBe(false)
  })

  it('returns where clause for member list query (no specific id)', () => {
    const req = makeReq({ id: '42', collection: 'payload_members' })
    const result = requirePayloadAdminOrMemberSelf({ req } as any)
    expect(result).toEqual({ id: { equals: '42' } })
  })
})
