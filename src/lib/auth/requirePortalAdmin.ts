import 'server-only'

import { requirePortalAccess, type PortalAccessContext, type PortalAccessOptions } from '@/lib/auth/requirePortalAccess'
import type { AdminActor } from '@/lib/auth/portalActor'
import { PortalAdminActionError } from '@/lib/portalAdmin/actionResult'
import { privilegedPayloadAccess, type PrivilegedPayloadAccess } from '@/lib/payload/privilegedAccess'
import type { PayloadCourseWriteAPI } from '@/lib/payloadCourse/accessService'

export type PortalAdminContext = Omit<PortalAccessContext, 'actor' | 'payload'> & {
  actor: AdminActor
  payload: PayloadCourseWriteAPI
  privilegedAccess: PrivilegedPayloadAccess
}

/**
 * Narrows a previously resolved portal access context to an administrator.
 * The caller must still enter through requirePortalAccess so authentication
 * and the administrator/member session split remain centralized.
 */
export function assertPortalAdminAccess(access: PortalAccessContext): PortalAdminContext {
  if (access.actor.kind !== 'admin') {
    throw new PortalAdminActionError('forbidden', 'Administrator access is required.')
  }

  return {
    ...access,
    actor: access.actor,
    payload: access.payload as PayloadCourseWriteAPI,
    privilegedAccess: privilegedPayloadAccess(access.actor, 'portal administrator action boundary'),
  }
}

/**
 * Server-side administrator gate for every portal administrator mutation.
 * UI admin mode is presentation state and is never trusted here.
 */
export async function requirePortalAdmin(
  requestedPath = '/portal',
  options: PortalAccessOptions = {},
): Promise<PortalAdminContext> {
  return assertPortalAdminAccess(await requirePortalAccess(requestedPath, options))
}
