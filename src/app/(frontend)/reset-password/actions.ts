'use server'

import { getPayloadMemberAccountActionContext } from '@/lib/auth/memberAccountActionApplication'
import { completePasswordReset } from '@/lib/members/completePasswordReset'

export type ResetPasswordActionState = {
  ok?: boolean
  error?: string
}

function formString(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value : ''
}

export async function completePasswordResetAction(
  _previousState: ResetPasswordActionState,
  formData: FormData,
): Promise<ResetPasswordActionState> {
  try {
    const { payload, service } = await getPayloadMemberAccountActionContext()
    const result = await completePasswordReset(payload, service, {
      token: formString(formData.get('token')),
      password: formString(formData.get('password')),
      passwordConfirmation: formString(formData.get('passwordConfirmation')),
    })

    if (result.ok === false) {
      if (result.error === 'password_too_short') {
        return { error: 'Use at least 12 characters.' }
      }
      if (result.error === 'password_mismatch') {
        return { error: 'The password confirmation does not match.' }
      }
      if (result.error === 'invalid_request') {
        return { error: 'Enter and confirm your new password.' }
      }
      return { error: 'This password link is invalid, expired, or already used.' }
    }

    return { ok: true }
  } catch {
    return { error: 'This password link is invalid, expired, or already used.' }
  }
}
