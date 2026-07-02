import type { PayloadCourseWriteAPI, PayloadId } from '@/lib/payloadCourse/accessService'
import { createAuditEvent, queueEmailEvent } from '@/lib/payloadCourse/events'

export type UpdateMemberProfileInput = {
  displayName: string
  company?: string | null
  phone?: string | null
  timezone?: string | null
  baseUrl?: string
}

export type UpdateMemberProfileResult =
  | {
      ok: true
      confirmationQueued: boolean
      profile: {
        id: string
        displayName: string
        company: string | null
        phone: string | null
        timezone: string | null
      }
    }
  | {
      ok: false
      error: 'display_name_required' | 'account_ineligible'
    }

function normalizeText(value: string | null | undefined, maxLength: number): string | null {
  const normalized = (value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLength)
  return normalized || null
}

export async function updateMemberProfile(
  payload: PayloadCourseWriteAPI,
  memberId: PayloadId,
  input: UpdateMemberProfileInput,
): Promise<UpdateMemberProfileResult> {
  const displayName = normalizeText(input.displayName, 80)
  if (!displayName) return { ok: false, error: 'display_name_required' }

  const member = await payload.findByID({
    collection: 'payload_members',
    id: memberId,
    depth: 0,
    overrideAccess: true,
  })
  if (member.accountStatus !== 'active') {
    return { ok: false, error: 'account_ineligible' }
  }

  const data = {
    displayName,
    company: normalizeText(input.company, 100),
    phone: normalizeText(input.phone, 40),
    timezone: normalizeText(input.timezone, 80),
  }

  const existing = await payload.find({
    collection: 'payload_member_profiles',
    where: { member: { equals: String(memberId) } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const before = existing.docs[0] ?? null
  const saved = before
    ? await payload.update({
        collection: 'payload_member_profiles',
        id: before.id,
        data,
        overrideAccess: true,
      })
    : await payload.create({
        collection: 'payload_member_profiles',
        data: {
          member: memberId,
          ...data,
          marketingConsent: false,
          transactionalEmailConsent: true,
        },
        overrideAccess: true,
      })

  const securityEvent = await payload.create({
    collection: 'payload_member_security_events',
    data: {
      member: memberId,
      eventType: 'profile_changed',
      source: 'member_self_service',
      metadata: {
        changedFields: ['displayName', 'company', 'phone', 'timezone'],
      },
    },
    overrideAccess: true,
  })

  await createAuditEvent(payload, {
    actorType: 'member',
    actorId: memberId,
    action: 'member.profile.changed',
    targetCollection: 'payload_member_profiles',
    targetId: saved.id,
    before: before
      ? {
          displayName: before.displayName,
          company: before.company,
          phone: before.phone,
          timezone: before.timezone,
        }
      : null,
    after: data,
    metadata: { securityEventId: String(securityEvent.id) },
  })

  let confirmationQueued = false
  const email = typeof member.email === 'string' ? member.email : null
  if (email) {
    try {
      const baseUrl = new URL(input.baseUrl)
      const queued = await queueEmailEvent(payload, {
        toEmail: email,
        templateKey: 'member-profile-changed',
        dedupeKey: `member-profile-changed:${memberId}:${securityEvent.id}`,
        metadata: {
          memberId: String(memberId),
          purpose: 'profile_change_confirmation',
          displayName,
          logoUrl: `${baseUrl.origin}/images/jpv-logo.png`,
        },
      })
      confirmationQueued = queued.created
    } catch {
      try {
        await createAuditEvent(payload, {
          actorType: 'system',
          action: 'member.profile.changed.confirmation_failed',
          targetCollection: 'payload_members',
          targetId: memberId,
          severity: 'warning',
          metadata: { securityEventId: String(securityEvent.id) },
        })
      } catch {
        // Confirmation delivery never rolls back an approved profile update.
      }
    }
  }

  return {
    ok: true,
    confirmationQueued,
    profile: {
      id: String(saved.id),
      displayName,
      company: data.company,
      phone: data.phone,
      timezone: data.timezone,
    },
  }
}
