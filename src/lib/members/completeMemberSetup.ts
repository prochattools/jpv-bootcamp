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

  // Validate the token without consuming it. This allows a safe retry if the
  // member update below fails — the token stays unconsumed so the user can
  // resubmit without getting an "invalid or expired token" error.
  const validation = await actions.findCompletableAction(token, 'member_invitation')

  // Idempotent retry path: the token was already consumed (because this exact
  // setup request succeeded on a prior attempt but the response was lost).
  // If the member is now active we return success rather than an error.
  if (validation.valid !== true) {
    if (validation.reason === 'already_used' && validation.memberId) {
      const priorMember = await payload
        .findByID({
          collection: 'payload_members',
          id: validation.memberId,
          depth: 0,
          overrideAccess: true,
        })
        .catch((): null => null)
      if (priorMember?.accountStatus === 'active') {
        return { ok: true, activated: false }
      }
    }
    return { ok: false, error: 'invalid_or_expired_token' }
  }

  const member = await payload.findByID({
    collection: 'payload_members',
    id: validation.memberId,
    depth: 0,
    overrideAccess: true,
  })
  if (!member) return { ok: false, error: 'member_unavailable' }

  // Concurrent-request idempotency: another in-flight request may have
  // activated this member between our validation and this point.
  if (member.accountStatus === 'active') {
    await actions.completeAction(token, 'member_invitation').catch(() => {})
    return { ok: true, activated: false }
  }

  if (member.accountStatus !== 'pending') {
    return { ok: false, error: 'account_ineligible' }
  }

  const activatedAt = new Date().toISOString()
  const updated = await payload.update({
    collection: 'payload_members',
    id: member.id,
    data: {
      password: input.password,
      accountStatus: 'active',
      // Admin-invited members have their email address implicitly verified by
      // the administrator. Set emailVerifiedAt so that identityDestination
      // allows them to log in immediately after setup.
      emailVerifiedAt: activatedAt,
      loginAttempts: 0,
      lockUntil: null,
    },
    overrideAccess: true,
  })

  // Atomically consume the token after the member record is already active.
  // If a concurrent request consumed it first (already_used) or the token
  // expired in the instant between validation and now (invalid_or_expired),
  // both are safe to ignore because the member is already activated.
  const completion = await actions.completeAction(token, 'member_invitation')

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

    const email =
      typeof updated.email === 'string'
        ? updated.email
        : completion.consumed
          ? completion.email
          : validation.email
    await queueEmailEvent(payload, {
      toEmail: email,
      templateKey: 'member-account-ready',
      dedupeKey: `member-account-ready:${member.id}:${invitationEvent.id}`,
      metadata: {
        memberId: String(member.id),
        purpose: 'member_setup_completed',
      },
    })
  } catch {
    // Best effort: account is already activated; side effects must not break the flow
  }

  return { ok: true, activated: true }
}
