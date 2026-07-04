import type { MemberAccountActionService } from '@/lib/auth/memberAccountActions'
import { normalizeEmail } from '@/lib/normalize-email'
import type {
  PayloadDocument,
  PayloadMemberAuthAPI,
} from '@/lib/payloadCourse/accessService'
import { isEligibleCurrentMember } from '@/lib/members/currentMember'

export type RequestPasswordResetInput = {
  email: string
}

export type RequestPasswordResetResult = {
  ok: true
  message: 'If an eligible account exists, password reset instructions have been sent.'
}

const GENERIC_RESULT: RequestPasswordResetResult = {
  ok: true,
  message: 'If an eligible account exists, password reset instructions have been sent.',
}

export async function requestPasswordReset(
  payload: PayloadMemberAuthAPI,
  actions: MemberAccountActionService,
  input: RequestPasswordResetInput,
): Promise<RequestPasswordResetResult> {
  const email = normalizeEmail(input.email)
  if (!email || email.length > 320) return GENERIC_RESULT

  const existing = await payload.find({
    collection: 'payload_members',
    where: { email: { equals: email } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const member = existing.docs[0]
  if (!member || !isEligibleCurrentMember(member)) return GENERIC_RESULT

  const profileResult = await payload.find({
    collection: 'payload_member_profiles',
    where: { member: { equals: String(member.id) } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const profile = profileResult.docs[0]
  const displayName = typeof profile?.displayName === 'string' ? profile.displayName : null

  const issued = await actions.issueAction({
    memberId: String(member.id),
    email,
    displayName,
    purpose: 'password_reset',
    templateKey: 'member-password-reset',
    actionPath: '/reset-password',
    ttlMs: 60 * 60 * 1000,
  })

  await payload.create({
    collection: 'payload_member_security_events',
    data: {
      member: member.id,
      eventType: 'password_reset_requested',
      source: 'member_request',
      metadata: {
        purpose: 'password_reset',
        delivery: issued.delivery,
      },
    },
    overrideAccess: true,
  })

  return GENERIC_RESULT
}
