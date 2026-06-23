import { createHash, randomBytes } from 'node:crypto'

import { normalizeEmail } from '@/lib/normalize-email'
import type {
  PayloadDocument,
  PayloadId,
  PayloadMemberAuthAPI,
} from '@/lib/payloadCourse/accessService'
import { createAuditEvent, queueEmailEvent } from '@/lib/payloadCourse/events'

export type InviteMemberInput = {
  administratorId: PayloadId
  email: string
  displayName?: string | null
  baseUrl: string
}

export type InviteMemberResult =
  | {
      ok: true
      memberId: string
      created: boolean
      emailQueued: boolean
    }
  | {
      ok: false
      error: 'invalid_email' | 'account_ineligible' | 'token_unavailable'
    }

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function cleanDisplayName(value: string | null | undefined): string | null {
  const cleaned = (value ?? '').replace(/\s+/g, ' ').trim().slice(0, 80)
  return cleaned || null
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

function memberEmail(member: PayloadDocument): string | null {
  return typeof member.email === 'string' ? normalizeEmail(member.email) : null
}

function actionUrl(baseUrl: string, token: string): string {
  const url = new URL('/set-password', baseUrl)
  url.searchParams.set('token', token)
  return url.toString()
}

async function findMember(payload: PayloadMemberAuthAPI, email: string): Promise<PayloadDocument | null> {
  const result = await payload.find({
    collection: 'payload_members',
    where: { email: { equals: email } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return result.docs[0] ?? null
}

async function createPendingMember(
  payload: PayloadMemberAuthAPI,
  email: string,
): Promise<PayloadDocument> {
  const temporaryPassword = randomBytes(48).toString('base64url')
  return payload.create({
    collection: 'payload_members',
    data: {
      email,
      password: temporaryPassword,
      accountStatus: 'pending',
      source: 'admin_created',
    },
    overrideAccess: true,
  })
}

export async function inviteMember(
  payload: PayloadMemberAuthAPI,
  input: InviteMemberInput,
): Promise<InviteMemberResult> {
  const email = normalizeEmail(input.email)
  if (!email || !validEmail(email)) return { ok: false, error: 'invalid_email' }

  let member = await findMember(payload, email)
  const created = !member

  if (!member) {
    member = await createPendingMember(payload, email)
  }

  const status = memberStatus(member)
  if (status === 'blocked' || status === 'deleted') {
    return { ok: false, error: 'account_ineligible' }
  }

  const displayName = cleanDisplayName(input.displayName)
  if (displayName) {
    const existingProfile = await payload.find({
      collection: 'payload_member_profiles',
      where: { member: { equals: String(member.id) } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (!existingProfile.docs[0]) {
      await payload.create({
        collection: 'payload_member_profiles',
        data: {
          member: member.id,
          displayName,
          marketingConsent: false,
          transactionalEmailConsent: true,
        },
        overrideAccess: true,
      })
    }
  }

  const resetResult = await payload.forgotPassword({
    collection: 'payload_members',
    data: { email },
    disableEmail: true,
  })
  const token = tokenFromResult(resetResult)
  if (!token) return { ok: false, error: 'token_unavailable' }

  await payload.create({
    collection: 'payload_member_security_events',
    data: {
      member: member.id,
      eventType: 'password_reset_requested',
      source: 'admin_invitation',
      metadata: {
        administratorId: String(input.administratorId),
        purpose: 'member_invitation',
      },
    },
    overrideAccess: true,
  })

  await createAuditEvent(payload, {
    actorType: 'admin',
    actorId: input.administratorId,
    action: created ? 'member.invited.created' : 'member.invited.reissued',
    targetCollection: 'payload_members',
    targetId: member.id,
    after: {
      email: memberEmail(member) ?? email,
      accountStatus: status,
    },
    metadata: {
      purpose: 'member_invitation',
      emailQueued: true,
    },
  })

  const tokenFingerprint = createHash('sha256').update(token).digest('hex').slice(0, 20)
  const queued = await queueEmailEvent(payload, {
    toEmail: email,
    templateKey: 'member-invitation',
    dedupeKey: `member-invitation:${member.id}:${tokenFingerprint}`,
    metadata: {
      actionUrl: actionUrl(input.baseUrl, token),
      purpose: 'member_invitation',
    },
  })

  return {
    ok: true,
    memberId: String(member.id),
    created,
    emailQueued: queued.created,
  }
}
