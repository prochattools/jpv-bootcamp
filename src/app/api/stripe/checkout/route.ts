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

	// Backward compat: if callers still pass the membership product id, default to Pro.
	if (productId === process.env.NEXT_PUBLIC_STRIPE_PRODUCT_JPV_BOOTCAMP_MEMBERSHIP) return 'pro'

	return null
}

async function getPriceIdForPlan(plan: PricingPlanKey) {
	const stripe = getStripeClient()

	const productId = process.env.NEXT_PUBLIC_STRIPE_PRODUCT_JPV_BOOTCAMP_MEMBERSHIP

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

async function getActiveMembershipSubscriptionForCustomer(customerId: string) {
	const stripe = getStripeClient()

	const subs = await stripe.subscriptions.list({
		customer: customerId,
		status: 'active',
		limit: 10,
		expand: ['data.items.data.price'],
	})

	// Prefer a subscription that looks like our membership (metadata.plan set by our Checkout)
	const byMetadata = subs.data.find((s) =>
		s.metadata?.plan === 'pro' || s.metadata?.plan === 'vip'
	)
	if (byMetadata) return byMetadata

	// Fallback: pick the first active subscription
	return subs.data[0] ?? null
}

function getSubscriptionItemId(sub: any): string | null {
	const item = sub?.items?.data?.[0]
	return item?.id ?? null
}

function getCurrentPlanFromSubscription(sub: any): PricingPlanKey | null {
	const meta = sub?.metadata?.plan
	if (meta === 'pro' || meta === 'vip') return meta

	// If metadata isn't present, try to infer from price ids (best-effort)
	const priceId = sub?.items?.data?.[0]?.price?.id
	if (!priceId) return null
	if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO) return 'pro'
	if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_VIP) return 'vip'

	return null
}

export async function GET(req: NextRequest) {
	try {
		const planParam = req.nextUrl.searchParams.get('plan')
		const productParam = req.nextUrl.searchParams.get('product')
		const customerParam = req.nextUrl.searchParams.get('customer')

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

		// If the user is already on Pro and is requesting VIP, send them to a Portal upgrade flow
		// (prevents accidentally creating a 2nd subscription via Checkout).
		if (customerParam && plan === 'vip') {
			const activeSub = await getActiveMembershipSubscriptionForCustomer(customerParam)
			if (activeSub) {
				const currentPlan = getCurrentPlanFromSubscription(activeSub)
				if (currentPlan === 'pro') {
					const itemId = getSubscriptionItemId(activeSub)
					if (!itemId) {
						return NextResponse.json(
							{ error: 'Could not determine subscription item to upgrade.' },
							{ status: 500 }
						)
					}

					// Stripe-hosted upgrade confirmation flow.
					// NOTE: Your Customer Portal configuration must allow upgrading to the VIP price.
					const portalSession = await stripe.billingPortal.sessions.create({
						customer: customerParam,
						return_url: `${origin}/#pricing`,
						flow_data: {
							type: 'subscription_update_confirm',
							subscription_update_confirm: {
								subscription: activeSub.id,
								items: [
									{
										id: itemId,
										price: priceId,
									},
								],
							},
						},
					},
					)

					if (!portalSession.url) {
						return NextResponse.json(
							{ error: 'Stripe portal session URL was not returned.' },
							{ status: 500 }
						)
					}

					return NextResponse.redirect(portalSession.url, { status: 303 })
				}
			}
		}

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
