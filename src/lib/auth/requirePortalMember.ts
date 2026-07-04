import 'server-only'

import config from '@payload-config'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { resolvePayloadRequestSession } from '@/lib/auth/payloadSession'
import { decideSharedLogin } from '@/lib/auth/sharedLoginDecision'
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
  const session = await resolvePayloadRequestSession(requestHeaders)
  const decision = decideSharedLogin(session, requestedPath)

  if (
    !decision.allowed ||
    decision.identity.kind !== 'member' ||
    !session.member?.id
  ) {
    redirect(`/portal?mode=login&next=${encodeURIComponent(requestedPath)}`)
  }

  const payload = await getPayload({ config })
  const member = await payload.findByID({
    collection: 'payload_members',
    id: session.member.id,
    overrideAccess: false,
    user: session,
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
