import 'server-only'

import { Prisma } from '@prisma/client'

import prisma from '@/libs/prisma'
import { getServerConfig } from '@/lib/config'
import { normalizeEmail } from '@/lib/normalize-email'
import { sendWelcomeEmail } from '@/lib/email'
import { applySponsoredGrant } from '@/lib/sponsored-grants'
import { provisionMemberFromCheckout } from '@/lib/members/provisionMemberFromCheckout'
import { createAuditEvent } from '@/lib/payloadCourse/events'
import type { PayloadCourseWriteAPI, PayloadDocument, PayloadId } from '@/lib/payloadCourse/accessService'

export type SponsoredGrantMode = 'existing' | 'new'

export type SponsoredAdminGrantResult =
  | { ok: true; applicationId: string; memberId: string; createdMember: boolean; emailSent: boolean }
  | { ok: false; reason: 'not_found' | 'not_pending' | 'invalid_email' | 'member_required' | 'member_not_found' | 'member_ineligible' | 'duplicate_email' | 'no_seat_available' | 'in_progress' | 'grant_failed' | 'provision_failed' }

type MemberRecord = PayloadDocument & {
  email?: unknown
  accountStatus?: unknown
}

const STALE_PROCESSING_TIMEOUT_MS = 15 * 60 * 1000

function asMemberId(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isInteger(value)) return String(value)
  return null
}

function accountIdForMember(member: MemberRecord): number | null {
  const value = Number(member.id)
  return Number.isSafeInteger(value) && value > 0 ? value : null
}

async function findMemberByEmail(payload: PayloadCourseWriteAPI, email: string): Promise<MemberRecord | null> {
  const result = await payload.find({
    collection: 'payload_members',
    where: { email: { equals: email } },
    limit: 2,
    depth: 0,
    overrideAccess: true,
  })
  return (result.docs[0] as MemberRecord | undefined) ?? null
}

async function findMemberById(payload: PayloadCourseWriteAPI, memberId: string): Promise<MemberRecord | null> {
  try {
    return (await payload.findByID({
      collection: 'payload_members',
      id: memberId,
      depth: 0,
      overrideAccess: true,
    })) as MemberRecord | null
  } catch {
    return null
  }
}

