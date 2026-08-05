import type { MemberAccountActionService } from '@/lib/auth/memberAccountActions'
import type { PayloadMemberAuthAPI } from '@/lib/payloadCourse/accessService'
import { createAuditEvent, queueAndAttemptEmailEvent } from '@/lib/payloadCourse/events'
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

const INVITATION_RESULT_KEY = 'member-active'

function normalizedEmail(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : null
}

async function releaseInvitation(
  actions: MemberAccountActionService,
  token: string,
  reservationNonce: string,
): Promise<void> {
  await actions.releaseAction(token, 'member_invitation', reservationNonce).catch(() => {})
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

  const reservation = await actions.reserveAction(token, 'member_invitation')
  if (reservation.reserved === false) {
    if (
      reservation.reason === 'already_consumed' &&
      reservation.memberId &&
      actions.isCompletedResult(
        token,
        'member_invitation',
        INVITATION_RESULT_KEY,
        reservation.resultFingerprint,
      )
    ) {
      const priorMember = await payload
        .findByID({
          collection: 'payload_members',
          id: reservation.memberId,
          depth: 0,
          overrideAccess: true,
        })
        .catch((): null => null)
      if (
        priorMember?.accountStatus === 'active' &&
        (!reservation.email || normalizedEmail(priorMember.email) === normalizedEmail(reservation.email))
      ) {
        return { ok: true, activated: false }
      }
    }
    return { ok: false, error: 'invalid_or_expired_token' }
  }

  let member
  try {
    member = await payload.findByID({
      collection: 'payload_members',
      id: reservation.memberId,
      depth: 0,
      overrideAccess: true,
    })
  } catch {
    await releaseInvitation(actions, token, reservation.reservationNonce)
    return { ok: false, error: 'member_unavailable' }
  }
  if (!member) {
    await releaseInvitation(actions, token, reservation.reservationNonce)
    return { ok: false, error: 'member_unavailable' }
  }

  if (member.accountStatus === 'active') {
    if (
      reservation.reclaimed &&
      actions.isCompletedResult(
        token,
        'member_invitation',
        INVITATION_RESULT_KEY,
        reservation.resultFingerprint,
      ) &&
      normalizedEmail(member.email) === normalizedEmail(reservation.email)
    ) {
      const recovery = await actions.finalizeAction(
        token,
        'member_invitation',
        reservation.reservationNonce,
        INVITATION_RESULT_KEY,
      )
      if (recovery.finalized) return { ok: true, activated: false }
    }
    await releaseInvitation(actions, token, reservation.reservationNonce)
    return { ok: false, error: 'account_ineligible' }
  }

  if (member.accountStatus !== 'pending') {
    await releaseInvitation(actions, token, reservation.reservationNonce)
    return { ok: false, error: 'account_ineligible' }
  }

  const mutationMarker = await actions.markMutationStarted(
    token,
    'member_invitation',
    reservation.reservationNonce,
    INVITATION_RESULT_KEY,
  )
  if (!mutationMarker.marked) {
    await releaseInvitation(actions, token, reservation.reservationNonce)
    return { ok: false, error: 'invalid_or_expired_token' }
  }

  const activatedAt = new Date().toISOString()
  let updated
  try {
    updated = await payload.update({
      collection: 'payload_members',
      id: member.id,
      data: {
        password: input.password,
        accountStatus: 'active',
        emailVerifiedAt: activatedAt,
        loginAttempts: 0,
        lockUntil: null,
      },
      overrideAccess: true,
    })
  } catch {
    const recovered = await payload
      .findByID({
        collection: 'payload_members',
        id: member.id,
        depth: 0,
        overrideAccess: true,
      })
      .catch((): null => null)
    if (
      recovered?.accountStatus === 'active' &&
      normalizedEmail(recovered.email) === normalizedEmail(reservation.email)
    ) {
      const recovery = await actions.finalizeAction(
        token,
        'member_invitation',
        reservation.reservationNonce,
        INVITATION_RESULT_KEY,
      )
      if (recovery.finalized) return { ok: true, activated: true }
      return { ok: false, error: 'invalid_or_expired_token' }
    }
    await releaseInvitation(actions, token, reservation.reservationNonce)
    return { ok: false, error: 'member_unavailable' }
  }

  const completion = await actions.finalizeAction(
    token,
    'member_invitation',
    reservation.reservationNonce,
    INVITATION_RESULT_KEY,
  )
  if (!completion.finalized) {
    return { ok: false, error: 'invalid_or_expired_token' }
  }

  try {
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
    await queueAndAttemptEmailEvent(payload, {
      toEmail: email,
      templateKey: 'member-account-ready',
      dedupeKey: `member-account-ready:${member.id}:${invitationEvent.id}`,
      metadata: {
        memberId: String(member.id),
        purpose: 'member_setup_completed',
      },
    })
  } catch {
    // Durable activation and action finalization already succeeded. Side effects are best effort.
  }

  return { ok: true, activated: true }
}
