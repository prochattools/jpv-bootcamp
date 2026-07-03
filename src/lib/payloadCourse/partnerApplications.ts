import type { PayloadCourseWriteAPI, PayloadDocument, PayloadId } from '@/lib/payloadCourse/accessService'
import { createAuditEvent, queueEmailEvent } from '@/lib/payloadCourse/events'
import { recordPartnerEvent } from '@/lib/payloadCourse/partnerDelivery'

export type PartnerApplicationMode = 'redirect' | 'email' | 'webhook' | 'manual_export'
export type PartnerStatus = 'draft' | 'active' | 'paused' | 'archived'
export type PartnerDeliveryStatus = 'draft' | 'submitted' | 'delivery_pending' | 'delivered' | 'delivery_failed'

export type PartnerDirectoryEntry = {
  id: string
  slug: string
  name: string
  category: string
  summary: string | null
  logo: string | null
  applicationMode: PartnerApplicationMode
  privacyNotice: string | null
  status: PartnerStatus
}

export type PartnerApplicationSnapshot = {
  id: string
  partnerSlug: string
  partnerName: string
  applicationMode: PartnerApplicationMode
  status: PartnerDeliveryStatus
  createdAt: string | null
  submittedAt: string | null
  deliveryAttempts: number
  memberName: string | null
}

type PartnerRecord = PayloadDocument & {
  slug?: unknown
  name?: unknown
  category?: unknown
  summary?: unknown
  logo?: unknown
  applicationMode?: unknown
  privacyNotice?: unknown
  status?: unknown
  affiliateUrl?: unknown
}

type MemberRecord = PayloadDocument & {
  email?: unknown
  displayName?: unknown
  accountStatus?: unknown
  phone?: unknown
}

function asString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number') return String(value)
  return null
}

function asNonEmptyString(value: unknown): string | null {
  const result = asString(value)
  return result && result.length > 0 ? result : null
}

function asMode(value: unknown): PartnerApplicationMode | null {
  return value === 'redirect' || value === 'email' || value === 'webhook' || value === 'manual_export'
    ? value
    : null
}

function asStatus(value: unknown): PartnerStatus | null {
  return value === 'draft' || value === 'active' || value === 'paused' || value === 'archived'
    ? value
    : null
}

function asDeliveryStatus(value: unknown): PartnerDeliveryStatus {
  return value === 'submitted' || value === 'delivery_pending' || value === 'delivered' || value === 'delivery_failed'
    ? value
    : 'draft'
}

function getDocumentId(value: unknown): string | null {
  const direct = asString(value)
  if (direct) return direct
  if (!value || typeof value !== 'object' || !('id' in value)) return null
  return asString((value as { id?: unknown }).id)
}

function deny(): never {
  throw new Error('Partner application was not found.')
}

async function findMember(payload: PayloadCourseWriteAPI, memberId: string): Promise<MemberRecord> {
  const member = (await payload.findByID({
    collection: 'payload_members',
    id: memberId,
    overrideAccess: true,
  })) as MemberRecord
  if (!member || member.accountStatus !== 'active') deny()
  if (!asNonEmptyString(member.email)) deny()
  return member
}

