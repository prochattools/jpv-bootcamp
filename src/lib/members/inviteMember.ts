import { randomBytes } from 'node:crypto'

import type { MemberAccountActionService } from '@/lib/auth/memberAccountActions'
import { normalizeEmail } from '@/lib/normalize-email'
import type {
  PayloadDocument,
  PayloadId,
  PayloadMemberAuthAPI,
} from '@/lib/payloadCourse/accessService'
import { createAuditEvent } from '@/lib/payloadCourse/events'

export type InviteMemberInput = {
  administratorId: PayloadId
  email: string
  displayName?: string | null
}

export type InviteMemberResult =
  | {
      ok: true
      memberId: string
      created: boolean
      emailQueued: boolean
      delivery: 'queued' | 'suppressed' | 'failed'
    }
  | {
      ok: false
      error: 'invalid_email' | 'account_ineligible'
    }

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function cleanDisplayName(value: string | null | undefined): string | null {
  const cleaned = (value ?? '').replace(/\s+/g, ' ').trim().slice(0, 80)
  return cleaned || null
}

function memberStatus(member: PayloadDocument): string {
  return typeof member.accountStatus === 'string' ? member.accountStatus : 'pending'
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
  actions: MemberAccountActionService,
  input: InviteMemberInput,
): Promise<InviteMemberResult> {
  const email = normalizeEmail(input.email)
  if (!email || !validEmail(email)) return { ok: false, error: 'invalid_email' }

  let member = await findMember(payload, email)
  const created = !member
  if (!member) member = await createPendingMember(payload, email)

  if (memberStatus(member) !== 'pending') {
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

  const issued = await actions.issueAction({
    memberId: String(member.id),
    email,
    displayName,
    purpose: 'member_invitation',
    templateKey: 'member-invitation',
    actionPath: '/set-password',
    ttlMs: 24 * 60 * 60 * 1000,
  })

  await payload.create({
    collection: 'payload_member_security_events',
    data: {
      member: member.id,
      eventType: 'invitation_created',
      source: 'admin_invitation',
      metadata: {
        administratorId: String(input.administratorId),
        delivery: issued.delivery,
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
      email,
      accountStatus: 'pending',
    },
    metadata: {
      purpose: 'member_invitation',
      delivery: issued.delivery,
    },
  })

  return {
    ok: true,
    memberId: String(member.id),
    created,
    emailQueued: issued.delivery === 'queued',
    delivery: issued.delivery,
  }
}
