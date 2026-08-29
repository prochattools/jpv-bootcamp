import 'server-only'

import type { PortalActor } from '@/lib/auth/portalActor'
import { PortalAdminActionError } from '@/lib/portalAdmin/actionResult'

/**
 * The intentionally narrow access object allowed to cross the privileged
 * Payload boundary. It only carries the access override; collection policy,
 * validation, ownership, and audit behavior remain in the calling service.
 */
export type PrivilegedPayloadAccess = {
  readonly overrideAccess: true
}

/**
 * Creates a named Payload access override after administrator authorization
 * has already been established. Keep calls close to trusted server services;
 * do not use this as a page/component shortcut or as a general Payload wrapper.
 */
export function privilegedPayloadAccess(
  actor: PortalActor,
  reason: string,
): PrivilegedPayloadAccess {
  if (actor.kind !== 'admin') {
    throw new PortalAdminActionError('forbidden', 'Administrator access is required.')
  }
  if (!reason.trim()) {
    throw new PortalAdminActionError('invalid_input', 'A privileged access reason is required.')
  }

  return { overrideAccess: true }
}
