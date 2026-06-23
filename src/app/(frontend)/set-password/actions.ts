'use server'

import config from '@payload-config'
import { getPayload } from 'payload'

import { completeMemberSetup } from '@/lib/members/completeMemberSetup'
import type { PayloadMemberAuthAPI } from '@/lib/payloadCourse/accessService'

export type SetPasswordActionState = {
  ok?: boolean
  error?: string
}

function formString(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value : ''
}

export async function completeMemberSetupAction(
  _previousState: SetPasswordActionState,
  formData: FormData,
): Promise<SetPasswordActionState> {
  const payload = await getPayload({ config })
  const result = await completeMemberSetup(payload as unknown as PayloadMemberAuthAPI, {
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
    if (result.error === 'account_ineligible') {
      return { error: 'This account cannot be activated. Contact support.' }
    }
    return { error: 'This setup link is invalid, expired, or already used.' }
  }

  return { ok: true }
}
