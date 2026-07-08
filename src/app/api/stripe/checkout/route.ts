import { NextRequest, NextResponse } from 'next/server'
import { getStripeConfig, type StripeConfig } from '@/lib/config'
import { verifyBillingPortalToken } from '@/lib/billing-portal-token'
import { getStripe } from '@/lib/stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type PricingPlanKey = 'pro'
type ProBillingOption = 'monthly' | 'annual'

function isPricingPlanKey(value: string | null): value is PricingPlanKey {
	return value === 'pro'
}

function isProBillingOption(value: string | null): value is ProBillingOption {
	return value === 'monthly' || value === 'annual'
}

function getPriceIdForPlan(
	plan: PricingPlanKey,
	billing: ProBillingOption,
	stripeConfig: StripeConfig['stripe']
) {
	return billing === 'annual' ? stripeConfig.priceProAnnual : stripeConfig.pricePro
}

function buildReturnUrl(pathOrUrl: string, appUrl: string) {
	return new URL(pathOrUrl, appUrl).toString()
}

function extractBearerToken(req: NextRequest): string | null {
	const auth = req.headers.get('authorization') ?? ''
	const match = auth.match(/Bearer\s+(.*)$/i)
	if (match) return match[1].trim()
	return null
}

export async function GET(req: NextRequest) {
	try {
		const stripeConfig = getStripeConfig()
		const planParam = req.nextUrl.searchParams.get('plan')
		const billingParam = req.nextUrl.searchParams.get('billing')
		const tokenParam =
			extractBearerToken(req) || req.nextUrl.searchParams.get('token')?.trim() || null

		const normalizedPlan = planParam ? planParam.toLowerCase() : null
		const plan = isPricingPlanKey(normalizedPlan) ? normalizedPlan : null
		const billing = isProBillingOption(billingParam?.toLowerCase() ?? null) ? billingParam!.toLowerCase() as ProBillingOption : 'monthly'

		if (!plan) {
			return NextResponse.json(
				{
					error: 'Invalid plan. Use ?plan=pro with optional &billing=monthly|annual.',
				},
				{ status: 400 }
			)
		}

		const stripe = getStripe()
		const priceId = getPriceIdForPlan(plan, billing, stripeConfig.stripe)
		const successUrl = buildReturnUrl(stripeConfig.stripe.successUrl, stripeConfig.app.url)
		const cancelUrl = buildReturnUrl(stripeConfig.stripe.cancelUrl, stripeConfig.app.url)
		let customerEmail: string | null = null

		if (tokenParam) {
			const tokenSecret = (process.env.BILLING_PORTAL_HMAC_SECRET || '').trim()
			if (!tokenSecret) {
				return NextResponse.json(
					{ error: 'Billing token verification is not configured.' },
					{ status: 500 }
				)
			}

			const verification = verifyBillingPortalToken(tokenParam, tokenSecret)
			if (!verification.ok) {
				return NextResponse.json(
					{ error: 'Invalid or expired billing token.' },
					{ status: 401 }
				)
			}

			customerEmail = verification.payload.email
		}

		const session = await stripe.checkout.sessions.create({
			mode: 'subscription',
			line_items: [{ price: priceId, quantity: 1 }],
			success_url: successUrl,
			cancel_url: cancelUrl,
			allow_promotion_codes: true,
			...(customerEmail
				? {
						customer_email: customerEmail,
				  }
				: {}),
			metadata: {
				plan,
				billing,
				source: 'landing',
			},
			subscription_data: {
				metadata: {
					plan,
					billing,
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
