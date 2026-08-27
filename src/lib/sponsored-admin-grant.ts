import 'server-only'

import { Prisma } from '@prisma/client'

import prisma from '@/libs/prisma'
import { normalizeEmail } from '@/lib/normalize-email'
import {
	createSponsoredRecipientCheckout,
	sendSponsoredRecipientCheckout,
} from '@/lib/sponsored-recipient'
import { createAuditEvent } from '@/lib/payloadCourse/events'
import type { PayloadCourseWriteAPI, PayloadDocument, PayloadId } from '@/lib/payloadCourse/accessService'

export type SponsoredGrantMode = 'existing' | 'new'

export type SponsoredAdminGrantResult =
	| {
			ok: true
			applicationId: string
			memberId: string
			createdMember: boolean
			emailSent: boolean
			checkoutUrl: string
		}
	| {
			ok: false
			reason:
				| 'not_found'
				| 'not_pending'
				| 'invalid_email'
				| 'member_required'
				| 'member_not_found'
				| 'member_ineligible'
				| 'duplicate_email'
				| 'no_seat_available'
				| 'in_progress'
				| 'checkout_failed'
				| 'email_failed'
		}

type MemberRecord = PayloadDocument & {
	email?: unknown
	accountStatus?: unknown
}

const STALE_PROCESSING_TIMEOUT_MS = 24 * 60 * 60 * 1000

function asMemberId(value: unknown): string | null {
	if (typeof value === 'string' && value.trim()) return value.trim()
	if (typeof value === 'number' && Number.isInteger(value)) return String(value)
	return null
}

async function findMemberByEmail(
	payload: PayloadCourseWriteAPI,
	email: string,
): Promise<MemberRecord | null> {
	const result = await payload.find({
		collection: 'payload_members',
		where: { email: { equals: email } },
		limit: 2,
		depth: 0,
		overrideAccess: true,
	})
	return (result.docs[0] as MemberRecord | undefined) ?? null
}

async function findMemberById(
	payload: PayloadCourseWriteAPI,
	memberId: string,
): Promise<MemberRecord | null> {
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
 * Approves one sponsored application by reserving a funded seat and sending a
 * normal Stripe subscription checkout. The seat and account are finalized by
 * the Stripe webhook only after the recipient completes that checkout.
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

	const applicationEmail = normalizeEmail(application.email)
	if (!applicationEmail) return { ok: false, reason: 'invalid_email' }

	let member: MemberRecord | null = null
	let recipientEmail = applicationEmail
	if (params.mode === 'existing') {
		const memberId = asMemberId(params.memberId)
		if (!memberId) return { ok: false, reason: 'member_required' }
		member = await findMemberById(params.payload, memberId)
		if (!member) return { ok: false, reason: 'member_not_found' }
		if (['deleted', 'blocked', 'suspended'].includes(String(member.accountStatus))) {
			return { ok: false, reason: 'member_ineligible' }
		}
		const memberEmail = normalizeEmail(typeof member.email === 'string' ? member.email : null)
		if (!memberEmail) return { ok: false, reason: 'member_ineligible' }
		recipientEmail = memberEmail
	} else if (await findMemberByEmail(params.payload, applicationEmail)) {
		return { ok: false, reason: 'duplicate_email' }
	}

	const existingBilling = await prisma.customerProvisioning.findUnique({
		where: { normalizedEmail: recipientEmail },
		select: { stripeCustomerId: true },
	})
	const stripeCustomerId = existingBilling?.stripeCustomerId ?? null

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

	let checkoutUrl: string
	let checkoutSessionId: string
	try {
		const checkout = await createSponsoredRecipientCheckout({
			applicationId: params.applicationId,
			seatId: reservation,
			email: recipientEmail,
			name: application.name,
			memberId: member ? String(member.id) : null,
			stripeCustomerId,
		})
		checkoutUrl = checkout.checkoutUrl
		checkoutSessionId = checkout.checkoutSessionId
	} catch (error) {
		console.error('sponsored_recipient_checkout_failed', {
			applicationId: params.applicationId,
			message: error instanceof Error ? error.message : 'unknown_error',
		})
		await releaseReservation(params.applicationId).catch(() => {})
		return { ok: false, reason: 'checkout_failed' }
	}

	try {
		await sendSponsoredRecipientCheckout({
			to: recipientEmail,
			name: application.name,
			checkoutUrl,
		})
	} catch (error) {
		console.error('sponsored_recipient_checkout_email_failed', {
			applicationId: params.applicationId,
			message: error instanceof Error ? error.message : 'unknown_error',
		})
		await releaseReservation(params.applicationId).catch(() => {})
		return { ok: false, reason: 'email_failed' }
	}

	await createAuditEvent(params.payload, {
		actorType: 'admin',
		actorId: params.administratorId,
		action: 'sponsored.application.checkout_sent',
		targetCollection: 'payload_pay_it_forward_funding',
		targetId: null,
		after: {
			applicationId: params.applicationId,
			seatId: reservation,
			mode: params.mode,
			recipientEmail,
			checkoutSessionId,
			status: 'processing',
		},
	}).catch((error) => {
		console.error('sponsored_admin_grant_audit_failed', {
			applicationId: params.applicationId,
			message: error instanceof Error ? error.message : 'unknown_error',
		})
	})

	return {
		ok: true,
		applicationId: params.applicationId,
		memberId: member ? String(member.id) : '',
		createdMember: false,
		emailSent: true,
		checkoutUrl,
	}
}
