'use server'

import { redirect } from 'next/navigation'

import { resolveMemberVerificationPublicBaseUrl } from '@/lib/auth/memberEmailVerificationApplication'
import { getCurrentPayloadMember } from '@/lib/members/currentMember'

export type MemberPasswordChangeActionState = {
  error?: string
  success?: boolean
}

export async function changeMemberPasswordAction(
  _previousState: MemberPasswordChangeActionState,
  formData: FormData,
): Promise<MemberPasswordChangeActionState> {
  const { member, payload } = await getCurrentPayloadMember()
  if (!member) redirect('/portal?mode=login')

  const email = typeof member.email === 'string' ? member.email : ''
  if (!email) {
    return { error: 'Unable to change your password right now.' }
  }

  const currentPasswordValue = formData.get('currentPassword')
  const newPasswordValue = formData.get('newPassword')
  const confirmationValue = formData.get('newPasswordConfirmation')
  const currentPassword = typeof currentPasswordValue === 'string' ? currentPasswordValue : ''
  const newPassword = typeof newPasswordValue === 'string' ? newPasswordValue : ''
  const newPasswordConfirmation = typeof confirmationValue === 'string' ? confirmationValue : ''

  const { changeMemberPassword } = await import('@/lib/members/changeMemberPassword')
  const result = await changeMemberPassword(
    payload as Parameters<typeof changeMemberPassword>[0],
    {
      memberId: member.id,
      email,
      currentPassword,
      newPassword,
      newPasswordConfirmation,
      baseUrl: resolveMemberVerificationPublicBaseUrl(),
    },
  )

  if (result.ok === true) {
    return { success: true }
  }

  switch (result.error) {
    case 'password_too_short':
      return { error: 'Your new password must be at least 12 characters.' }
    case 'password_mismatch':
      return { error: 'The new passwords do not match.' }
    case 'password_reused':
      return { error: 'Choose a password different from your current password.' }
    case 'invalid_current_password':
      return { error: 'Your current password is incorrect.' }
    case 'account_ineligible':
      return { error: 'Your account cannot change its password right now.' }
    default:
      return { error: 'Unable to change your password right now.' }
  }
}
