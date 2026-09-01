import 'server-only'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { cachedResolvePayloadRequestSession } from '@/lib/auth/payloadSession'
import { MEMBER_COLLECTION } from '@/lib/auth/payloadSessionMapping'
import { ensureAdministratorMemberIdentity } from '@/lib/auth/adminMemberIdentity'
import { decideSharedLogin } from '@/lib/auth/sharedLoginDecision'
import { getCachedPayload } from '@/lib/payload/getPayload'
import { PortalAdminActionError } from '@/lib/portalAdmin/actionResult'
import type { PayloadCourseAccessAPI } from '@/lib/payloadCourse/accessService'
import {
  derivePortalCapabilities,
  type AdminActor,
  type MemberActor,
  type PortalActor,
  type PortalCapabilities,
} from '@/lib/auth/portalActor'
import { ensureMemberProfileNameNotification } from '@/lib/payloadCourse/memberNotifications'

export type PortalAccessContext = {
  actor: PortalActor
  payload: PayloadCourseAccessAPI
  capabilities: PortalCapabilities
}

export type PortalAccessOptions = {
	redirectOnFailure?: boolean
}

/**
 * Allows active verified members AND authenticated payload_users admins.
 *
 * Admins bypass decideSharedLogin entirely: resolveIdentityDestination blocks
 * an admin requesting the 'member' domain (requested_domain_unavailable), so
 * going through the shared routing layer would silently deny every admin. We
 * check session.administratorId first and return an AdminActor directly.
 *
 * Keep requirePortalMember for routes/actions that must be member-only.
 */
export async function requirePortalAccess(
  requestedPath = '/portal',
  options: PortalAccessOptions = {},
): Promise<PortalAccessContext> {
  const requestHeaders = await headers()
  const session = await cachedResolvePayloadRequestSession(requestHeaders)

  if (session.administratorId && !session.unresolvedCollection) {
    const payload = await getCachedPayload()
    const administrator = await payload.findByID({
      collection: 'payload_users',
      id: session.administratorId,
      depth: 0,
      overrideAccess: true,
    })
    const identity = await ensureAdministratorMemberIdentity(payload as never, administrator as never)
    const actor: AdminActor = {
      kind: 'admin',
      administratorId: String(session.administratorId),
      email: typeof administrator?.email === 'string' ? administrator.email : undefined,
      memberId: identity?.member ? String(identity.member.id) : undefined,
    }
    if (identity?.member) {
      try { await ensureMemberProfileNameNotification(payload as never, String(identity.member.id)) } catch { /* profile reminder is non-blocking */ }
    }
    return {
      actor,
      payload: payload as unknown as PayloadCourseAccessAPI,
      capabilities: derivePortalCapabilities(actor),
    }
  }

  const decision = decideSharedLogin(session, requestedPath)

  if (
    !decision.allowed ||
    decision.identity.kind !== 'member' ||
    !session.member?.id
  ) {
    if (options.redirectOnFailure === false) {
      throw new PortalAdminActionError('unauthorized', 'Please sign in and try again.')
    }
    redirect(`/portal?mode=login&next=${encodeURIComponent(requestedPath)}`)
  }

  const payload = await getCachedPayload()
  const member = await payload.findByID({
    collection: 'payload_members',
    id: session.member.id,
    overrideAccess: false,
    user: { id: session.member.id, collection: MEMBER_COLLECTION },
  })

  const memberEmail = typeof member?.email === 'string' ? member.email : ''
  if (!memberEmail) {
    if (options.redirectOnFailure === false) {
      throw new PortalAdminActionError('unauthorized', 'Please sign in and try again.')
    }
    redirect(`/portal?mode=login&next=${encodeURIComponent(requestedPath)}`)
  }

  const actor: MemberActor = {
    kind: 'member',
    memberId: String(session.member.id),
    email: memberEmail,
  }

  try { await ensureMemberProfileNameNotification(payload as never, String(session.member.id)) } catch { /* profile reminder is non-blocking */ }
  return {
    actor,
    payload: payload as unknown as PayloadCourseAccessAPI,
    capabilities: derivePortalCapabilities(actor),
  }
}
