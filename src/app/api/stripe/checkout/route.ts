import { NextRequest, NextResponse } from 'next/server'
import { getStripeClient } from '@/libs/stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type PricingPlanKey = 'pro' | 'vip'

function isPricingPlanKey(value: string | null): value is PricingPlanKey {
	return value === 'pro' || value === 'vip'
}

function getPlanFromProductId(productId: string | null): PricingPlanKey | null {
	if (!productId) return null

	if (productId === process.env.NEXT_PUBLIC_STRIPE_PRODUCT_PRO) return 'pro'
	if (productId === process.env.NEXT_PUBLIC_STRIPE_PRODUCT_VIP) return 'vip'

	return null
}

async function getPriceIdForPlan(plan: PricingPlanKey) {
	const stripe = getStripeClient()

	const productId =
		plan === 'pro'
			? process.env.NEXT_PUBLIC_STRIPE_PRODUCT_PRO
			: process.env.NEXT_PUBLIC_STRIPE_PRODUCT_VIP

	const configuredPriceId =
		plan === 'pro'
			? process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO
			: process.env.NEXT_PUBLIC_STRIPE_PRICE_VIP

	if (configuredPriceId) return { priceId: configuredPriceId, productId }

	if (!productId) {
		throw new Error(`Missing Stripe product id for plan: ${plan}`)
	}

	const product = await stripe.products.retrieve(productId)

	const defaultPriceId =
		typeof product.default_price === 'string' ? product.default_price : product.default_price?.id

	if (!defaultPriceId) {
		throw new Error(`No default_price found for Stripe product: ${productId}`)
	}

	return { priceId: defaultPriceId, productId }
}

export async function GET(req: NextRequest) {
	try {
		const planParam = req.nextUrl.searchParams.get('plan')
		const productParam = req.nextUrl.searchParams.get('product')

		const plan = isPricingPlanKey(planParam) ? planParam : getPlanFromProductId(productParam)

		if (!plan) {
			return NextResponse.json(
				{
					error:
						"Invalid plan. Use ?plan=pro|vip (or a valid ?product=prod_... id).",
				},
				{ status: 400 }
			)
		}

		const stripe = getStripeClient()
		const origin = req.nextUrl.origin
		const { priceId, productId } = await getPriceIdForPlan(plan)

		const session = await stripe.checkout.sessions.create({
			mode: 'subscription',
			line_items: [{ price: priceId, quantity: 1 }],
			success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
			cancel_url: `${origin}/#pricing`,
			allow_promotion_codes: true,
			metadata: {
				plan,
				productId: productId ?? '',
			},
			subscription_data: {
				metadata: {
					plan,
				},
			},
		})

		if (!session.url) {
			return NextResponse.json(
				{ error: 'Stripe checkout session URL was not returned.' },
				{ status: 500 }
			)
		}

		return NextResponse.redirect(session.url, { status: 303 })
	} catch (error) {
		console.error('Stripe checkout error:', error)
		return NextResponse.json(
			{ error: 'Failed to create Stripe checkout session.' },
			{ status: 500 }
		)
	}
}

