import { NextRequest, NextResponse } from 'next/server'
import { getStripeClient } from '@/libs/stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type PricingPlanKey = 'pro' | 'vip'

const STRIPE_PLAN_CONFIG: Record<
	PricingPlanKey,
	{
		productId: string | undefined
		priceId: string | undefined
	}
> = {
	pro: {
		productId: process.env.NEXT_PUBLIC_STRIPE_PRODUCT_JPV_BOOTCAMP_MEMBERSHIP,
		priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO,
	},
	vip: {
		productId: process.env.NEXT_PUBLIC_STRIPE_PRODUCT_JPV_BOOTCAMP_MEMBERSHIP,
		priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_VIP,
	},
}

function isPricingPlanKey(value: string | null): value is PricingPlanKey {
	return value === 'pro' || value === 'vip'
}

function getPlanFromProductId(productId: string | null): PricingPlanKey | null {
	if (!productId) return null

	// Backward compat: if callers still pass the membership product id, default to Pro.
	const membershipProductId = STRIPE_PLAN_CONFIG.pro.productId
	if (membershipProductId && productId === membershipProductId) return 'pro'

	return null
}

function getPlanConfig(plan: PricingPlanKey) {
	const config = STRIPE_PLAN_CONFIG[plan]

	if (!config.productId) {
		throw new Error(
			'Missing Stripe product id. Set NEXT_PUBLIC_STRIPE_PRODUCT_JPV_BOOTCAMP_MEMBERSHIP.'
		)
	}

	if (!config.priceId) {
		const priceEnvName =
			plan === 'pro' ? 'NEXT_PUBLIC_STRIPE_PRICE_PRO' : 'NEXT_PUBLIC_STRIPE_PRICE_VIP'
		throw new Error(`Missing Stripe price id for plan: ${plan}. Set ${priceEnvName}.`)
	}

	return config
}

async function getPriceIdForPlan(plan: PricingPlanKey) {
	return getPlanConfig(plan)
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
	if (STRIPE_PLAN_CONFIG.pro.priceId && priceId === STRIPE_PLAN_CONFIG.pro.priceId) return 'pro'
	if (STRIPE_PLAN_CONFIG.vip.priceId && priceId === STRIPE_PLAN_CONFIG.vip.priceId) return 'vip'

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
