import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import {
	getSponsoredSeatRedirects,
	getSponsoredPriceId,
	normalizeSponsoredTier,
	resolveSponsoredCheckoutMode,
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

	const mode = resolveSponsoredCheckoutMode()
	console.info('sponsored_checkout_mode', { mode, tier })
	const priceId = getSponsoredPriceId({ tier, mode })
	if (!priceId) {
		return NextResponse.json(
			{ ok: false, reason: 'missing_price_id', mode, tier },
			{ status: 400 }
		)
	}

	let redirects: { successUrl: string; cancelUrl: string }
	try {
		redirects = getSponsoredSeatRedirects()
	} catch (error) {
		return NextResponse.json(
			{ ok: false, reason: 'redirects_missing' },
			{ status: 500 }
		)
	}

	const stripe = getStripe()
	const session = await stripe.checkout.sessions.create({
		mode: 'payment',
		line_items: [
			{
				price: priceId,
				quantity: 1,
			},
		],
		success_url: redirects.successUrl,
		cancel_url: redirects.cancelUrl,
		metadata: {
			purpose: 'sponsored_seat',
			tier,
		},
	})

	if (!session.url) {
		return NextResponse.json(
			{ ok: false, reason: 'missing_session_url' },
			{ status: 500 }
		)
	}

	return NextResponse.json({ ok: true, url: session.url })
}
