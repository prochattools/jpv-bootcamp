import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/libs/prisma'
import { getStripe } from '@/lib/stripe'
import { syncFromSubscription } from '@/lib/provisioning'
import { verifyBillingPortalToken } from '@/lib/billing-portal-token'
import type Stripe from 'stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_STATUSES = new Set<Stripe.Subscription.Status>([
	'active',
	'trialing',
	'past_due',
])

type SyncResponse = {
	ok: boolean
	reason: string
	decision?: string
	email?: string | null
	stripeCustomerId?: string | null
	stripeSubscriptionId?: string | null
	plan?: string | null
	wpUserId?: number | null
	actions?: unknown | null
	dryRun?: boolean
}

function isEnvEnabled(value?: string): boolean {
	if (!value) return false
	return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

function normalizeEmail(value: string | null | undefined): string | null {
	if (!value) return null
	const trimmed = value.trim().toLowerCase()
	return trimmed.length > 0 ? trimmed : null
}

function extractBearerToken(req: NextRequest): string | null {
	const auth = req.headers.get('authorization') ?? ''
	const match = auth.match(/Bearer\s+(.*)$/i)
	if (match) return match[1].trim()
	return null
}

function safeEqual(a: string, b: string): boolean {
	if (!a || !b || a.length !== b.length) return false
	return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

function getAdminToken(): string | null {
	const fromEnv = process.env.APP_WP_SYNC_TOKEN || process.env.WP_PROVISION_TOKEN
	const trimmed = fromEnv ? fromEnv.trim() : ''
	return trimmed || null
}

function readParam(
	req: NextRequest,
	body: Record<string, unknown> | null,
	keys: string[]
): string | null {
	for (const key of keys) {
		const queryValue = req.nextUrl.searchParams.get(key)
		if (queryValue) return queryValue
		const bodyValue = body?.[key]
		if (typeof bodyValue === 'string' && bodyValue.trim()) {
			return bodyValue.trim()
		}
	}
	return null
}

async function resolveSubscriptionFromCustomer(
	stripeCustomerId: string
): Promise<Stripe.Subscription | null> {
	const stripe = getStripe()
	const list = await stripe.subscriptions.list({
		customer: stripeCustomerId,
		status: 'all',
		limit: 10,
		expand: ['data.items.data.price'],
	})
	const active = list.data.find((sub) => ALLOWED_STATUSES.has(sub.status))
	return active ?? list.data[0] ?? null
}

async function handleSyncMembership(req: NextRequest): Promise<NextResponse> {
	let body: Record<string, unknown> | null = null
	if (req.method !== 'GET') {
		try {
			body = (await req.json()) as Record<string, unknown>
		} catch {
			body = null
		}
	}

	const adminToken = req.headers.get('x-jpv-admin-token')?.trim() ?? ''
	const adminSecret = getAdminToken()
	const adminAuthorized = adminToken && adminSecret ? safeEqual(adminToken, adminSecret) : false

	let tokenEmail: string | null = null
	let authorizedByToken = false

	if (!adminAuthorized) {
		const tokenSecret = (process.env.BILLING_PORTAL_HMAC_SECRET || '').trim()
		const headerToken = extractBearerToken(req)
		const queryToken = req.nextUrl.searchParams.get('token')
		const token = headerToken || (queryToken ? queryToken.trim() : null)

		if (!tokenSecret) {
			return NextResponse.json(
				{ ok: false, reason: 'server_misconfigured' } satisfies SyncResponse,
				{ status: 500 }
			)
		}

		if (!token) {
			return NextResponse.json(
				{ ok: false, reason: 'unauthorized' } satisfies SyncResponse,
				{ status: 401 }
			)
		}

		const verification = verifyBillingPortalToken(token, tokenSecret)
		if (verification.ok === false) {
			return NextResponse.json(
				{ ok: false, reason: 'unauthorized' } satisfies SyncResponse,
				{ status: 401 }
			)
		}

		tokenEmail = normalizeEmail(verification.payload.email)
		if (!tokenEmail) {
			return NextResponse.json(
				{ ok: false, reason: 'unauthorized' } satisfies SyncResponse,
				{ status: 401 }
			)
		}
		authorizedByToken = true
	}

	const rawEmail = readParam(req, body, ['email'])
	const rawCustomerId = readParam(req, body, [
		'stripe_customer_id',
		'stripeCustomerId',
		'customerId',
	])
	const rawSubscriptionId = readParam(req, body, [
		'stripe_subscription_id',
		'stripeSubscriptionId',
		'subscriptionId',
	])

	const email = authorizedByToken ? tokenEmail : normalizeEmail(rawEmail)
	let stripeCustomerId = rawCustomerId ?? null
	let stripeSubscriptionId = rawSubscriptionId ?? null

	if (!email && !stripeCustomerId && !stripeSubscriptionId) {
		return NextResponse.json(
			{ ok: false, reason: 'missing_identifier' } satisfies SyncResponse,
			{ status: 400 }
		)
	}

	if (email) {
		const record = await prisma.customerProvisioning.findFirst({
			where: { email: { equals: email, mode: 'insensitive' } },
			select: { stripeCustomerId: true, stripeSubscriptionId: true },
		})
		if (!stripeCustomerId) {
			stripeCustomerId = record?.stripeCustomerId ?? null
		}
		if (!stripeSubscriptionId) {
			stripeSubscriptionId = record?.stripeSubscriptionId ?? null
		}
	}

	if (!stripeSubscriptionId && stripeCustomerId) {
		const subscription = await resolveSubscriptionFromCustomer(stripeCustomerId)
		stripeSubscriptionId = subscription?.id ?? null
	}

	if (!stripeSubscriptionId && email) {
		const allowStripeSearch = isEnvEnabled(process.env.STRIPE_CUSTOMER_SEARCH_ENABLED)
		if (allowStripeSearch) {
			const stripe = getStripe()
			const result = await stripe.customers.search({
				query: `email:"${email}"`,
				limit: 10,
			})
			const foundCustomerId = result.data[0]?.id ?? null
			if (foundCustomerId) {
				stripeCustomerId = stripeCustomerId ?? foundCustomerId
				const subscription = await resolveSubscriptionFromCustomer(foundCustomerId)
				stripeSubscriptionId = subscription?.id ?? null
			}
		}
	}

	if (!stripeSubscriptionId) {
		return NextResponse.json(
			{ ok: false, reason: 'subscription_not_found' } satisfies SyncResponse,
			{ status: 404 }
		)
	}

	const summary = await syncFromSubscription(
		stripeSubscriptionId,
		null,
		'manual_sync'
	)

	return NextResponse.json(
		{
			ok: summary.ok,
			reason: summary.reason,
			decision: summary.decision,
			email: summary.resolvedEmail ?? summary.email,
			stripeCustomerId: stripeCustomerId ?? summary.stripeCustomerId ?? null,
			stripeSubscriptionId: summary.stripeSubscriptionId,
			plan: summary.plan,
			wpUserId: summary.wpUserId,
			actions: summary.actions,
			dryRun: summary.dryRun,
		} satisfies SyncResponse,
		{ status: 200 }
	)
}

export async function GET(req: NextRequest) {
	return handleSyncMembership(req)
}

export async function POST(req: NextRequest) {
	return handleSyncMembership(req)
}
