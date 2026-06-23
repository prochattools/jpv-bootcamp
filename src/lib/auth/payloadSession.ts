import 'server-only'

import config from '@payload-config'
import { getPayload } from 'payload'

import {
  mapPayloadAuthUser,
  MEMBER_COLLECTION,
  type PayloadRequestSession,
} from '@/lib/auth/payloadSessionMapping'

type PayloadMemberRecord = {
  id: string | number
  accountStatus?: string | null
  emailVerifiedAt?: string | Date | null
}

export async function resolvePayloadRequestSession(
  requestHeaders: Headers,
): Promise<PayloadRequestSession> {
  const payload = await getPayload({ config })
  const authResult = await payload.auth({ headers: requestHeaders })
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
      accountStatus: member.accountStatus ?? null,
      emailVerifiedAt: member.emailVerifiedAt ?? null,
    },
  }
}