async function findActivePartner(payload: PayloadCourseWriteAPI, partnerSlug: string): Promise<PartnerRecord> {
  const result = await payload.find({
    collection: 'payload_partner_affiliates',
    where: {
      and: [{ slug: { equals: partnerSlug } }, { status: { equals: 'active' } }],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const partner = (result.docs[0] as PartnerRecord | undefined) ?? null
  if (!partner || asString(partner.slug) !== partnerSlug || asStatus(partner.status) !== 'active') deny()
  if (!asNonEmptyString(partner.name) || !asNonEmptyString(partner.category)) deny()
  if (!asMode(partner.applicationMode)) deny()
  return partner
}

function buildApplicationReference(memberId: string, partnerId: string): string {
  return `partner-${memberId}-${partnerId}`.slice(0, 120)
}

async function findExistingSubmission(
  payload: PayloadCourseWriteAPI,
  memberId: string,
  partnerId: string
): Promise<PayloadDocument | null> {
  const result = await payload.find({
    collection: 'payload_partner_applications',
    where: { and: [{ member: { equals: memberId } }, { partner: { equals: partnerId } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return (result.docs[0] as PayloadDocument | undefined) ?? null
}

function sanitizeApplication(data: Record<string, unknown>): Record<string, unknown> {
  return {
    company: asNonEmptyString(data.company),
    country: asNonEmptyString(data.country),
    experience: asNonEmptyString(data.experience),
    message: asNonEmptyString(data.message),
    consentAccepted: data.consentAccepted === true,
  }
}

export async function listActivePartners(payload: PayloadCourseWriteAPI): Promise<PartnerDirectoryEntry[]> {
  const result = await payload.find({
    collection: 'payload_partner_affiliates',
    where: { status: { equals: 'active' } },
    sort: 'sortOrder',
    depth: 0,
    limit: 100,
    overrideAccess: true,
  })

  return result.docs
    .map((partner) => partner as PartnerRecord)
    .filter((partner) => asStatus(partner.status) === 'active' && asString(partner.slug))
    .map((partner) => ({
      id: String(partner.id),
      slug: asString(partner.slug)!,
      name: asNonEmptyString(partner.name)!,
      category: asNonEmptyString(partner.category)!,
      summary: asNonEmptyString(partner.summary),
      logo: asNonEmptyString(partner.logo),
      applicationMode: asMode(partner.applicationMode)!,
      privacyNotice: asNonEmptyString(partner.privacyNotice),
      status: 'active',
    }))
}

export async function getPartnerApplicationDetail(
  payload: PayloadCourseWriteAPI,
  partnerSlug: string,
  memberId: PayloadId
): Promise<PartnerDirectoryEntry> {
  const member = await findMember(payload, String(memberId))
  void member
  const partner = await findActivePartner(payload, partnerSlug)
  return {
    id: String(partner.id),
    slug: asString(partner.slug)!,
    name: asNonEmptyString(partner.name)!,
    category: asNonEmptyString(partner.category)!,
    summary: asNonEmptyString(partner.summary),
    logo: asNonEmptyString(partner.logo),
    applicationMode: asMode(partner.applicationMode)!,
    privacyNotice: asNonEmptyString(partner.privacyNotice),
    status: 'active',
  }
}

export async function submitPartnerApplication(
  payload: PayloadCourseWriteAPI,
  args: {
    memberId: PayloadId
    partnerSlug: string
    application: Record<string, unknown>
  }
): Promise<{ outcome: 'created' | 'existing' | 'redirect_pending' | 'queued'; applicationId: string }> {
  const member = await findMember(payload, String(args.memberId))
  const partner = await findActivePartner(payload, args.partnerSlug)
  const existing = await findExistingSubmission(payload, String(member.id), String(partner.id))
  const sanitized = sanitizeApplication(args.application)
  const now = new Date()

  if (existing) {
    return {
      outcome: 'existing',
      applicationId: String(existing.id),
    }
  }

  const created = await payload.create({
    collection: 'payload_partner_applications',
    data: {
      displayName: `${partner.name} application`,
      member: String(member.id),
      partner: String(partner.id),
      status: 'submitted',
      deliveryMethod: partner.applicationMode,
      submittedAt: now.toISOString(),
      applicationReference: buildApplicationReference(String(member.id), String(partner.id)),
      consentAcceptedAt: sanitized.consentAccepted ? now.toISOString() : null,
      memberNameSnapshot: asNonEmptyString(member.displayName) ?? asNonEmptyString(member.email),
      memberEmailSnapshot: asNonEmptyString(member.email),
      memberPhoneSnapshot: asNonEmptyString(member.phone),
      partnerSlugSnapshot: asString(partner.slug),
      partnerNameSnapshot: asNonEmptyString(partner.name),
      companySnapshot: sanitized.company,
      countrySnapshot: sanitized.country,
      experienceSnapshot: sanitized.experience,
      messageSnapshot: sanitized.message,
      deliveryAttempts: 0,
      trustedDestinationSnapshot:
        partner.applicationMode === 'redirect'
          ? asNonEmptyString(partner.affiliateUrl)
          : partner.applicationMode === 'email'
            ? null
            : asNonEmptyString(partner.affiliateUrl),
      source: 'portal',
      metadata: {
        consentAccepted: sanitized.consentAccepted,
      },
    },
    overrideAccess: true,
  })

  await createAuditEvent(payload, {
    actorType: 'member',
    actorId: member.id,
    action: 'partner_application_submitted',
    targetCollection: 'payload_partner_applications',
    targetId: created.id,
    before: null,
    after: {
      partnerSlug: asString(partner.slug),
      deliveryMethod: partner.applicationMode,
      status: 'submitted',
    },
  })

  await recordPartnerEvent(payload, {
    partnerId: partner.id,
    applicationId: created.id,
    memberId: member.id,
    eventType: 'partner_application_submitted',
    sourceRoute: `/portal/partners/${partner.slug}`,
    status: 'submitted',
    deliveryMethod: partner.applicationMode as PartnerApplicationMode,
  })

  if (partner.applicationMode === 'email') {
    await queueEmailEvent(payload, {
      toEmail: asNonEmptyString(member.email)!,
      templateKey: 'partner-application-received',
      dedupeKey: `partner-application:email:${String(created.id)}`,
      contact: member.id,
      metadata: { partnerSlug: asString(partner.slug), applicationId: String(created.id) },
    })
  }

  if (partner.applicationMode === 'redirect') {
    await recordPartnerEvent(payload, {
      partnerId: partner.id,
      applicationId: created.id,
      memberId: member.id,
      eventType: 'partner_viewed',
      sourceRoute: `/portal/partners/${partner.slug}`,
      status: 'submitted',
      deliveryMethod: partner.applicationMode as PartnerApplicationMode,
    })
    return {
      outcome: 'redirect_pending',
      applicationId: String(created.id),
    }
  }

  await payload.update({
    collection: 'payload_partner_applications',
    id: created.id,
    data: { status: 'delivery_pending' },
    overrideAccess: true,
  })

  await recordPartnerEvent(payload, {
    partnerId: partner.id,
    applicationId: created.id,
    memberId: member.id,
    eventType: 'partner_application_delivery_pending',
    sourceRoute: `/portal/partners/${partner.slug}`,
    status: 'delivery_pending',
    deliveryMethod: partner.applicationMode as PartnerApplicationMode,
  })

  return { outcome: 'queued', applicationId: String(created.id) }
}

export async function listMemberApplications(
  payload: PayloadCourseWriteAPI,
  memberId: PayloadId
): Promise<PartnerApplicationSnapshot[]> {
  const member = await findMember(payload, String(memberId))
  const result = await payload.find({
    collection: 'payload_partner_applications',
    where: { member: { equals: String(member.id) } },
    sort: '-createdAt',
    limit: 50,
    depth: 0,
    overrideAccess: true,
  })

  return result.docs.map((application) => ({
    id: String(application.id),
    partnerSlug: asString(application.partnerSlugSnapshot) ?? 'unknown',
    partnerName: asString(application.partnerNameSnapshot) ?? 'Partner',
    applicationMode: asMode(application.deliveryMethod) ?? 'manual_export',
    status: asDeliveryStatus(application.status),
    createdAt: asString(application.createdAt),
    submittedAt: asString(application.submittedAt),
    deliveryAttempts: typeof application.deliveryAttempts === 'number' ? application.deliveryAttempts : 0,
    memberName: asString(member.displayName) ?? asString(member.email),
  }))
}
