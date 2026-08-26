import 'server-only'

import { cache } from 'react'
import { cookies } from 'next/headers'

import {
  mapPayloadAuthUser,
  MEMBER_COLLECTION,
  type PayloadRequestSession,
} from '@/lib/auth/payloadSessionMapping'
import { resolveEligibleMemberAccountStatus } from '@/lib/members/currentMember'
import { getCachedPayload } from '@/lib/payload/getPayload'

type PayloadMemberRecord = {
  id: string | number
  accountStatus?: string | null
  emailVerifiedAt?: string | Date | null
  source?: string | null
}

export async function resolvePayloadRequestSession(
  requestHeaders: Headers,
): Promise<PayloadRequestSession> {
  const payload = await getCachedPayload()

  // In Next.js server actions the incoming headers() may not include the Cookie
  // header. Fall back to cookies() to ensure payload.auth() can find the session
  // token when the cookie header is absent from the action's request headers.
  let authHeaders = requestHeaders
  const existingCookie = requestHeaders.get('cookie')
  if (!existingCookie) {
    const cookieStore = await cookies()
    const cookiesFromStore = cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join('; ')
    if (cookiesFromStore) {
      const augmented = new Headers(requestHeaders)
      augmented.set('cookie', cookiesFromStore)
      authHeaders = augmented
    }
  }

  const authResult = await payload.auth({ headers: authHeaders })
  const mappedSession = mapPayloadAuthUser(authResult.user)

  if (!mappedSession.member || mappedSession.authenticatedCollection !== MEMBER_COLLECTION) {
    return mappedSession
  }

  const member = (await payload.findByID({
    collection: MEMBER_COLLECTION,
    id: mappedSession.member.id,
    overrideAccess: false,
    user: authResult.user,
  })) as PayloadMemberRecord

  return {
    ...mappedSession,
    member: {
      id: member.id,
      accountStatus: resolveEligibleMemberAccountStatus({
        accountStatus: member.accountStatus ?? null,
        emailVerifiedAt: member.emailVerifiedAt ?? null,
        source: member.source ?? null,
      }),
      emailVerifiedAt: member.emailVerifiedAt ?? null,
    },
  }
}

/**
 * Request-scoped memoised version of resolvePayloadRequestSession. React's
 * cache() deduplicates calls that share the same Headers reference within a
 * single server render pass, so layout.tsx and requirePortalMember can both
 * call this without triggering a second auth + DB round-trip.
 */
export const cachedResolvePayloadRequestSession = cache(resolvePayloadRequestSession)
