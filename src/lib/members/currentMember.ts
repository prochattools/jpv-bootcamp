import config from '@payload-config'
import { headers } from 'next/headers'
import { getPayload } from 'payload'

import type { PayloadDocument } from '@/lib/payloadCourse/accessService'

export type CurrentPayloadMember = PayloadDocument & {
  collection?: string
  email?: string
  accountStatus?: string
  emailVerifiedAt?: string | Date | null
}

export async function getCurrentPayloadMember(): Promise<{
  member: CurrentPayloadMember | null
  payload: Awaited<ReturnType<typeof getPayload>>
}> {
  const payload = await getPayload({ config })
  const auth = await payload.auth({ headers: await headers() })
  const user = auth.user as CurrentPayloadMember | null | undefined

  if (!user || user.collection !== 'payload_members') {
    return { member: null, payload }
  }

  return { member: user, payload }
}
