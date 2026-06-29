import type { getPayload } from 'payload'

import type { PayloadDocument } from '@/lib/payloadCourse/accessService'

export type CurrentPayloadMember = PayloadDocument & {
  collection?: string
  email?: string
  accountStatus?: string
  emailVerifiedAt?: string | Date | null
}

export function isEligibleCurrentMember(member: Pick<CurrentPayloadMember, 'accountStatus'> | null | undefined): boolean {
  return member?.accountStatus === 'active'
}

export async function getCurrentPayloadMember(): Promise<{
  member: CurrentPayloadMember | null
  payload: Awaited<ReturnType<typeof getPayload>>
}> {
  const [{ default: config }, { headers }, { getPayload: loadPayload }] = await Promise.all([
    import('@payload-config'),
    import('next/headers'),
    import('payload'),
  ])
  const payload = await loadPayload({ config })
  const auth = await payload.auth({ headers: await headers() })
  const user = auth.user as unknown as CurrentPayloadMember | null | undefined

  if (!user || user.collection !== 'payload_members' || !user.id) {
    return { member: null, payload }
  }

  const freshMember = (await payload.findByID({
    collection: 'payload_members',
    id: user.id,
    depth: 0,
    overrideAccess: true,
  })) as unknown as CurrentPayloadMember

  if (!isEligibleCurrentMember(freshMember)) {
    return { member: null, payload }
  }

  return {
    member: {
      ...freshMember,
      collection: 'payload_members',
    },
    payload,
  }
}
