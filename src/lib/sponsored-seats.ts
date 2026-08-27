import 'server-only'
import { createHash } from 'crypto'
import prisma from '@/libs/prisma'
import { getPublicBaseUrl } from '@/lib/public-base-url'
import type Stripe from 'stripe'

export type SponsoredTier = 'free'

export type SponsoredSeatCounts = {
	available: number
}

const VALID_TIERS: SponsoredTier[] = ['free']

export function normalizeSponsoredTier(
	value: string | null | undefined
): SponsoredTier | null {
	if (!value) return null
	const normalized = value.trim().toLowerCase()
	return VALID_TIERS.includes(normalized as SponsoredTier)
		? (normalized as SponsoredTier)
		: null
}

export function hashEmail(value: string): string {
	const normalized = value.trim().toLowerCase()
	return createHash('sha256').update(normalized).digest('hex')
}

export async function getSponsoredSeatCounts(): Promise<SponsoredSeatCounts> {
	const available = await prisma.sponsoredSeat.count({
		where: {
			tier: 'free',
			claimedByAccountId: null,
			reservedByApplicationId: null,
		},
	})

	return { available }
}

export function getSponsoredPriceId(): string | null {
	const stripeEnv = (process.env.STRIPE_ENV || '').trim().toLowerCase()
	const suffix = stripeEnv === 'live' ? 'LIVE' : 'TEST'
	const envKey = `SPONSORED_SUPPORT_PRICE_ID_${suffix}`
	const fallbackKey = 'SPONSORED_SUPPORT_PRICE_ID'
	const value = process.env[envKey] || process.env[fallbackKey] || ''
	const trimmed = value.trim()
	return trimmed.length > 0 ? trimmed : null
}

export function getSponsoredSeatRedirects(): {
	successUrl: string
	cancelUrl: string
} {
	const baseUrl = (process.env.DEPLOYMENT_ENV?.trim().toLowerCase() === 'production'
		? 'https://jpvbootcamp.com'
		: getPublicBaseUrl()
	).replace(/\/$/, '')
	const configuredCancelUrl = (process.env.SPONSORED_SEATS_CANCEL_URL || '').trim()
	let cancelUrl = `${baseUrl}/sponsored`
	if (configuredCancelUrl) {
		const resolved = new URL(configuredCancelUrl, baseUrl)
		if (resolved.origin !== new URL(baseUrl).origin) {
			throw new Error('Sponsored seats cancel URL must be on the public application origin.')
		}
		cancelUrl = resolved.toString()
	}

	// Donor checkouts must never inherit the normal member success page. The
	// endpoint is canonical so a stale preview environment variable cannot turn
	// a donation into a misleading "you're in" confirmation.
	const successUrl = `${baseUrl}/thank-you/sponsor?session_id={CHECKOUT_SESSION_ID}`
	return { successUrl, cancelUrl }
}

export function isSponsoredSeatSession(
	session: Stripe.Checkout.Session
): SponsoredTier | null {
	const purpose = session.metadata?.purpose?.trim().toLowerCase()
	if (purpose !== 'support_credit' && purpose !== 'sponsored_seat') return null
	return 'free'
}

export function isSponsoredRecipientSession(
	session: Stripe.Checkout.Session
): boolean {
	return session.metadata?.purpose?.trim().toLowerCase() === 'sponsored_recipient'
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

	if (!sessionId) {
		return { seatId: null, created: false }
	}

	// Stripe does not create a PaymentIntent for a payment-mode Checkout
	// Session whose total is zero after a 100% coupon. Keep the legacy column
	// populated with a deterministic checkout key so zero-value donor checkouts
	// are still recorded and remain idempotent without a schema migration.
	const transactionKey = paymentIntentId ?? `checkout_session:${sessionId}`

	const donatedEmail =
		params.session.customer_details?.email ?? params.session.customer_email ?? null
	const donatedHash = donatedEmail ? hashEmail(donatedEmail) : null

	const existingBySession = await prisma.sponsoredSeat.findUnique({
		where: { stripeCheckoutSessionId: sessionId },
	})
	const existing = existingBySession ?? await prisma.sponsoredSeat.findUnique({
		where: { stripePaymentIntentId: transactionKey },
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
			stripePaymentIntentId: transactionKey,
			stripeCheckoutSessionId: sessionId,
			donatedByEmailHash: donatedHash,
		},
	})

	return { seatId: created.id, created: true }
}