async function syncPayloadFundingRecord(params: {
  payload: PayloadCourseWriteAPI
  applicationId: string
  member: MemberRecord
  administratorId: PayloadId
}): Promise<PayloadDocument | null> {
  const application = await prisma.sponsoredApplication.findUnique({
    where: { id: params.applicationId },
  })
  if (!application?.seatId) return null
  const seat = await prisma.sponsoredSeat.findUnique({ where: { id: application.seatId } })
  if (!seat) return null

  const records = await params.payload.find({
    collection: 'payload_pay_it_forward_funding',
    where: {
      stripePaymentIntentId: { equals: seat.stripePaymentIntentId },
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const record = records.docs[0] as PayloadDocument | undefined
  if (!record) {
    return params.payload.create({
      collection: 'payload_pay_it_forward_funding',
      data: {
        displayName: `Pay it forward — ${application.email ?? 'applicant'} — ${seat.createdAt.toISOString().slice(0, 10)}`,
        sponsorEmail: undefined,
        stripeCheckoutSessionId: seat.stripeCheckoutSessionId,
        stripePaymentIntentId: seat.stripePaymentIntentId,
        amountPaidMinor: 8000,
        purchasedAt: seat.createdAt.toISOString(),
        seatStatus: 'redeemed',
        member: params.member.id,
        memberEmail: application.email ?? undefined,
        redeemedByName: application.name,
        redeemedByEmail: application.email ?? undefined,
        approvalState: 'issued',
        approvedBy: params.administratorId,
        issuedBy: params.administratorId,
        issuedAt: new Date().toISOString(),
        redeemedAt: new Date().toISOString(),
        approvalReference: `sponsored-application:${application.id}`,
      },
      overrideAccess: true,
    }) as Promise<PayloadDocument>
  }

  return params.payload.update({
    collection: 'payload_pay_it_forward_funding',
    id: record.id,
    data: {
      seatStatus: 'redeemed',
      approvalState: 'issued',
      member: params.member.id,
      memberEmail: application.email ?? undefined,
      redeemedByName: application.name,
      redeemedByEmail: application.email ?? undefined,
      approvedBy: params.administratorId,
      issuedBy: params.administratorId,
      issuedAt: new Date().toISOString(),
      redeemedAt: new Date().toISOString(),
      approvalReference: `sponsored-application:${application.id}`,
    },
    overrideAccess: true,
  }) as Promise<PayloadDocument>
}

async function releaseReservation(applicationId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.sponsoredSeat.updateMany({
      where: { reservedByApplicationId: applicationId, claimedByAccountId: null },
      data: { reservedByApplicationId: null, reservedAt: null },
    })
    await tx.sponsoredApplication.updateMany({
      where: { id: applicationId, status: 'processing' },
      data: {
        status: 'pending',
        decision: null,
        seatId: null,
        decidedAt: null,
      },
    })
  })
}

/**
 * Grants one paid-for seat from the Payload admin queue. The seat is reserved
 * before account provisioning, then claimed only after the member entitlement
 * has been written. Repeated requests are safe and never consume two seats.
 */
export async function grantSponsoredApplication(params: {
  payload: PayloadCourseWriteAPI
  applicationId: string
  mode: SponsoredGrantMode
  memberId?: string | null
  administratorId: PayloadId
}): Promise<SponsoredAdminGrantResult> {
  let application = await prisma.sponsoredApplication.findUnique({
    where: { id: params.applicationId },
  })
  if (!application) return { ok: false, reason: 'not_found' }
  if (application.status === 'processing') {
    const processingAge = Date.now() - application.updatedAt.getTime()
    if (processingAge <= STALE_PROCESSING_TIMEOUT_MS) return { ok: false, reason: 'in_progress' }
    await releaseReservation(params.applicationId)
    application = await prisma.sponsoredApplication.findUnique({
      where: { id: params.applicationId },
    })
    if (!application) return { ok: false, reason: 'not_found' }
  }
  if (application.status !== 'pending') return { ok: false, reason: 'not_pending' }

  const email = normalizeEmail(application.email)
  if (!email) return { ok: false, reason: 'invalid_email' }

  let member: MemberRecord | null = null
  let createdMember = false
  let generatedPassword: string | null = null

  if (params.mode === 'existing') {
    const memberId = asMemberId(params.memberId)
    if (!memberId) return { ok: false, reason: 'member_required' }
    member = await findMemberById(params.payload, memberId)
    if (!member) return { ok: false, reason: 'member_not_found' }
    if (member.accountStatus === 'deleted' || member.accountStatus === 'blocked' || member.accountStatus === 'suspended') {
      return { ok: false, reason: 'member_ineligible' }
    }
  } else {
    const existing = await findMemberByEmail(params.payload, email)
    if (existing) return { ok: false, reason: 'duplicate_email' }
  }

  const reservation = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string; status: string }>>(Prisma.sql`
      SELECT id, status
      FROM jpvbootcamp.sponsored_applications
      WHERE id = ${params.applicationId}::uuid
      FOR UPDATE
    `)
    if (!locked[0] || locked[0].status !== 'pending') return null

    const reserved = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      UPDATE jpvbootcamp.sponsored_seats
      SET reserved_by_application_id = ${params.applicationId}::uuid,
          reserved_at = NOW()
      WHERE id = (
        SELECT id
        FROM jpvbootcamp.sponsored_seats
        WHERE tier = 'free'
          AND claimed_by_account_id IS NULL
          AND reserved_by_application_id IS NULL
        ORDER BY created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING id
    `)
    if (!reserved[0]) return 'no_seat' as const

    await tx.sponsoredApplication.update({
      where: { id: params.applicationId },
      data: {
        status: 'processing',
        decision: 'approved',
        seatId: reserved[0].id,
        reviewedAt: new Date(),
        reviewedByAccountId: Number.isSafeInteger(Number(params.administratorId))
          ? Number(params.administratorId)
          : null,
      },
    })
    return reserved[0].id
  })

  if (reservation === 'no_seat' || !reservation) {
    return { ok: false, reason: reservation === 'no_seat' ? 'no_seat_available' : 'in_progress' }
  }

  try {
    if (!member) {
      const provisioned = await provisionMemberFromCheckout({
        email,
        displayName: application.name,
        source: 'admin_created',
      })
      if (!provisioned.memberId) throw new Error('member_provision_failed')
      member = await findMemberById(params.payload, provisioned.memberId)
      if (!member) throw new Error('member_not_found_after_provision')
      createdMember = provisioned.created
      generatedPassword = provisioned.password
    } else if (member.accountStatus === 'pending') {
      member = await params.payload.update({
        collection: 'payload_members',
        id: member.id,
        data: { accountStatus: 'active' },
        overrideAccess: true,
      }) as MemberRecord
    }

    const accountId = member ? accountIdForMember(member) : null
    if (!accountId) throw new Error('member_id_not_numeric')

    const grant = await applySponsoredGrant({
      accountId,
      tier: 'free',
      name: application.name,
      email,
    })
    if (!grant.ok) throw new Error(grant.reason ?? 'grant_failed')

    const now = new Date()
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.sponsoredSeat.updateMany({
        where: {
          id: reservation,
          reservedByApplicationId: params.applicationId,
          claimedByAccountId: null,
        },
        data: {
          claimedByAccountId: accountId,
          claimedAt: now,
          reservedByApplicationId: null,
          reservedAt: null,
        },
      })
      if (claimed.count !== 1) throw new Error('seat_claim_conflict')

      await tx.sponsoredGrant.create({
        data: {
          accountId,
          tier: 'free',
          seatId: reservation,
          startsAt: now,
          endsAt: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30),
        },
      })
      await tx.sponsoredApplication.update({
        where: { id: params.applicationId },
        data: {
          status: 'claimed',
          accountId,
          claimedAt: now,
          decidedAt: now,
          reviewedAt: now,
        },
      })
    })

    const fundingRecord = await syncPayloadFundingRecord({
      payload: params.payload,
      applicationId: params.applicationId,
      member: member!,
      administratorId: params.administratorId,
    }).catch((error): null => {
      console.error('sponsored_payload_funding_sync_failed', {
        applicationId: params.applicationId,
        message: error instanceof Error ? error.message : 'unknown_error',
      })
      return null
    })

    await createAuditEvent(params.payload, {
      actorType: 'admin',
      actorId: params.administratorId,
      action: 'sponsored.application.granted',
      targetCollection: 'payload_pay_it_forward_funding',
      targetId: fundingRecord?.id ?? null,
      after: {
        applicationId: params.applicationId,
        memberId: member!.id,
        seatId: reservation,
        mode: params.mode,
        createdMember,
      },
    }).catch((error) => {
      console.error('sponsored_admin_grant_audit_failed', {
        applicationId: params.applicationId,
        message: error instanceof Error ? error.message : 'unknown_error',
      })
    })

    let emailSent = false
    if (createdMember && generatedPassword) {
      try {
        const portalUrl = getServerConfig().email.portalUrl.replace(/\/$/, '')
        await sendWelcomeEmail({
          to: email,
          plan: 'jpv_bootcamp_membership',
          resetUrl: `${portalUrl}/forgot-password`,
          credentials: { email, password: generatedPassword },
          meta: {
            templateKey: 'membership_access_ready',
            source: 'sponsored_admin_grant',
            dedupeKey: `sponsored-application:${params.applicationId}`,
          },
        })
        emailSent = true
      } catch (error) {
        console.error('sponsored_member_welcome_email_failed', {
          applicationId: params.applicationId,
          message: error instanceof Error ? error.message : 'unknown_error',
        })
      }
    }

    return {
      ok: true,
      applicationId: params.applicationId,
      memberId: String(member!.id),
      createdMember,
      emailSent,
    }
  } catch (error) {
    console.error('sponsored_admin_grant_failed', {
      applicationId: params.applicationId,
      message: error instanceof Error ? error.message : 'unknown_error',
    })
    await releaseReservation(params.applicationId).catch(() => {})
    if (createdMember && member) {
      await params.payload.update({
        collection: 'payload_members',
        id: member.id,
        data: { accountStatus: 'pending' },
        overrideAccess: true,
      }).catch(() => {})
    }
    return {
      ok: false,
      reason: error instanceof Error && error.message === 'member_provision_failed'
        ? 'provision_failed'
        : 'grant_failed',
    }
  }
}
