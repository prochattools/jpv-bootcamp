import type { PayloadCourseWriteAPI, PayloadId } from '@/lib/payloadCourse/accessService'

export type UpdateMemberProfileInput = {
  displayName: string
  company?: string | null
  phone?: string | null
  timezone?: string | null
}

export type UpdateMemberProfileResult =
  | {
      ok: true
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
      error: 'display_name_required'
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

  const data = {
    displayName,
    company: normalizeText(input.company, 100),
    phone: normalizeText(input.phone, 40),
    timezone: normalizeText(input.timezone, 80),
  }

  const existing = await payload.find({
    collection: 'payload_member_profiles',
    where: {
      member: { equals: String(memberId) },
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const saved = existing.docs[0]
    ? await payload.update({
        collection: 'payload_member_profiles',
        id: existing.docs[0].id,
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

  return {
    ok: true,
    profile: {
      id: String(saved.id),
      displayName,
      company: data.company,
      phone: data.phone,
      timezone: data.timezone,
    },
  }
}
