import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/libs/prisma'
import { getStripe } from '@/lib/stripe'
import { getStripeConfig } from '@/lib/config'
import { verifyBillingPortalToken } from '@/lib/billing-portal-token'
import type Stripe from 'stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEFAULT_RETURN_URL = 'https://portal.jpvbootcamp.com/community/'
const ALLOWED_RETURN_ORIGINS = new Set([
	'https://portal.jpvbootcamp.com',
	'https://jpvbootcamp.com',
])

const ALLOWED_STATUSES = new Set<Stripe.Subscription.Status>([
	'active',
	'trialing',
	'past_due',
])

type UpgradeResult = {
	ok: true
	reason: string
	redirectUrl: string
}

type UpgradeError = {
	ok: false
	reason: string
	error: string
}

function isEnvEnabled(value?: string): boolean {
	if (!value) return false
	return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

function safeDecodeURIComponent(value: string): string {
	try {
		return decodeURIComponent(value)
	} catch {
		return value
	}
}

function stripChainedUrl(value: string): string {
	const regex = /https?:\/\//gi
	const first = regex.exec(value)
	if (!first) return value
	const second = regex.exec(value)
	if (!second) return value
	return value.slice(0, second.index)
}

function resolveReturnUrl(raw: string | null): string {
	if (!raw) return DEFAULT_RETURN_URL
	const trimmed = raw.trim()
	if (!trimmed) return DEFAULT_RETURN_URL
	const decoded = safeDecodeURIComponent(trimmed)
	const candidate = stripChainedUrl(decoded)
	try {
		const resolved = new URL(candidate, DEFAULT_RETURN_URL)
		if (!ALLOWED_RETURN_ORIGINS.has(resolved.origin)) {
			return DEFAULT_RETURN_URL
		}
		return resolved.toString()
	} catch {
		return DEFAULT_RETURN_URL
	}
}

function normalizeEmail(value: string | null | undefined): string | null {
	if (!value) return null
	const trimmed = value.trim().toLowerCase()
	return trimmed.length > 0 ? trimmed : null
}

function extractEmailDomain(email: string | null): string | null {
	if (!email) return null
	const atIndex = email.indexOf('@')
	if (atIndex <= 0 || atIndex === email.length - 1) return null
	return email.slice(atIndex + 1)
}

function appendReturnParam(url: string, key: string, value: string): string {
	try {
		const parsed = new URL(url)
		parsed.searchParams.set(key, value)
		return parsed.toString()
	} catch {
		return url
	}
}

function extractBearerToken(req: NextRequest): string | null {
	const auth = req.headers.get('authorization') ?? ''
	const match = auth.match(/Bearer\s+(.*)$/i)
	if (match) return match[1].trim()
	return null
}

async function getStripeCustomerRecord(email: string): Promise<{
	stripeCustomerId: string | null
	stripeSubscriptionId: string | null
}> {
	const record = await prisma.customerProvisioning.findFirst({
		where: {
			email: { equals: email, mode: 'insensitive' },
		},
		select: { stripeCustomerId: true, stripeSubscriptionId: true },
	})

	return {
		stripeCustomerId: record?.stripeCustomerId ?? null,
		stripeSubscriptionId: record?.stripeSubscriptionId ?? null,
	}
}

async function searchStripeCustomerIdByEmail(email: string): Promise<string | null> {
	const stripe = getStripe()
	const result = await stripe.customers.search({
		query: `email:"${email}"`,
		limit: 10,
	})
	return result.data[0]?.id ?? null
}

function findSubscriptionMatch(params: {
	subscriptions: Stripe.Subscription[]
	pricePro: string
	priceVip: string
}): {
	match: Stripe.Subscription | null
	item: Stripe.SubscriptionItem | null
	plan: 'pro' | 'vip' | null
} {
	let proMatch: Stripe.Subscription | null = null
	let proItem: Stripe.SubscriptionItem | null = null
	let vipMatch: Stripe.Subscription | null = null
	let vipItem: Stripe.SubscriptionItem | null = null

	for (const sub of params.subscriptions) {
		if (!ALLOWED_STATUSES.has(sub.status)) continue
		for (const item of sub.items.data) {
			const priceId = item.price?.id
			if (!priceId) continue
			if (priceId === params.priceVip) {
				vipMatch = sub
				vipItem = item
				break
			}
			if (priceId === params.pricePro && !proMatch) {
				proMatch = sub
				proItem = item
			}
		}
	}

	if (vipMatch && vipItem) {
		return { match: vipMatch, item: vipItem, plan: 'vip' }
	}
	if (proMatch && proItem) {
		return { match: proMatch, item: proItem, plan: 'pro' }
	}
	return { match: null, item: null, plan: null }
}

function resolvePaymentRedirect(
	invoice: Stripe.Invoice | null,
	returnUrl: string
): { redirectUrl: string; reason: string } {
	if (!invoice) {
		return { redirectUrl: appendReturnParam(returnUrl, 'jpv_upgrade', 'success'), reason: 'upgraded' }
	}

	const amountDue = invoice.amount_due ?? 0
	const paymentIntent =
		invoice.payment_intent && typeof invoice.payment_intent !== 'string'
			? invoice.payment_intent
			: null

	const paymentStatuses = new Set([
		'requires_action',
		'requires_payment_method',
		'requires_confirmation',
		'processing',
	])

	if (amountDue > 0 && (!paymentIntent || paymentStatuses.has(paymentIntent.status))) {
		if (invoice.hosted_invoice_url) {
			return { redirectUrl: invoice.hosted_invoice_url, reason: 'payment_required' }
		}
	}

	return { redirectUrl: appendReturnParam(returnUrl, 'jpv_upgrade', 'success'), reason: 'upgraded' }
}

export async function POST(req: NextRequest) {
	const tokenSecret = (process.env.BILLING_PORTAL_HMAC_SECRET || '').trim()
	if (!tokenSecret) {
		console.error('BILLING_PORTAL_HMAC_SECRET missing')
		return NextResponse.json(
			{ ok: false, reason: 'server_misconfigured', error: 'Missing token secret.' } as UpgradeError,
			{ status: 500 }
		)
	}

	let payload: { token?: string; returnUrl?: string } | null = null
	try {
		payload = (await req.json()) as typeof payload
	} catch {
		payload = null
	}

	const headerToken = extractBearerToken(req)
	const bodyToken = payload?.token && typeof payload.token === 'string'
		? payload.token.trim()
		: null
	const token = headerToken || bodyToken

	if (!token) {
		return NextResponse.json(
			{ ok: false, reason: 'unauthorized', error: 'Missing token.' } as UpgradeError,
			{ status: 401 }
		)
	}

	const verification = verifyBillingPortalToken(token, tokenSecret)
	if (!verification.ok) {
		const status = verification.reason === 'malformed' ? 400 : 401
		return NextResponse.json(
			{
				ok: false,
				reason: verification.reason,
				error: 'Invalid token.',
			} as UpgradeError,
			{ status }
		)
	}

	const email = normalizeEmail(verification.payload.email)
	const returnUrl = resolveReturnUrl(
		verification.payload.returnUrl ?? (payload?.returnUrl ?? null)
	)

	if (!email) {
		return NextResponse.json(
			{ ok: false, reason: 'missing_email', error: 'Email is required.' } as UpgradeError,
			{ status: 400 }
		)
	}

	const emailDomain = extractEmailDomain(email)
	const dryRun = isEnvEnabled(process.env.JPV_STRIPE_UPGRADE_DRY_RUN)
	const allowStripeSearch = isEnvEnabled(process.env.STRIPE_CUSTOMER_SEARCH_ENABLED)

	try {
		const stripeConfig = getStripeConfig()
		const stripe = getStripe()
		let { stripeCustomerId, stripeSubscriptionId } =
			await getStripeCustomerRecord(email)

		if (!stripeCustomerId && allowStripeSearch) {
			stripeCustomerId = await searchStripeCustomerIdByEmail(email)
		}

		if (!stripeCustomerId) {
			console.warn('VIP upgrade: customer not found', { emailDomain })
			return NextResponse.json(
				{ ok: false, reason: 'customer_not_found', error: 'Customer not found.' } as UpgradeError,
				{ status: allowStripeSearch ? 404 : 403 }
			)
		}

		let subscriptions: Stripe.Subscription[] = []

		if (stripeSubscriptionId) {
			const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
				expand: ['items.data.price', 'latest_invoice.payment_intent'],
			})
			const customerId =
				typeof subscription.customer === 'string'
					? subscription.customer
					: subscription.customer?.id
			if (customerId && customerId === stripeCustomerId) {
				subscriptions.push(subscription)
			}
		}

		if (subscriptions.length === 0) {
			const list = await stripe.subscriptions.list({
				customer: stripeCustomerId,
				status: 'all',
				limit: 10,
				expand: ['data.items.data.price', 'data.latest_invoice.payment_intent'],
			})
			subscriptions = list.data
		}

		const match = findSubscriptionMatch({
			subscriptions,
			pricePro: stripeConfig.stripe.pricePro,
			priceVip: stripeConfig.stripe.priceVip,
		})

		if (!match.match || !match.item || !match.plan) {
			console.warn('VIP upgrade: no active subscription found', { emailDomain })
			return NextResponse.json(
				{ ok: false, reason: 'no_active_subscription', error: 'No active subscription.' } as UpgradeError,
				{ status: 409 }
			)
		}

		if (match.plan === 'vip') {
			const redirectUrl = appendReturnParam(returnUrl, 'jpv_upgrade', 'already_vip')
			return NextResponse.json(
				{ ok: true, reason: 'already_vip', redirectUrl } as UpgradeResult,
				{ status: 200 }
			)
		}

		if (dryRun) {
			const redirectUrl = appendReturnParam(returnUrl, 'jpv_upgrade', 'dry_run')
			console.info('VIP upgrade dry run', { emailDomain })
			return NextResponse.json(
				{ ok: true, reason: 'dry_run', redirectUrl } as UpgradeResult,
				{ status: 200 }
			)
		}

		const updated = await stripe.subscriptions.update(
			match.match.id,
			{
				items: [
					{
						id: match.item.id,
						price: stripeConfig.stripe.priceVip,
					},
				],
				proration_behavior: 'create_prorations',
				billing_cycle_anchor: 'unchanged',
				expand: ['latest_invoice.payment_intent'],
			},
			{
				idempotencyKey: `upgrade-vip-${verification.payload.nonce}`,
			}
		)

		const latestInvoice =
			updated.latest_invoice && typeof updated.latest_invoice !== 'string'
				? updated.latest_invoice
				: null

		const resolved = resolvePaymentRedirect(latestInvoice, returnUrl)
		console.info('VIP upgrade processed', {
			emailDomain,
			reason: resolved.reason,
		})

		return NextResponse.json(
			{ ok: true, reason: resolved.reason, redirectUrl: resolved.redirectUrl } as UpgradeResult,
			{ status: 200 }
		)
	} catch (error) {
		console.error('VIP upgrade failed', {
			emailDomain,
			reason: (error as Error).message || 'unknown_error',
		})
		return NextResponse.json(
			{ ok: false, reason: 'upgrade_failed', error: 'Upgrade failed.' } as UpgradeError,
			{ status: 500 }
		)
	}
}
