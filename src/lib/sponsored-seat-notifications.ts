import 'server-only'
import prisma from '@/libs/prisma'
import { redactEmail } from '@/lib/log-redact'
import {
	sendSponsoredDonorEmail,
	sendSponsoredSeatAdminEmail,
} from '@/lib/sponsored-email'

async function createPayItForwardPayloadRecord(params: {
	seatId: string
	donorEmail: string | null
	stripeCheckoutSessionId: string
	stripePaymentIntentId: string
	createdAt: Date
}): Promise<void> {
	try {
		const { getPayload } = await import('payload')
		const { default: config } = await import('@/payload.config')
		const payload = await getPayload({ config })
		const dateStr = params.createdAt.toISOString().slice(0, 10)
		const displayName = `Pay it forward — ${params.donorEmail ?? 'anonymous'} — ${dateStr}`
		const existing = await payload.find({
			collection: 'payload_pay_it_forward_funding',
			where: { stripePaymentIntentId: { equals: params.stripePaymentIntentId } },
			limit: 1,
			depth: 0,
			overrideAccess: true,
		})
		if (existing.docs[0]) return

		await payload.create({
			collection: 'payload_pay_it_forward_funding',
			data: {
				displayName,
				sponsorEmail: params.donorEmail ?? undefined,
				stripeCheckoutSessionId: params.stripeCheckoutSessionId,
				stripePaymentIntentId: params.stripePaymentIntentId,
				purchasedAt: params.createdAt.toISOString(),
				seatStatus: 'available',
				amountPaidMinor: 8000,
			},
			overrideAccess: true,
		})
	} catch (error) {
		console.error('pay_it_forward_payload_record_create_failed', {
			seatId: params.seatId,
			message: (error as Error).message,
		})
	}
}

export async function notifySponsoredSeatPurchase(params: {
	seatId: string
	donorEmail: string | null
}): Promise<void> {
	const seat = await prisma.sponsoredSeat.findUnique({
		where: { id: params.seatId },
	})
	if (!seat) return

	const donorEmail = params.donorEmail?.trim() || null
	const now = new Date()

	await createPayItForwardPayloadRecord({
		seatId: seat.id,
		donorEmail,
		stripeCheckoutSessionId: seat.stripeCheckoutSessionId,
		stripePaymentIntentId: seat.stripePaymentIntentId,
		createdAt: seat.createdAt,
	})

	if (donorEmail && !seat.donorEmailSentAt) {
		try {
			await sendSponsoredDonorEmail({ to: donorEmail })
			await prisma.sponsoredSeat.updateMany({
				where: { id: seat.id, donorEmailSentAt: null },
				data: { donorEmailSentAt: now },
			})
		} catch (error) {
			console.error('sponsored_donor_email_failed', {
				seatId: seat.id,
				email: redactEmail(donorEmail),
				message: (error as Error).message,
			})
		}
	}

	if (!seat.adminNotifiedAt) {
		try {
			await sendSponsoredSeatAdminEmail({
				donorEmail,
				occurredAt: now,
			})
			await prisma.sponsoredSeat.updateMany({
				where: { id: seat.id, adminNotifiedAt: null },
				data: { adminNotifiedAt: now },
			})
		} catch (error) {
			console.error('sponsored_seat_admin_email_failed', {
				seatId: seat.id,
				email: donorEmail ? redactEmail(donorEmail) : null,
				message: (error as Error).message,
			})
		}
	}
}
