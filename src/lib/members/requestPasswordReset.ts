import { createHash } from 'node:crypto'

import { normalizeEmail } from '@/lib/normalize-email'
import type {
  PayloadDocument,
  PayloadMemberAuthAPI,
} from '@/lib/payloadCourse/accessService'
import { queueEmailEvent } from '@/lib/payloadCourse/events'

export type RequestPasswordResetInput = {
  email: string
  baseUrl: string
}

export type RequestPasswordResetResult = {
  ok: true
  message: 'If an eligible account exists, password reset instructions have been sent.'
}

const GENERIC_RESULT: RequestPasswordResetResult = {
  ok: true,
  message: 'If an eligible account exists, password reset instructions have been sent.',
}

function tokenFromResult(value: Awaited<ReturnType<PayloadMemberAuthAPI['forgotPassword']>>): string | null {
  if (typeof value === 'string' && value.trim()) return value
  if (value && typeof value === 'object' && typeof value.token === 'string' && value.token.trim()) {
    return value.token
  }
  return null
}

function memberStatus(member: PayloadDocument): string {
  return typeof member.accountStatus === 'string' ? member.accountStatus : 'pending'
}

function actionUrl(baseUrl: string, token: string): string {
  const url = new URL('/reset-password', baseUrl)
  url.searchParams.set('token', token)
  return url.toString()
}

export async function requestPasswordReset(
  payload: PayloadMemberAuthAPI,
  input: RequestPasswordResetInput,
): Promise<RequestPasswordResetResult> {
  const email = normalizeEmail(input.email)
  if (!email) return GENERIC_RESULT

  const existing = await payload.find({
    collection: 'payload_members',
    where: { email: { equals: email } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const member = existing.docs[0]
  if (!member) return GENERIC_RESULT

  const status = memberStatus(member)
  if (status === 'blocked' || status === 'deleted') return GENERIC_RESULT

  const resetResult = await payload.forgotPassword({
    collection: 'payload_members',
    data: { email },
    disableEmail: true,
  })
  const token = tokenFromResult(resetResult)
  if (!token) return GENERIC_RESULT

  await payload.create({
    collection: 'payload_member_security_events',
    data: {
      member: member.id,
      eventType: 'password_reset_requested',
      source: 'member_request',
      metadata: {
        purpose: 'password_reset',
      },
    },
    overrideAccess: true,
  })

  const tokenFingerprint = createHash('sha256').update(token).digest('hex').slice(0, 20)
  await queueEmailEvent(payload, {
    toEmail: email,
    templateKey: 'member-password-reset',
    dedupeKey: `member-password-reset:${member.id}:${tokenFingerprint}`,
    metadata: {
      actionUrl: actionUrl(input.baseUrl, token),
      purpose: 'password_reset',
    },
  })

  return GENERIC_RESULT
}
