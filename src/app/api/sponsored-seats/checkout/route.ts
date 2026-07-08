import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import {
	getSponsoredSeatRedirects,
	getSponsoredPriceId,
} from '@/lib/sponsored-seats'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
	try {
		await req.json()
	} catch {
		// Body is intentionally ignored; support credits always fund controlled Free access.
	}

	const stripeEnv = (process.env.STRIPE_ENV || '').trim() || 'unknown'
	const stripeEnvNormalized = stripeEnv.toLowerCase()
	const stripeEnvSuffix = stripeEnvNormalized === 'live' ? 'LIVE' : 'TEST'
	const hasSecretKey = Boolean(
		(process.env[`STRIPE_SECRET_KEY_${stripeEnvSuffix}`] || '').trim()
	)
	const hasPublishableKey = Boolean(
		(process.env[`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_${stripeEnvSuffix}`] || '').trim()
	)
	const hasSupportCreditPrice = Boolean(getSponsoredPriceId())

	console.info('sponsored_checkout_env_check', {
		stripeEnv,
		hasSecretKey,
		hasPublishableKey,
		hasSupportCreditPrice,
	})

	if (
		(stripeEnvNormalized !== 'test' && stripeEnvNormalized !== 'live') ||
		!hasSecretKey ||
		!hasPublishableKey ||
		!hasSupportCreditPrice
	) {
		return NextResponse.json(
			{ ok: false, reason: 'missing_env' },
			{ status: 400 }
		)
	}

	const priceId = getSponsoredPriceId()
	if (!priceId) {
		return NextResponse.json(
			{ ok: false, reason: 'missing_env' },
			{ status: 400 }
		)
	}

	let redirects: { successUrl: string; cancelUrl: string }
	try {
		redirects = getSponsoredSeatRedirects()
	} catch (error) {
		return NextResponse.json(
			{ ok: false, reason: 'missing_env' },
			{ status: 500 }
		)
	}

	let session: { url?: string | null } | null = null
	try {
		const stripe = getStripe()
		session = await stripe.checkout.sessions.create({
			mode: 'payment',
			line_items: [
				{
					price: priceId,
					quantity: 1,
				},
			],
			success_url: redirects.successUrl,
			cancel_url: redirects.cancelUrl,
			allow_promotion_codes: true,
			metadata: {
				purpose: 'support_credit',
				access: 'free',
			},
		})
	} catch (error) {
		console.error('sponsored_checkout_failed', {
			message: (error as Error).message,
		})
		return NextResponse.json(
			{ ok: false, reason: 'stripe_error' },
			{ status: 500 }
		)
	}

	if (!session?.url) {
		return NextResponse.json(
			{ ok: false, reason: 'stripe_error' },
			{ status: 500 }
		)
	}

	return NextResponse.json({ ok: true, url: session.url })
}
