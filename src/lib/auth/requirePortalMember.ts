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
    redirect(`/login?next=${encodeURIComponent(requestedPath)}`)
  }

  const payload = await getPayload({ config })

  return {
    memberId: String(session.member.id),
    payload: payload as unknown as PayloadCourseAccessAPI,
  }
}
