import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/libs/prisma'
import { getStripe } from '@/lib/stripe'
import { normalizePlan, resolvePlanFromStripe, type Plan } from '@/lib/plans'
import { verifyBillingPortalToken } from '@/lib/billing-portal-token'
import { normalizeEmail as normalizeEmailAddress } from '@/lib/normalize-email'
import type Stripe from 'stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_STATUSES = new Set<Stripe.Subscription.Status>([
	'active',
	'trialing',
	'past_due',
])

// Smoke test:
// curl -i -H "Authorization: Bearer <token>" https://jpvbootcamp.com/api/entitlements

type EntitlementsResponse = {
	plan: Plan | 'free'
}

type EntitlementsError = {
	ok: false
	reason: string
	error: string
}

function isEnvEnabled(value?: string): boolean {
	if (!value) return false
	return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

function extractBearerToken(req: NextRequest): string | null {
	const auth = req.headers.get('authorization') ?? ''
	const match = auth.match(/Bearer\s+(.*)$/i)
	if (match) return match[1].trim()
	return null
}

function resolvePlanFromSubscriptions(subscriptions: Stripe.Subscription[]): Plan | null {
	let found: Plan | null = null
	for (const sub of subscriptions) {
		if (!ALLOWED_STATUSES.has(sub.status)) continue
		const metadataPlan =
			typeof sub.metadata?.plan === 'string' ? sub.metadata.plan : null
		for (const item of sub.items.data) {
			const price = item.price ?? null
			const priceId = price?.id ?? null
			const productId =
				typeof price?.product === 'string'
					? price.product
					: price?.product?.id ?? null
			const plan = resolvePlanFromStripe({ metadataPlan, priceId, productId })
			if (plan === 'pro') found = 'pro'
		}
	}
	return found
}

async function searchStripeCustomerIdByEmail(email: string): Promise<string | null> {
	const stripe = getStripe()
	const result = await stripe.customers.search({
		query: `email:"${email}"`,
		limit: 10,
	})
	return result.data[0]?.id ?? null
}

export async function GET(req: NextRequest) {
	const token = extractBearerToken(req)
	const tokenSecret = (process.env.BILLING_PORTAL_HMAC_SECRET || '').trim()

	if (!token) {
		return NextResponse.json(
			{ ok: false, reason: 'unauthorized', error: 'Missing token.' } as EntitlementsError,
			{ status: 401 }
		)
	}

	if (!tokenSecret) {
		return NextResponse.json(
			{ ok: false, reason: 'server_misconfigured', error: 'Missing token secret.' } as EntitlementsError,
			{ status: 500 }
		)
	}

	const verification = verifyBillingPortalToken(token, tokenSecret)
	if (verification.ok === false) {
		return NextResponse.json(
			{ ok: false, reason: 'unauthorized', error: 'Invalid token.' } as EntitlementsError,
			{ status: 401 }
		)
	}

	const email = normalizeEmailAddress(verification.payload.email)
	if (!email) {
		return NextResponse.json(
			{ ok: false, reason: 'unauthorized', error: 'Invalid token.' } as EntitlementsError,
			{ status: 401 }
		)
	}

	const record = await prisma.customerProvisioning.findUnique({
		where: { normalizedEmail: email },
		select: {
			currentPlan: true,
			plan: true,
			stripeCustomerId: true,
			subscriptionStatus: true,
			billingCadence: true,
			paymentStatus: true,
			paymentGraceEndsAt: true,
			lastPaidInvoiceId: true,
		},
	})

	const storedPlan = normalizePlan(record?.currentPlan ?? record?.plan ?? null)
	const subscriptionStatus = record?.subscriptionStatus ?? null
	const graceActive = Boolean(
		record?.paymentGraceEndsAt && record.paymentGraceEndsAt.getTime() >= Date.now(),
	)
	const monthlyCommitment = record?.billingCadence === 'monthly_commitment'
	const monthlyPaymentVerified = !monthlyCommitment || Boolean(record?.lastPaidInvoiceId)

	if (subscriptionStatus === 'unpaid' || subscriptionStatus === 'canceled') {
		return NextResponse.json({ plan: 'free' } satisfies EntitlementsResponse, { status: 200 })
	}
	if (subscriptionStatus === 'past_due') {
		return NextResponse.json(
			{ plan: graceActive && storedPlan ? storedPlan : 'free' } satisfies EntitlementsResponse,
			{ status: 200 },
		)
	}
	if (subscriptionStatus === 'active' || subscriptionStatus === 'trialing') {
		return NextResponse.json(
			{ plan: monthlyPaymentVerified && storedPlan ? storedPlan : 'free' } satisfies EntitlementsResponse,
			{ status: 200 },
		)
	}
	if (record?.paymentStatus === 'failed' || record?.paymentStatus === 'action_required') {
		return NextResponse.json(
			{ plan: graceActive && storedPlan ? storedPlan : 'free' } satisfies EntitlementsResponse,
			{ status: 200 },
		)
	}
	if (subscriptionStatus) {
		return NextResponse.json({ plan: 'free' } satisfies EntitlementsResponse, { status: 200 })
	}
	if (storedPlan) {
		return NextResponse.json({ plan: storedPlan } satisfies EntitlementsResponse, { status: 200 })
	}

	const allowStripeSearch = isEnvEnabled(process.env.STRIPE_CUSTOMER_SEARCH_ENABLED)
	if (allowStripeSearch) {
		let stripeCustomerId = record?.stripeCustomerId ?? null

		if (!stripeCustomerId) {
			stripeCustomerId = await searchStripeCustomerIdByEmail(email)
		}

		if (stripeCustomerId) {
			const stripe = getStripe()
			const list = await stripe.subscriptions.list({
				customer: stripeCustomerId,
				status: 'all',
				limit: 10,
				expand: ['data.items.data.price'],
			})
			const resolved = resolvePlanFromSubscriptions(list.data)
			if (resolved) {
				return NextResponse.json(
					{ plan: resolved } satisfies EntitlementsResponse,
					{ status: 200 }
				)
			}
		}
	}

	return NextResponse.json({ plan: 'free' } satisfies EntitlementsResponse, { status: 200 })
}
