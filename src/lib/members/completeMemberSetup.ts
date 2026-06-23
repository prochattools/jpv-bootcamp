import type {
  PayloadDocument,
  PayloadMemberAuthAPI,
} from '@/lib/payloadCourse/accessService'
import { createAuditEvent } from '@/lib/payloadCourse/events'
import {
  completePasswordReset,
  type CompletePasswordResetInput,
} from '@/lib/members/completePasswordReset'

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

function statusOf(member: PayloadDocument): string {
  return typeof member.accountStatus === 'string' ? member.accountStatus : 'pending'
}

export async function completeMemberSetup(
  payload: PayloadMemberAuthAPI,
  input: CompletePasswordResetInput,
): Promise<CompleteMemberSetupResult> {
  const reset = await completePasswordReset(payload, input)
  if (reset.ok === false) {
    return { ok: false, error: reset.error }
  }
  if (!reset.member) return { ok: false, error: 'member_unavailable' }

  const member = await payload.findByID({
    collection: 'payload_members',
    id: reset.member.id,
    depth: 0,
    overrideAccess: true,
  })

  const status = statusOf(member)
  if (status === 'blocked' || status === 'deleted') {
    return { ok: false, error: 'account_ineligible' }
  }

  let savedMember = member
  let activated = false

  if (status === 'pending') {
    savedMember = await payload.update({
      collection: 'payload_members',
      id: member.id,
      data: {
        accountStatus: 'active',
      },
      overrideAccess: true,
    })
    activated = true
  }

  await createAuditEvent(payload, {
    actorType: 'member',
    actorId: savedMember.id,
    action: 'member.setup.completed',
    targetCollection: 'payload_members',
    targetId: savedMember.id,
    before: {
      accountStatus: status,
    },
    after: {
      accountStatus: statusOf(savedMember),
    },
    metadata: {
      activated,
    },
  })

  return { ok: true, activated }
}
