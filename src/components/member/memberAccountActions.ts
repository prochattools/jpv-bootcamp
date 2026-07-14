'use server'

import { redirect } from 'next/navigation'

import { getPayloadMemberAccountActionContext } from '@/lib/auth/memberAccountActionApplication'
import { resolveMemberVerificationPublicBaseUrl } from '@/lib/auth/memberEmailVerificationApplication'
import { requestMemberEmailChange } from '@/lib/members/changeMemberEmail'
import { getCurrentPayloadMember } from '@/lib/members/currentMember'
import type { PayloadMemberAuthAPI } from '@/lib/payloadCourse/accessService'

export type MemberEmailChangeActionState = {
  error?: string
  submitted?: boolean
  message?: string
}

export type MemberPasswordChangeActionState = {
  error?: string
  success?: boolean
}

function formString(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : ''
}

export async function requestMemberEmailChangeAction(
  _previousState: MemberEmailChangeActionState,
  formData: FormData,
): Promise<MemberEmailChangeActionState> {
  const { member, payload } = await getCurrentPayloadMember()
  if (!member) redirect('/portal?mode=login')

  const currentEmail = typeof member.email === 'string' ? member.email : ''
  const newEmail = formString(formData.get('newEmail'))
  if (!currentEmail || !newEmail) {
    return { error: 'Enter a valid new email address.' }
  }

  const { service, publicBaseUrl } = await getPayloadMemberAccountActionContext()
  const result = await requestMemberEmailChange(
    payload as unknown as PayloadMemberAuthAPI,
    service,
    {
      memberId: member.id,
      currentEmail,
      newEmail,
      displayName: currentEmail.split('@')[0] || 'Member',
      baseUrl: publicBaseUrl,
    },
  )

  if (result.ok === false) {
    if (result.error === 'same_email') {
      return { error: 'Enter an email address different from your current address.' }
    }
    if (result.error === 'invalid_email') {
      return { error: 'Enter a valid new email address.' }
    }
    return { error: 'That email address cannot be used for this account.' }
  }

  return {
    submitted: true,
    message:
      'Check the new email address for a confirmation link. Your current sign-in email remains active until confirmation.',
  }
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
