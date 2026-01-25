import 'server-only'
import prisma from '@/libs/prisma'
import { redactEmail } from '@/lib/log-redact'
import {
	sendSponsoredDonorEmail,
	sendSponsoredSeatAdminEmail,
} from '@/lib/sponsored-email'

export async function notifySponsoredSeatPurchase(params: {
	seatId: string
	tier: 'pro' | 'vip'
	donorEmail: string | null
}): Promise<void> {
	const seat = await prisma.sponsoredSeat.findUnique({
		where: { id: params.seatId },
	})
	if (!seat) return

	const donorEmail = params.donorEmail?.trim() || null
	const now = new Date()

	if (donorEmail && !seat.donorEmailSentAt) {
		try {
			await sendSponsoredDonorEmail({ to: donorEmail, tier: params.tier })
			await prisma.sponsoredSeat.updateMany({
				where: { id: seat.id, donorEmailSentAt: null },
				data: { donorEmailSentAt: now },
			})
		} catch (error) {
			console.error('sponsored_donor_email_failed', {
				seatId: seat.id,
				email: redactEmail(donorEmail),
				tier: params.tier,
				message: (error as Error).message,
			})
		}
	}

	if (!seat.adminNotifiedAt) {
		try {
			await sendSponsoredSeatAdminEmail({
				donorEmail,
				tier: params.tier,
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
				tier: params.tier,
				message: (error as Error).message,
			})
		}
	}
}
