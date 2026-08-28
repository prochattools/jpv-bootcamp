import { randomBytes } from 'node:crypto'

import type { PayloadCourseAccessAPI, PayloadCourseWriteAPI, PayloadDocument, PayloadId } from '@/lib/payloadCourse/accessService'
import { normalizeEmail } from '@/lib/normalize-email'
import { relationshipId } from '@/lib/domain/relationships'

type AdministratorRecord = PayloadDocument & {
  email?: unknown
  name?: unknown
  displayName?: unknown
  portalMember?: unknown
}

export type AdministratorMemberIdentityResolution = {
  administratorId: PayloadId
  member: PayloadDocument | null
  source: 'linked' | 'email' | 'missing' | 'ambiguous' | 'invalid'
}

function displayNameForAdministrator(admin: AdministratorRecord, email: string): string {
  for (const value of [admin.displayName, admin.name]) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return email.split('@')[0] || email
}

async function findOne(
  payload: PayloadCourseAccessAPI,
  collection: string,
  where: Record<string, unknown>,
): Promise<PayloadDocument | null> {
  const result = await payload.find({ collection, where, limit: 1, depth: 0, overrideAccess: true })
  return result.docs[0] ?? null
}

/**
 * Resolves an administrator's optional member-facing identity without
 * creating, updating, or linking any records. Email fallback is accepted only
 * when exactly one normalized member matches; duplicates stay review-only.
 */
export async function resolveAdministratorMemberIdentity(
  payload: PayloadCourseAccessAPI,
  administrator: AdministratorRecord,
): Promise<AdministratorMemberIdentityResolution> {
  const administratorId = administrator.id
  const email = normalizeEmail(typeof administrator.email === 'string' ? administrator.email : null)
  const linkedMemberId = relationshipId(administrator.portalMember)

  if (linkedMemberId !== null) {
    try {
      const linkedMember = (await payload.findByID({
        collection: 'payload_members',
        id: linkedMemberId,
        depth: 0,
        overrideAccess: true,
      })) as PayloadDocument | null
      const linkedEmail = normalizeEmail(
        typeof linkedMember?.email === 'string' ? linkedMember.email : null,
      )
      if (linkedMember && email && linkedEmail && linkedEmail !== email) {
        return { administratorId, member: null, source: 'invalid' }
      }
      if (linkedMember) {
        return { administratorId, member: linkedMember, source: 'linked' }
      }
      // A missing target is a stale link, so continue to the guarded,
      // unambiguous email fallback below.
    } catch {
      // A stale link is eligible for the read-only, unambiguous email fallback.
    }
  }

  if (!email) return { administratorId, member: null, source: 'invalid' }

  const result = await payload.find({
    collection: 'payload_members',
    where: { email: { equals: email } },
    limit: 2,
    depth: 0,
    overrideAccess: true,
  })
  if (result.docs.length > 1) {
    return { administratorId, member: null, source: 'ambiguous' }
  }
  if (result.docs.length === 1) {
    return { administratorId, member: result.docs[0] ?? null, source: 'email' }
  }
  return { administratorId, member: null, source: 'missing' }
}

/**
 * Explicitly provisions a Payload administrator's member-facing identity and
 * profile while keeping billing optional. This must only be called from a
 * guarded provisioning/backfill workflow; access resolution is read-only.
 */
export async function ensureAdministratorMemberIdentity(
  payload: PayloadCourseWriteAPI,
  administrator: AdministratorRecord,
): Promise<{ administratorId: PayloadId; member: PayloadDocument; profile: PayloadDocument } | null> {
  const administratorId = administrator.id
  const email = normalizeEmail(typeof administrator.email === 'string' ? administrator.email : null)
  if (!email) return null

  const resolution = await resolveAdministratorMemberIdentity(payload, administrator)
  if (resolution.source === 'ambiguous' || resolution.source === 'invalid') return null

  let member: PayloadDocument | null = resolution.member
  const linkedMemberId = relationshipId(administrator.portalMember)

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
