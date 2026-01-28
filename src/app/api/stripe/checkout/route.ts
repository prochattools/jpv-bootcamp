import { NextRequest, NextResponse } from 'next/server'
import { getStripeConfig, type StripeConfig } from '@/lib/config'
import { getStripeEnv } from '@/lib/stripe-config'
import { resolvePlanFromStripe, type Plan } from '@/lib/plans'
import { getStripe } from '@/lib/stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type PricingPlanKey = Plan

function isPricingPlanKey(value: string | null): value is PricingPlanKey {
	return value === 'pro' || value === 'vip' || value === 'exhibitor'
}

function getPriceIdForPlan(plan: PricingPlanKey, stripeConfig: StripeConfig['stripe']) {
	if (plan === 'pro') return stripeConfig.pricePro
	if (plan === 'vip') return stripeConfig.priceVip
	return stripeConfig.priceExhibitor
}

async function getActiveMembershipSubscriptionForCustomer(customerId: string) {
	const stripe = getStripe()

	const subs = await stripe.subscriptions.list({
		customer: customerId,
		status: 'active',
		limit: 10,
		expand: ['data.items.data.price'],
	})

	// Prefer a subscription that contains our membership price/product.
	const byPrice = subs.data.find((sub) =>
		sub.items?.data?.some((item) => {
			const price = item.price ?? null
			const priceId = price?.id ?? null
			const productId =
				typeof price?.product === 'string'
					? price.product
					: price?.product?.id ?? null
			const metadataPlan =
				typeof sub.metadata?.plan === 'string' ? sub.metadata.plan : null
			return Boolean(resolvePlanFromStripe({ metadataPlan, priceId, productId }))
		})
	)
	if (byPrice) return byPrice

	// Fallback: pick the first active subscription
	return subs.data[0] ?? null
}

function getSubscriptionItemId(sub: any): string | null {
	const item = sub?.items?.data?.[0]
	return item?.id ?? null
}

function getCurrentPlanFromSubscription(sub: any): PricingPlanKey | null {
	// Prefer price-based inference to avoid stale metadata after portal upgrades.
	const price = sub?.items?.data?.[0]?.price ?? null
	const priceId = price?.id ?? null
	const productId =
		typeof price?.product === 'string' ? price.product : price?.product?.id ?? null
	const metadataPlan = typeof sub?.metadata?.plan === 'string' ? sub.metadata.plan : null
	return resolvePlanFromStripe({ metadataPlan, priceId, productId })
}

function buildReturnUrl(pathOrUrl: string, appUrl: string) {
	return new URL(pathOrUrl, appUrl).toString()
}

export async function GET(req: NextRequest) {
	try {
		const stripeConfig = getStripeConfig()
		const planParam = req.nextUrl.searchParams.get('plan')
		const customerParam = req.nextUrl.searchParams.get('customer')

		const normalizedPlan = planParam ? planParam.toLowerCase() : null
		const plan = isPricingPlanKey(normalizedPlan) ? normalizedPlan : null

		if (!plan) {
			return NextResponse.json(
				{
					error: 'Invalid plan. Use ?plan=pro|vip|exhibitor.',
				},
				{ status: 400 }
			)
		}

		const stripe = getStripe()
		const priceId = getPriceIdForPlan(plan, stripeConfig.stripe)
		const successUrl = buildReturnUrl(stripeConfig.stripe.successUrl, stripeConfig.app.url)
		const cancelUrl = buildReturnUrl(stripeConfig.stripe.cancelUrl, stripeConfig.app.url)

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
						return_url: cancelUrl,
						configuration: stripeConfig.stripe.portalConfigurationId,
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

					console.info('portal_session_created', {
						stripeEnv: getStripeEnv(),
						configurationId: stripeConfig.stripe.portalConfigurationId,
						customerId: customerParam,
						sourceRoute: '/api/stripe/checkout',
					})

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
			mode: plan === 'exhibitor' ? 'payment' : 'subscription',
			line_items: [{ price: priceId, quantity: 1 }],
			success_url: successUrl,
			cancel_url: cancelUrl,
			allow_promotion_codes: true,
			metadata: {
				plan,
				source: 'landing',
			},
			subscription_data: {
				metadata: {
					plan,
					source: 'landing',
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
