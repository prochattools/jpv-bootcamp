import { randomBytes } from 'node:crypto'

import type { PayloadCourseWriteAPI, PayloadDocument, PayloadId } from '@/lib/payloadCourse/accessService'
import { normalizeEmail } from '@/lib/normalize-email'

type AdministratorRecord = PayloadDocument & {
  email?: unknown
  name?: unknown
  displayName?: unknown
  portalMember?: unknown
}

function relationshipId(value: unknown): PayloadId | null {
  if (typeof value === 'string' || typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'string' || typeof id === 'number') return id
  }
  return null
}

function displayNameForAdministrator(admin: AdministratorRecord, email: string): string {
  for (const value of [admin.displayName, admin.name]) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return email.split('@')[0] || email
}

async function findOne(
  payload: PayloadCourseWriteAPI,
  collection: string,
  where: Record<string, unknown>,
): Promise<PayloadDocument | null> {
  const result = await payload.find({ collection, where, limit: 1, depth: 0, overrideAccess: true })
  return result.docs[0] ?? null
}

/**
 * Gives every Payload administrator a real member identity and profile while
 * keeping billing optional. The operation is safe to call on every login and
 * after every administrator save.
 */
export async function ensureAdministratorMemberIdentity(
  payload: PayloadCourseWriteAPI,
  administrator: AdministratorRecord,
): Promise<{ administratorId: PayloadId; member: PayloadDocument; profile: PayloadDocument } | null> {
  const administratorId = administrator.id
  const email = normalizeEmail(typeof administrator.email === 'string' ? administrator.email : null)
  if (!email) return null

  let member: PayloadDocument | null = null
  const linkedMemberId = relationshipId(administrator.portalMember)
  if (linkedMemberId !== null) {
    try {
      member = await payload.findByID({
        collection: 'payload_members',
        id: linkedMemberId,
        depth: 0,
        overrideAccess: true,
      })
    } catch {
      member = null
    }
  }

  if (!member) {
    member = await findOne(payload, 'payload_members', { email: { equals: email } })
  }

  if (!member) {
    member = await payload.create({
      collection: 'payload_members',
      data: {
        email,
        password: randomBytes(36).toString('base64url'),
        accountStatus: 'active',
        source: 'admin_created',
        emailVerifiedAt: new Date(),
        isAdministrator: true,
        notes: 'Member-facing identity provisioned from a Payload administrator account. Billing is optional.',
      },
      overrideAccess: true,
    })
  } else if (member.isAdministrator !== true) {
    member = await payload.update({
      collection: 'payload_members',
      id: member.id,
      data: { isAdministrator: true },
      overrideAccess: true,
    })
  }

  let profile = await findOne(payload, 'payload_member_profiles', { member: { equals: member.id } })
  if (!profile) {
    profile = await payload.create({
      collection: 'payload_member_profiles',
      data: {
        member: member.id,
        displayName: displayNameForAdministrator(administrator, email),
        transactionalEmailConsent: true,
      },
      overrideAccess: true,
    })
  }

  if (linkedMemberId === null || String(linkedMemberId) !== String(member.id)) {
    await payload.update({
      collection: 'payload_users',
      id: administratorId,
      data: { portalMember: member.id },
      overrideAccess: true,
    })
  }

  return { administratorId, member, profile }
}
