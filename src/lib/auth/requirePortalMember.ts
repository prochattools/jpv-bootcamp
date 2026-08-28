import 'server-only'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { cachedResolvePayloadRequestSession } from '@/lib/auth/payloadSession'
import { resolveAdministratorMemberIdentity } from '@/lib/auth/adminMemberIdentity'
import { MEMBER_COLLECTION } from '@/lib/auth/payloadSessionMapping'
import { decideSharedLogin } from '@/lib/auth/sharedLoginDecision'
import { getCachedPayload } from '@/lib/payload/getPayload'
import type { PayloadCourseAccessAPI } from '@/lib/payloadCourse/accessService'

export type PortalMemberContext = {
  memberId: string
  memberEmail: string
  payload: PayloadCourseAccessAPI
}

export async function requirePortalMember(
  requestedPath = '/portal',
): Promise<PortalMemberContext> {
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
    const identity = await resolveAdministratorMemberIdentity(payload as never, administrator as never)
    const memberEmail = typeof identity.member?.email === 'string' ? identity.member.email : ''
    if (!identity.member || !memberEmail) {
      redirect(`/portal?mode=login&next=${encodeURIComponent(requestedPath)}`)
    }
    return {
      memberId: String(identity.member.id),
      memberEmail,
      payload: payload as unknown as PayloadCourseAccessAPI,
    }
  }

  const decision = decideSharedLogin(session, requestedPath)

  if (
    !decision.allowed ||
    decision.identity.kind !== 'member' ||
    !session.member?.id
  ) {
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
    redirect(`/portal?mode=login&next=${encodeURIComponent(requestedPath)}`)
  }

  return {
    memberId: String(session.member.id),
    memberEmail,
    payload: payload as unknown as PayloadCourseAccessAPI,
  }
}
