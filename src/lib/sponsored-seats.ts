import 'server-only'
import { createHash } from 'crypto'
import prisma from '@/libs/prisma'
import type Stripe from 'stripe'
import { getStripeConfig } from '@/lib/stripe-config'

export type SponsoredTier = 'pro' | 'vip'

export type SponsoredSeatCounts = {
	pro: number
	vip: number
}

export type SponsoredMode = 'test' | 'live'

const VALID_TIERS: SponsoredTier[] = ['pro', 'vip']

export function normalizeSponsoredTier(
	value: string | null | undefined
): SponsoredTier | null {
	if (!value) return null
	const normalized = value.trim().toLowerCase()
	return VALID_TIERS.includes(normalized as SponsoredTier)
		? (normalized as SponsoredTier)
		: null
}

export function resolveSponsoredCheckoutMode(): SponsoredMode {
	if (process.env.STRIPE_LIVEMODE === 'true') {
		return 'live'
	}
	let secretKey = ''
	try {
		secretKey = getStripeConfig().secretKey
	} catch {
		secretKey =
			(process.env.STRIPE_SECRET_KEY_TEST || process.env.STRIPE_SECRET_KEY_LIVE || '')
				.trim() || ''
	}
	if (secretKey.startsWith('sk_live_')) {
		return 'live'
	}
	return 'test'
}

export function hashEmail(value: string): string {
	const normalized = value.trim().toLowerCase()
	return createHash('sha256').update(normalized).digest('hex')
}

export async function getSponsoredSeatCounts(): Promise<SponsoredSeatCounts> {
	const [proCount, vipCount] = await Promise.all([
		prisma.sponsoredSeat.count({
			where: {
				tier: 'pro',
				claimedByWpUserId: null,
			},
		}),
		prisma.sponsoredSeat.count({
			where: {
				tier: 'vip',
				claimedByWpUserId: null,
			},
		}),
	])

	return {
		pro: proCount,
		vip: vipCount,
	}
}

export function getSponsoredPriceId(params: {
	tier: SponsoredTier
	mode: SponsoredMode
}): string | null {
	const key = `SPONSORED_${params.tier.toUpperCase()}_PRICE_ID_${params.mode.toUpperCase()}`
	const value = process.env[key] || ''
	const trimmed = value.trim()
	return trimmed.length > 0 ? trimmed : null
}

export function getSponsoredSeatRedirects(): {
	successUrl: string
	cancelUrl: string
} {
	const successUrl = (process.env.SPONSORED_SEATS_SUCCESS_URL || '').trim()
	const cancelUrl = (process.env.SPONSORED_SEATS_CANCEL_URL || '').trim()
	if (!successUrl || !cancelUrl) {
		throw new Error('Sponsored seats redirect URLs are not configured.')
	}
	return { successUrl, cancelUrl }
}

export function isSponsoredSeatSession(
	session: Stripe.Checkout.Session
): SponsoredTier | null {
	const purpose = session.metadata?.purpose?.trim().toLowerCase()
	if (purpose !== 'sponsored_seat') return null
	return normalizeSponsoredTier(session.metadata?.tier ?? null)
}

export async function upsertSponsoredSeatFromSession(params: {
	session: Stripe.Checkout.Session
	tier: SponsoredTier
}): Promise<{ seatId: string | null; created: boolean }> {
	const sessionId = params.session.id
	const paymentIntentId =
		typeof params.session.payment_intent === 'string'
			? params.session.payment_intent
			: params.session.payment_intent?.id ?? null

	if (!sessionId || !paymentIntentId) {
		return { seatId: null, created: false }
	}

	const donatedEmail = params.session.customer_details?.email ?? null
	const donatedHash = donatedEmail ? hashEmail(donatedEmail) : null

	const existing = await prisma.sponsoredSeat.findUnique({
		where: { stripePaymentIntentId: paymentIntentId },
	})

	if (existing) {
		if (existing.stripeCheckoutSessionId !== sessionId) {
			console.warn('sponsored_seat_session_mismatch', {
				seatId: existing.id,
				tier: existing.tier,
			})
			return { seatId: existing.id, created: false }
		}

		if (!existing.donatedByEmailHash && donatedHash) {
			await prisma.sponsoredSeat.update({
				where: { id: existing.id },
				data: {
					donatedByEmailHash: donatedHash,
				},
			})
		}
		return { seatId: existing.id, created: false }
	}

	const created = await prisma.sponsoredSeat.create({
		data: {
			tier: params.tier,
			stripePaymentIntentId: paymentIntentId,
			stripeCheckoutSessionId: sessionId,
			donatedByEmailHash: donatedHash,
		},
	})

	return { seatId: created.id, created: true }
}
