import { createHash } from 'node:crypto'

import type { MemberAccountActionService } from '@/lib/auth/memberAccountActions'
import { normalizeEmail } from '@/lib/normalize-email'
import type { PayloadId, PayloadMemberAuthAPI } from '@/lib/payloadCourse/accessService'
import { createAuditEvent, queueAndAttemptEmailEvent } from '@/lib/payloadCourse/events'
import { isEligibleCurrentMember } from '@/lib/members/currentMember'
import { resolveJpvLogoUrl } from '@/lib/brand/jpvDesignSystem'

export type RequestMemberEmailChangeInput = {
  memberId: PayloadId
  currentEmail: string
  newEmail: string
  displayName?: string | null
  baseUrl: string
}

export type RequestMemberEmailChangeResult =
  | { ok: true; delivery: 'queued' | 'suppressed' | 'failed'; noticeQueued: boolean }
  | { ok: false; error: 'invalid_email' | 'same_email' | 'email_unavailable' | 'account_ineligible' }

export type CompleteMemberEmailChangeResult =
  | { ok: true; memberId: string }
  | { ok: false; error: 'invalid_or_expired_token' | 'email_unavailable' | 'account_ineligible' }

function validEmail(value: string): boolean {
  return value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function sameId(left: unknown, right: PayloadId): boolean {
  return left !== null && left !== undefined && String(left) === String(right)
}

function emailFingerprint(email: string): string {
  return createHash('sha256').update(email, 'utf8').digest('hex').slice(0, 16)
}

export async function requestMemberEmailChange(
  payload: PayloadMemberAuthAPI,
  actions: MemberAccountActionService,
  input: RequestMemberEmailChangeInput,
): Promise<RequestMemberEmailChangeResult> {
  const currentEmail = normalizeEmail(input.currentEmail)
  const newEmail = normalizeEmail(input.newEmail)
  if (!validEmail(newEmail)) return { ok: false, error: 'invalid_email' }
  if (currentEmail === newEmail) return { ok: false, error: 'same_email' }

  const member = await payload.findByID({
    collection: 'payload_members',
    id: input.memberId,
    depth: 0,
    overrideAccess: true,
  })
  if (
    !isEligibleCurrentMember(member) ||
    typeof member.email !== 'string' ||
    normalizeEmail(member.email) !== currentEmail
  ) {
    return { ok: false, error: 'account_ineligible' }
  }

  const duplicate = await payload.find({
    collection: 'payload_members',
    where: { email: { equals: newEmail } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (duplicate.docs[0] && !sameId(duplicate.docs[0].id, input.memberId)) {
    return { ok: false, error: 'email_unavailable' }
  }

  const issued = await actions.issueAction({
    memberId: String(input.memberId),
    email: newEmail,
    displayName: input.displayName,
    purpose: 'email_change_confirmation',
    templateKey: 'member-email-change-confirmation',
    actionPath: '/api/member-email-change/complete',
    ttlMs: 60 * 60 * 1000,
  })

  const securityEvent = await payload.create({
    collection: 'payload_member_security_events',
    data: {
      member: input.memberId,
      eventType: 'email_change_requested',
      source: 'member_self_service',
      metadata: {
        targetFingerprint: emailFingerprint(newEmail),
        delivery: issued.delivery,
      },
    },
    overrideAccess: true,
  })

  await createAuditEvent(payload, {
    actorType: 'member',
    actorId: input.memberId,
    action: 'member.email.change.requested',
    targetCollection: 'payload_members',
    targetId: input.memberId,
    metadata: {
      targetFingerprint: emailFingerprint(newEmail),
      securityEventId: String(securityEvent.id),
      delivery: issued.delivery,
    },
  })

  let noticeQueued = false
  try {
    const baseUrl = new URL(input.baseUrl)
    const queued = await queueAndAttemptEmailEvent(payload, {
      toEmail: currentEmail,
      templateKey: 'member-email-change-requested',
      dedupeKey: `member-email-change-requested:${input.memberId}:${securityEvent.id}`,
      metadata: {
        memberId: String(input.memberId),
        purpose: 'email_change_request_notice',
        displayName: input.displayName?.trim() || currentEmail.split('@')[0] || 'there',
        logoUrl: resolveJpvLogoUrl(baseUrl),
      },
    })
    noticeQueued = queued.created
  } catch {
    // A notice to the current address must not cancel the confirmation request.
  }

  return { ok: true, delivery: issued.delivery, noticeQueued }
}

export async function completeMemberEmailChange(
  payload: PayloadMemberAuthAPI,
  actions: MemberAccountActionService,
  token: string,
  baseUrl: string,
  now: () => Date = () => new Date(),
): Promise<CompleteMemberEmailChangeResult> {
  const completion = await actions.completeAction(token, 'email_change_confirmation')
  if (completion.consumed === false) {
    return { ok: false, error: 'invalid_or_expired_token' }
  }

  const member = await payload.findByID({
    collection: 'payload_members',
    id: completion.memberId,
    depth: 0,
    overrideAccess: true,
  })
  if (!isEligibleCurrentMember(member) || typeof member.email !== 'string') {
    return { ok: false, error: 'account_ineligible' }
  }

  const duplicate = await payload.find({
    collection: 'payload_members',
    where: { email: { equals: completion.email } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (duplicate.docs[0] && !sameId(duplicate.docs[0].id, member.id)) {
    return { ok: false, error: 'email_unavailable' }
  }

  const oldEmail = normalizeEmail(member.email)
  const changedAt = now().toISOString()
  await payload.update({
    collection: 'payload_members',
    id: member.id,
    data: {
      email: completion.email,
      emailVerifiedAt: changedAt,
    },
    overrideAccess: true,
  })

  const securityEvent = await payload.create({
    collection: 'payload_member_security_events',
    data: {
      member: member.id,
      eventType: 'email_changed',
      source: 'member_email_confirmation',
      metadata: {
        previousFingerprint: emailFingerprint(oldEmail),
        newFingerprint: emailFingerprint(completion.email),
        automaticLogin: false,
      },
    },
    overrideAccess: true,
  })

  await createAuditEvent(payload, {
    actorType: 'member',
    actorId: member.id,
    action: 'member.email.changed',
    targetCollection: 'payload_members',
    targetId: member.id,
    metadata: {
      securityEventId: String(securityEvent.id),
      automaticLogin: false,
    },
  })

  const base = new URL(baseUrl)
  const displayName = oldEmail.split('@')[0] || 'there'
  for (const [recipient, suffix] of [[oldEmail, 'old'], [completion.email, 'new']] as const) {
    try {
      await queueAndAttemptEmailEvent(payload, {
        toEmail: recipient,
        templateKey: 'member-email-changed',
        dedupeKey: `member-email-changed:${member.id}:${securityEvent.id}:${suffix}`,
        metadata: {
          memberId: String(member.id),
          purpose: 'email_change_confirmation_notice',
          displayName,
          logoUrl: resolveJpvLogoUrl(base),
        },
      })
    } catch {
      // Confirmation delivery must not revert a completed, atomically confirmed email change.
    }
  }

  return { ok: true, memberId: String(member.id) }
}
