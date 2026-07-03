import { randomBytes } from 'node:crypto'

import { sameOriginRequest } from '@/lib/auth/accountActionRouteSafety'
import type { VerificationRequestResult } from '@/lib/auth/memberEmailVerification'
import { normalizeEmail } from '@/lib/normalize-email'
import type { PayloadCourseWriteAPI } from '@/lib/payloadCourse/accessService'
import { createAuditEvent } from '@/lib/payloadCourse/events'

export type RegisterFreeMemberInput = {
  firstName: string
  lastName: string
  email: string
  password: string
  passwordConfirmation: string
  acceptedTerms: boolean
  termsVersion: string
}

export type RegisterFreeMemberResult =
  | { ok: true; status: 'queued'; message: string }
  | { ok: false; status: 400 | 403; error: 'invalid_request' | 'invalid_email' | 'password_too_short' | 'password_mismatch' | 'terms_required' | 'forbidden' }

export type RegistrationVerificationRequester = {
  requestVerification(email: string): Promise<VerificationRequestResult>
}

const GENERIC_MESSAGE = 'If an eligible account exists, verification instructions will be sent.'

function cleanText(value: string, maxLength: number): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

async function findMemberByEmail(payload: PayloadCourseWriteAPI, email: string) {
  const result = await payload.find({
    collection: 'payload_members',
    where: { email: { equals: email } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return result.docs[0] ?? null
}

async function upsertProfile(payload: PayloadCourseWriteAPI, memberId: string, firstName: string, lastName: string) {
  const displayName = [firstName, lastName].filter(Boolean).join(' ').trim() || firstName || lastName || 'Member'
  const existing = await payload.find({
    collection: 'payload_member_profiles',
    where: { member: { equals: memberId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const data: Record<string, unknown> = {
    member: memberId,
    displayName,
    company: null,
    phone: null,
    timezone: null,
    marketingConsent: false,
    transactionalEmailConsent: true,
  }
  return existing.docs[0]
    ? payload.update({
        collection: 'payload_member_profiles',
        id: existing.docs[0].id,
        data,
        overrideAccess: true,
      })
    : payload.create({
        collection: 'payload_member_profiles',
        data,
        overrideAccess: true,
      })
}

export async function registerFreeMember(
  payload: PayloadCourseWriteAPI,
  verification: RegistrationVerificationRequester,
  request: Request,
  input: RegisterFreeMemberInput,
  options?: { now?: Date },
): Promise<RegisterFreeMemberResult> {
  if (!sameOriginRequest(request)) {
    return { ok: false, status: 403, error: 'forbidden' }
  }

  const firstName = cleanText(input.firstName, 60)
  const lastName = cleanText(input.lastName, 60)
  const email = normalizeEmail(input.email)
  const password = input.password ?? ''
  const passwordConfirmation = input.passwordConfirmation ?? ''

  if (!firstName || !lastName) return { ok: false, status: 400, error: 'invalid_request' }
  if (!email || !validEmail(email)) return { ok: false, status: 400, error: 'invalid_email' }
  if (password.length < 12) return { ok: false, status: 400, error: 'password_too_short' }
  if (password !== passwordConfirmation) return { ok: false, status: 400, error: 'password_mismatch' }
  if (!input.acceptedTerms) return { ok: false, status: 400, error: 'terms_required' }

  const existing = await findMemberByEmail(payload, email)
  if (existing) {
    return { ok: true, status: 'queued', message: GENERIC_MESSAGE }
  }

  const member = await payload.create({
    collection: 'payload_members',
    data: {
      email,
      password,
      accountStatus: 'pending',
      source: 'self_signup',
    },
    overrideAccess: true,
  })

  await upsertProfile(payload, String(member.id), firstName, lastName)

  await payload.create({
    collection: 'payload_member_security_events',
    data: {
      member: member.id,
      eventType: 'account_created',
      source: 'member_self_signup',
      metadata: {
        freeTier: true,
        termsAcceptedAt: (options?.now ?? new Date()).toISOString(),
        termsAcceptedVersion: input.termsVersion,
        automaticLogin: false,
      },
    },
    overrideAccess: true,
  })

  await createAuditEvent(payload, {
    actorType: 'member',
    actorId: member.id,
    action: 'member.free_registered',
    targetCollection: 'payload_members',
    targetId: member.id,
    after: {
      accountStatus: 'pending',
      source: 'self_signup',
      freeTier: true,
    },
    metadata: { termsAcceptedVersion: input.termsVersion, freeTier: true },
  })

  await verification.requestVerification(email)

  return { ok: true, status: 'queued', message: GENERIC_MESSAGE }
}
