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

async function preparePayloadPasswordResetToken(
  payload: PayloadMemberAuthAPI,
  memberId: PayloadDocument['id'],
  token: string,
): Promise<void> {
  if (!payload.db?.updateOne) {
    throw new Error('Payload db.updateOne is required for member password reset preparation')
  }

  await payload.db.updateOne({
    collection: 'payload_members',
    id: memberId,
    data: {
      resetPasswordToken: token,
      resetPasswordExpiration: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    },
  })
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

  const action = await actions.findCompletableAction(token, 'password_reset')
  if (action.valid === false) {
    return { ok: false, error: 'invalid_or_expired_token' }
  }

  const member = await payload.findByID({
    collection: 'payload_members',
    id: action.memberId,
    depth: 0,
    overrideAccess: true,
  })
  if (!isEligibleCurrentMember(member)) {
    return { ok: false, error: 'account_ineligible' }
  }

  await preparePayloadPasswordResetToken(payload, member.id, token)
  await payload.resetPassword({
    collection: 'payload_members',
    data: {
      token,
      password: input.password,
    },
    overrideAccess: true,
  })

  const consumeResult = await actions.completeAction(token, 'password_reset')
  if (consumeResult.consumed === false) {
    return { ok: false, error: 'invalid_or_expired_token' }
  }

  const updated = await payload.update({
    collection: 'payload_members',
    id: member.id,
    data: {
      loginAttempts: 0,
      lockUntil: null,
    },
    overrideAccess: true,
    overrideLock: true,
  })

  try {
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

    const email = typeof updated.email === 'string' ? updated.email : action.email
    await queueEmailEvent(payload, {
      toEmail: email,
      templateKey: 'member-password-changed',
      dedupeKey: `member-password-changed:${member.id}:${securityEvent.id}`,
      metadata: {
        memberId: String(member.id),
        purpose: 'password_reset_confirmation',
      },
    })
  } catch {
    // Best effort: password is already changed; side effects must not break the flow
  }

  return { ok: true, member: updated }
}
