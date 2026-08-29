import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { requirePortalAccess } = vi.hoisted(() => ({
  requirePortalAccess: vi.fn(),
}))

vi.mock('@/lib/auth/requirePortalAccess', () => ({
  requirePortalAccess,
}))

import {
  assertPortalAdminAccess,
  requirePortalAdmin,
} from '@/lib/auth/requirePortalAdmin'
import { derivePortalCapabilities } from '@/lib/auth/portalActor'

function accessFor(actor: { kind: 'admin'; administratorId: string } | { kind: 'member'; memberId: string; email: string }) {
  return {
    actor,
    payload: {},
    capabilities: derivePortalCapabilities(actor),
  }
}

describe('portal administrator authorization foundation', () => {
  it('rejects a member even when the client could show admin UI', () => {
    expect(() => assertPortalAdminAccess(accessFor({
      kind: 'member',
      memberId: 'member-1',
      email: 'member@example.com',
    }))).toThrowError(expect.objectContaining({
      code: 'forbidden',
    }))
  })

  it('returns a privileged administrator context for a Payload admin', () => {
    const result = assertPortalAdminAccess(accessFor({
      kind: 'admin',
      administratorId: 'admin-1',
    }))

    expect(result.actor.kind).toBe('admin')
    expect(result.privilegedAccess).toEqual({ overrideAccess: true })
    expect(result.capabilities.isPlatformAdmin).toBe(true)
  })

  it('delegates authentication and path handling to shared portal access', async () => {
    const context = accessFor({ kind: 'admin', administratorId: 'admin-1' })
    requirePortalAccess.mockResolvedValueOnce(context)

    await expect(requirePortalAdmin('/portal/courses')).resolves.toMatchObject({
      actor: context.actor,
      privilegedAccess: { overrideAccess: true },
    })
    expect(requirePortalAccess).toHaveBeenCalledWith('/portal/courses')
  })

  it('does not transform a shared unauthenticated failure into a success', async () => {
    const error = new Error('redirected to login')
    requirePortalAccess.mockRejectedValueOnce(error)

    await expect(requirePortalAdmin('/portal')).rejects.toBe(error)
  })
})
