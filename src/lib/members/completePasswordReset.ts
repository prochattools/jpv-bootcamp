import type { MemberAccountActionService } from '@/lib/auth/memberAccountActions'
import type {
  PayloadDocument,
  PayloadMemberAuthAPI,
} from '@/lib/payloadCourse/accessService'
import { createAuditEvent, queueEmailEvent } from '@/lib/payloadCourse/events'
import { isEligibleCurrentMember } from '@/lib/members/currentMember'

export type CompletePasswordResetInput = {
  token: string
  password: string
  passwordConfirmation: string
}

export type CompletePasswordResetResult =
  | {
      ok: true
      member: PayloadDocument
    }
  | {
      ok: false
      error: 'invalid_request' | 'password_too_short' | 'password_mismatch' | 'invalid_or_expired_token' | 'account_ineligible'
    }

export async function completePasswordReset(
  payload: PayloadMemberAuthAPI,
  actions: MemberAccountActionService,
  input: CompletePasswordResetInput,
): Promise<CompletePasswordResetResult> {
  const token = input.token.trim()
  if (!token || !input.password || !input.passwordConfirmation) {
    return { ok: false, error: 'invalid_request' }
  }
  if (input.password.length < 12) return { ok: false, error: 'password_too_short' }
  if (input.password !== input.passwordConfirmation) {
    return { ok: false, error: 'password_mismatch' }
  }

  const completion = await actions.completeAction(token, 'password_reset')
  if (completion.consumed === false) {
    return { ok: false, error: 'invalid_or_expired_token' }
  }

  const member = await payload.findByID({
    collection: 'payload_members',
    id: completion.memberId,
    depth: 0,
    overrideAccess: true,
  })
  if (!isEligibleCurrentMember(member)) {
    return { ok: false, error: 'account_ineligible' }
  }

  const updated = await payload.update({
    collection: 'payload_members',
    id: member.id,
    data: { password: input.password },
    overrideAccess: true,
  })

  const securityEvent = await payload.create({
    collection: 'payload_member_security_events',
    data: {
      member: member.id,
      eventType: 'password_changed',
      source: 'member_reset',
      metadata: {
        purpose: 'password_reset',
        automaticLogin: false,
      },
    },
    overrideAccess: true,
  })

  await createAuditEvent(payload, {
    actorType: 'member',
    actorId: member.id,
    action: 'member.password.reset.completed',
    targetCollection: 'payload_members',
    targetId: member.id,
    metadata: {
      automaticLogin: false,
      securityEventId: String(securityEvent.id),
    },
  })

  const email = typeof updated.email === 'string' ? updated.email : completion.email
  await queueEmailEvent(payload, {
    toEmail: email,
    templateKey: 'member-password-changed',
    dedupeKey: `member-password-changed:${member.id}:${securityEvent.id}`,
    metadata: {
      memberId: String(member.id),
      purpose: 'password_reset_confirmation',
    },
  })

  return { ok: true, member: updated }
}
