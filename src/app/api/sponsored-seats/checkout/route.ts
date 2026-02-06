import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import {
	getSponsoredSeatRedirects,
	getSponsoredPriceId,
	normalizeSponsoredTier,
} from '@/lib/sponsored-seats'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type CheckoutPayload = {
	tier?: string
}

export async function POST(req: NextRequest) {
	let body: CheckoutPayload | null = null
	try {
		body = (await req.json()) as CheckoutPayload
	} catch {
		body = null
	}

	const tier = normalizeSponsoredTier(body?.tier ?? null)
	if (!tier) {
		return NextResponse.json(
			{ ok: false, reason: 'invalid_tier' },
			{ status: 400 }
		)
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
	const hasPricePro = Boolean(getSponsoredPriceId('pro'))
	const hasPriceVip = Boolean(getSponsoredPriceId('vip'))

	console.info('sponsored_checkout_env_check', {
		stripeEnv,
		hasSecretKey,
		hasPublishableKey,
		hasPricePro,
		hasPriceVip,
		tier,
	})

	if (
		(stripeEnvNormalized !== 'test' && stripeEnvNormalized !== 'live') ||
		!hasSecretKey ||
		!hasPublishableKey ||
		!hasPricePro ||
		(tier === 'vip' && !hasPriceVip)
	) {
		return NextResponse.json(
			{ ok: false, reason: 'missing_env' },
			{ status: 400 }
		)
	}

	const priceId = getSponsoredPriceId(tier)
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
				purpose: 'sponsored_seat',
				tier,
			},
		})
	} catch (error) {
		console.error('sponsored_checkout_failed', {
			tier,
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
