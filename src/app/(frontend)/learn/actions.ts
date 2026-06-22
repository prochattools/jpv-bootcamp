'use server'

import config from '@payload-config'
import { login, logout } from '@payloadcms/next/auth'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { getCurrentPayloadMember } from '@/lib/members/currentMember'
import { normalizeEmail } from '@/lib/normalize-email'
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
  if (!displayName) {
    return { error: 'Display name is required.' }
  }

  const data = {
    displayName,
    timezone: cleanOptionalText(formData.get('timezone'), 80),
    phone: cleanOptionalText(formData.get('phone'), 40),
    company: cleanOptionalText(formData.get('company'), 100),
  }

  const existing = await payload.find({
    collection: 'payload_member_profiles',
    where: {
      member: { equals: String(member.id) },
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  if (existing.docs[0]) {
    await payload.update({
      collection: 'payload_member_profiles',
      id: existing.docs[0].id,
      data,
      overrideAccess: true,
    })
  } else {
    await payload.create({
      collection: 'payload_member_profiles',
      data: {
        ...data,
        member: member.id,
        marketingConsent: false,
        transactionalEmailConsent: true,
      },
      overrideAccess: true,
    })
  }

  redirect('/learn/account?updated=1')
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
