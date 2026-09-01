import 'server-only'

import config from '@payload-config'
import { getPayload } from 'payload'

import { ensureAdministratorMemberIdentity } from '@/lib/auth/adminMemberIdentity'
import { resolvePayloadRequestSession } from '@/lib/auth/payloadSession'
import type { PayloadCourseWriteAPI, PayloadDocument } from '@/lib/payloadCourse/accessService'

export type PortalRequestMember = {
  payload: PayloadCourseWriteAPI
  memberId: string
  memberEmail: string
  displayName: string
  isAdministrator: boolean
}

function fallbackDisplayName(email: string): string {
  const localPart = email.split('@')[0]?.replace(/[._-]+/g, ' ').trim() ?? ''
  return localPart
    ? localPart.split(/\s+/).map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`).join(' ')
    : 'Community member'
}

function memberProfileDisplayName(profile: PayloadDocument | null, email: string): string {
  return typeof profile?.displayName === 'string' && profile.displayName.trim()
    ? profile.displayName.trim().slice(0, 120)
    : fallbackDisplayName(email)
}

async function profileForMember(payload: PayloadCourseWriteAPI, memberId: string): Promise<PayloadDocument | null> {
  const result = await payload.find({
    collection: 'payload_member_profiles',
    where: { member: { equals: memberId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return (result.docs[0] as PayloadDocument | undefined) ?? null
}

/**
 * Resolves both regular member sessions and Payload administrator sessions to
 * the same member-facing identity. Communication endpoints must use this
 * boundary so administrators receive the same persistence, reactions,
 * mentions, and attachment behavior as regular members.
 */
export async function resolvePortalRequestMember(headers: Headers): Promise<PortalRequestMember | null> {
  const session = await resolvePayloadRequestSession(headers)
  const payload = (await getPayload({ config })) as unknown as PayloadCourseWriteAPI

  if (session.administratorId && !session.unresolvedCollection) {
    const administrator = await payload.findByID({
      collection: 'payload_users',
      id: session.administratorId,
      depth: 0,
      overrideAccess: true,
    }) as PayloadDocument | null
    if (!administrator) return null

    const identity = await ensureAdministratorMemberIdentity(payload, administrator)
    if (!identity?.member) return null
    const memberId = String(identity.member.id)
    const memberEmail = typeof identity.member.email === 'string'
      ? identity.member.email.trim()
      : typeof administrator.email === 'string' ? administrator.email.trim() : ''
    const profile = (identity.profile as PayloadDocument | null) ?? await profileForMember(payload, memberId)
    return {
      payload,
      memberId,
      memberEmail,
      displayName: memberProfileDisplayName(profile, memberEmail),
      isAdministrator: true,
    }
  }

  if (!session.member?.id) return null
  const member = await payload.findByID({
    collection: 'payload_members',
    id: session.member.id,
    depth: 0,
    overrideAccess: true,
  }) as PayloadDocument | null
  if (!member || typeof member.email !== 'string' || !member.email.trim()) return null

  const memberId = String(member.id)
  const memberEmail = member.email.trim()
  return {
    payload,
    memberId,
    memberEmail,
    displayName: memberProfileDisplayName(await profileForMember(payload, memberId), memberEmail),
    isAdministrator: member.isAdministrator === true,
  }
}
