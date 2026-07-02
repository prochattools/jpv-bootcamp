import type { MemberAccountActionService } from '@/lib/auth/memberAccountActions'
import type { PayloadMemberAuthAPI } from '@/lib/payloadCourse/accessService'
import { createAuditEvent, queueEmailEvent } from '@/lib/payloadCourse/events'
import type { CompletePasswordResetInput } from '@/lib/members/completePasswordReset'

export type CompleteMemberSetupResult =
  | {
      ok: true
      activated: boolean
    }
  | {
      ok: false
      error:
        | 'invalid_request'
        | 'password_too_short'
        | 'password_mismatch'
        | 'invalid_or_expired_token'
        | 'account_ineligible'
        | 'member_unavailable'
    }

export async function completeMemberSetup(
  payload: PayloadMemberAuthAPI,
  actions: MemberAccountActionService,
  input: CompletePasswordResetInput,
): Promise<CompleteMemberSetupResult> {
  const token = input.token.trim()
  if (!token || !input.password || !input.passwordConfirmation) {
    return { ok: false, error: 'invalid_request' }
  }
  if (input.password.length < 12) return { ok: false, error: 'password_too_short' }
  if (input.password !== input.passwordConfirmation) {
    return { ok: false, error: 'password_mismatch' }
  }

  const completion = await actions.completeAction(token, 'member_invitation')
  if (completion.consumed === false) {
    return { ok: false, error: 'invalid_or_expired_token' }
  }

  const member = await payload.findByID({
    collection: 'payload_members',
    id: completion.memberId,
    depth: 0,
    overrideAccess: true,
  })
  if (!member) return { ok: false, error: 'member_unavailable' }
  if (member.accountStatus !== 'pending') {
    return { ok: false, error: 'account_ineligible' }
  }

  const updated = await payload.update({
    collection: 'payload_members',
    id: member.id,
    data: {
      password: input.password,
      accountStatus: 'active',
    },
    overrideAccess: true,
  })

  const invitationEvent = await payload.create({
    collection: 'payload_member_security_events',
    data: {
      member: member.id,
      eventType: 'invitation_consumed',
      source: 'member_invitation',
      metadata: {
        activated: true,
        automaticLogin: false,
      },
    },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'payload_member_security_events',
    data: {
      member: member.id,
      eventType: 'password_changed',
      source: 'member_invitation',
      metadata: {
        purpose: 'set_password',
        automaticLogin: false,
      },
    },
    overrideAccess: true,
  })

  await createAuditEvent(payload, {
    actorType: 'member',
    actorId: member.id,
    action: 'member.setup.completed',
    targetCollection: 'payload_members',
    targetId: member.id,
    before: { accountStatus: 'pending' },
    after: { accountStatus: 'active' },
    metadata: {
      activated: true,
      automaticLogin: false,
      securityEventId: String(invitationEvent.id),
    },
  })

  const email = typeof updated.email === 'string' ? updated.email : completion.email
  await queueEmailEvent(payload, {
    toEmail: email,
    templateKey: 'member-account-ready',
    dedupeKey: `member-account-ready:${member.id}:${invitationEvent.id}`,
    metadata: {
      memberId: String(member.id),
      purpose: 'member_setup_completed',
    },
  })

  return { ok: true, activated: true }
}
