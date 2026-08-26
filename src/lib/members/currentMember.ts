import type { getPayload } from 'payload'

import type { PayloadDocument } from '@/lib/payloadCourse/accessService'

export type CurrentPayloadMember = PayloadDocument & {
  collection?: string
  email?: string
  accountStatus?: string
  source?: string
  emailVerifiedAt?: string | Date | null
}

type SignInEligibleMember = Pick<CurrentPayloadMember, 'accountStatus' | 'source' | 'emailVerifiedAt'>

export function isEligibleCurrentMember(member: SignInEligibleMember | null | undefined): boolean {
  // Active members must also have emailVerifiedAt set. This matches the gate
  // in identityDestination.resolveMember so that portal eligibility is
  // consistent with the login decision. Admin-invited members receive
  // emailVerifiedAt at the moment they complete their invitation setup.
  if (member?.accountStatus === 'active') return Boolean(member.emailVerifiedAt)
  return (
    member?.accountStatus === 'pending' &&
    member.source === 'self_signup' &&
    Boolean(member.emailVerifiedAt)
  )
}

export function resolveEligibleMemberAccountStatus(
  member: SignInEligibleMember | null | undefined,
): string | null {
  return isEligibleCurrentMember(member) ? 'active' : member?.accountStatus ?? null
}

async function recordCurrentMemberLogin(
  payload: Awaited<ReturnType<typeof getPayload>>,
  memberId: string | number,
): Promise<void> {
  try {
    if (!payload.db?.updateOne) return
    await payload.db.updateOne({
      collection: 'payload_members',
      id: memberId,
      data: {
        lastLoginAt: new Date().toISOString(),
      },
    })
  } catch {
    // Last-login metadata should not block an otherwise valid member session.
  }
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

  await recordCurrentMemberLogin(payload, freshMember.id)

  return {
    member: {
      ...freshMember,
      collection: 'payload_members',
    },
    payload,
  }
}
