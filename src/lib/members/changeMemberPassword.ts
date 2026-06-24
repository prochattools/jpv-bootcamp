import { normalizeEmail } from '@/lib/normalize-email'
import type {
  PayloadId,
  PayloadMemberAuthAPI,
} from '@/lib/payloadCourse/accessService'

export type ChangeMemberPasswordInput = {
  memberId: PayloadId
  email: string
  currentPassword: string
  newPassword: string
  newPasswordConfirmation: string
}

export type ChangeMemberPasswordResult =
  | { ok: true }
  | {
      ok: false
      error:
        | 'invalid_request'
        | 'password_too_short'
        | 'password_mismatch'
        | 'password_reused'
        | 'invalid_current_password'
        | 'account_ineligible'
    }

function sameId(left: unknown, right: PayloadId): boolean {
  return left !== null && left !== undefined && String(left) === String(right)
}

export async function changeMemberPassword(
  payload: PayloadMemberAuthAPI,
  input: ChangeMemberPasswordInput,
): Promise<ChangeMemberPasswordResult> {
  const email = normalizeEmail(input.email)
  if (!email || !input.currentPassword || !input.newPassword || !input.newPasswordConfirmation) {
    return { ok: false, error: 'invalid_request' }
  }

  if (input.newPassword.length < 12) {
    return { ok: false, error: 'password_too_short' }
  }

  if (input.newPassword !== input.newPasswordConfirmation) {
    return { ok: false, error: 'password_mismatch' }
  }

  let authenticatedMemberId: PayloadId | null = null
  try {
    const loginResult = await payload.login({
      collection: 'payload_members',
      data: {
        email,
        password: input.currentPassword,
      },
      overrideAccess: false,
    })
    authenticatedMemberId = loginResult.user?.id ?? null
  } catch {
    return { ok: false, error: 'invalid_current_password' }
  }

  if (!sameId(authenticatedMemberId, input.memberId)) {
    return { ok: false, error: 'invalid_current_password' }
  }

  if (input.currentPassword === input.newPassword) {
    return { ok: false, error: 'password_reused' }
  }

  const member = await payload.findByID({
    collection: 'payload_members',
    id: input.memberId,
    depth: 0,
    overrideAccess: true,
  })
  if (member.accountStatus !== 'active') {
    return { ok: false, error: 'account_ineligible' }
  }

  await payload.update({
    collection: 'payload_members',
    id: input.memberId,
    data: {
      password: input.newPassword,
    },
    overrideAccess: true,
  })

  await payload.create({
    collection: 'payload_member_security_events',
    data: {
      member: input.memberId,
      eventType: 'password_changed',
      source: 'member_reauthentication',
      metadata: {
        purpose: 'member_password_change',
      },
    },
    overrideAccess: true,
  })

  return { ok: true }
}
