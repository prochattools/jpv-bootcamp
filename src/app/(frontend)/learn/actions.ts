'use server'

import config from '@payload-config'
import { login, logout } from '@payloadcms/next/auth'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { getPayloadMemberAccountActionContext } from '@/lib/auth/memberAccountActionApplication'
import { resolveMemberVerificationPublicBaseUrl } from '@/lib/auth/memberEmailVerificationApplication'
import { requestMemberEmailChange } from '@/lib/members/changeMemberEmail'
import { getCurrentPayloadMember } from '@/lib/members/currentMember'
import { updateMemberProfile } from '@/lib/members/updateMemberProfile'
import { normalizeEmail } from '@/lib/normalize-email'
import type { PayloadCourseWriteAPI, PayloadMemberAuthAPI } from '@/lib/payloadCourse/accessService'
import {
  getMemberLessonDetail,
  markMemberLessonComplete,
} from '@/lib/payloadCourse/memberPortal'

export type MemberLoginActionState = {
  error?: string
  email?: string
}

export type MemberProfileActionState = {
  error?: string
}

export type MemberEmailChangeActionState = {
  error?: string
  submitted?: boolean
  message?: string
}

function formString(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : ''
}

function cleanOptionalText(value: FormDataEntryValue | null, maxLength = 120): string | null {
  const cleaned = formString(value).replace(/\s+/g, ' ').slice(0, maxLength)
  return cleaned || null
}

function safeNextPath(value: FormDataEntryValue | null): string {
  const raw = formString(value)
  if (!raw.startsWith('/')) return '/learn'
  if (raw.startsWith('//')) return '/learn'
  if (!raw.startsWith('/learn')) return '/learn'
  return raw
}

export async function loginMemberAction(
  _previousState: MemberLoginActionState,
  formData: FormData
): Promise<MemberLoginActionState> {
  const emailInput = formString(formData.get('email'))
  const email = normalizeEmail(emailInput)
  const password = formString(formData.get('password'))
  const nextPath = safeNextPath(formData.get('next'))

  if (!email || !password) {
    return {
      error: 'Enter your email and password.',
      email: emailInput,
    }
  }

  let memberId: string | null = null
  try {
    const result = await login({
      collection: 'payload_members',
      config,
      email,
      password,
    })
    memberId = result.user?.id ? String(result.user.id) : null
  } catch {
    return {
      error: 'The email or password is incorrect.',
      email,
    }
  }

  if (memberId) {
    try {
      const payload = await getPayload({ config })
      await payload.update({
        collection: 'payload_members',
        id: memberId,
        data: {
          lastLoginAt: new Date().toISOString(),
        },
        overrideAccess: true,
      })
    } catch {
      // Last-login metadata should not block an otherwise successful login.
    }
  }

  redirect(nextPath)
}

export async function logoutMemberAction() {
  await logout({ config })
  redirect('/learn/login?loggedOut=1')
}

export async function updateMemberProfileAction(
  _previousState: MemberProfileActionState,
  formData: FormData
): Promise<MemberProfileActionState> {
  const { member, payload } = await getCurrentPayloadMember()
  if (!member) {
    redirect('/learn/login?next=/learn/account')
  }

  const displayName = cleanOptionalText(formData.get('displayName'), 80)
  if (!displayName) return { error: 'Display name is required.' }

  const result = await updateMemberProfile(
    payload as unknown as PayloadCourseWriteAPI,
    member.id,
    {
      displayName,
      timezone: cleanOptionalText(formData.get('timezone'), 80),
      phone: cleanOptionalText(formData.get('phone'), 40),
      company: cleanOptionalText(formData.get('company'), 100),
      baseUrl: resolveMemberVerificationPublicBaseUrl(),
    },
  )

  if (!result.ok) return { error: 'Unable to update your profile.' }
  redirect('/learn/account?updated=1')
}

export async function requestMemberEmailChangeAction(
  _previousState: MemberEmailChangeActionState,
  formData: FormData,
): Promise<MemberEmailChangeActionState> {
  const { member, payload } = await getCurrentPayloadMember()
  if (!member) redirect('/learn/login?next=/learn/account')

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
    message: 'Check the new email address for a confirmation link. Your current sign-in email remains active until confirmation.',
  }
}

export async function completeLessonAction(formData: FormData) {
  const courseSlug = formString(formData.get('courseSlug'))
  const lessonSlug = formString(formData.get('lessonSlug'))
  const { member, payload } = await getCurrentPayloadMember()

  if (!member) {
    redirect(`/learn/login?next=/learn/${courseSlug}/${lessonSlug}`)
  }

  if (!courseSlug || !lessonSlug) {
    redirect('/learn')
  }

  const detail = await getMemberLessonDetail(payload, member.id, courseSlug, lessonSlug)
  if (!detail?.lesson) {
    redirect(`/learn/${courseSlug}`)
  }

  if (!detail.allowed || !detail.lesson.title) {
    redirect(`/learn/${courseSlug}/${lessonSlug}?blocked=1`)
  }

  await markMemberLessonComplete(payload, member.id, detail.lesson.id, detail.lesson.title)
  redirect(`/learn/${courseSlug}/${lessonSlug}?completed=1`)
}




export type MemberPasswordChangeActionState = {
  error?: string
  success?: boolean
}

export async function changeMemberPasswordAction(
  _previousState: MemberPasswordChangeActionState,
  formData: FormData,
): Promise<MemberPasswordChangeActionState> {
  const { member, payload } = await getCurrentPayloadMember()
  if (!member) {
    redirect('/learn/login?next=/learn/account')
  }

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
      return { error: 'This account cannot change its password.' }
    default:
      return { error: 'Unable to change your password right now.' }
  }
}
