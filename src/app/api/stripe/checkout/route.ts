import { NextRequest, NextResponse } from 'next/server'
import { getStripeConfig, type StripeConfig } from '@/lib/config'
import { getPlanFromPriceId, type Plan } from '@/lib/plans'
import { getStripe } from '@/lib/stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type PricingPlanKey = Plan

function isPricingPlanKey(value: string | null): value is PricingPlanKey {
	return value === 'pro' || value === 'vip'
}

function getPriceIdForPlan(plan: PricingPlanKey, stripeConfig: StripeConfig['stripe']) {
	return plan === 'pro' ? stripeConfig.pricePro : stripeConfig.priceVip
}

async function getActiveMembershipSubscriptionForCustomer(customerId: string) {
	const stripe = getStripe()

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
	return getPlanFromPriceId(priceId)
}

function buildReturnUrl(pathOrUrl: string, appUrl: string) {
	return new URL(pathOrUrl, appUrl).toString()
}

export async function GET(req: NextRequest) {
	try {
		const stripeConfig = getStripeConfig()
		const planParam = req.nextUrl.searchParams.get('plan')
		const customerParam = req.nextUrl.searchParams.get('customer')
		if (!process.env.WP_PROVISION_ENDPOINT) {
			console.info('WP provisioning config missing; checkout continues without provisioning.')
		}

		const plan = isPricingPlanKey(planParam) ? planParam : null

		if (!plan) {
			return NextResponse.json(
				{
					error: 'Invalid plan. Use ?plan=pro|vip.',
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
