import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/libs/prisma'
import { getStripe } from '@/lib/stripe'
import { verifyBillingPortalToken } from '@/lib/billing-portal-token'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BILLING_PORTAL_RETURN_URL =
	'https://portal.jpvbootcamp.com/community/?jpv_upgrade=success'

type UpgradeError = {
	ok: false
	reason: string
	error: string
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

function extractEmailDomain(email: string | null): string | null {
	if (!email) return null
	const atIndex = email.indexOf('@')
	if (atIndex <= 0 || atIndex === email.length - 1) return null
	return email.slice(atIndex + 1)
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

async function handleUpgradeVip(req: NextRequest): Promise<NextResponse> {
	const tokenSecret = (process.env.BILLING_PORTAL_HMAC_SECRET || '').trim()
	if (!tokenSecret) {
		console.error('BILLING_PORTAL_HMAC_SECRET missing')
		return NextResponse.json(
			{ ok: false, reason: 'server_misconfigured', error: 'Missing token secret.' } as UpgradeError,
			{ status: 500 }
		)
	}

	const headerToken = extractBearerToken(req)
	const queryToken = req.nextUrl.searchParams.get('token')
	let token = headerToken || (queryToken ? queryToken.trim() : null)

	if (!token && req.method !== 'GET') {
		let payload: { token?: string } | null = null
		try {
			payload = (await req.json()) as typeof payload
		} catch {
			payload = null
		}

		const bodyToken = payload?.token && typeof payload.token === 'string'
			? payload.token.trim()
			: null
		if (bodyToken) {
			token = bodyToken
		}
	}

	if (!token) {
		return NextResponse.json(
			{ ok: false, reason: 'unauthorized', error: 'Missing token.' } as UpgradeError,
			{ status: 401 }
		)
	}

	const verification = verifyBillingPortalToken(token, tokenSecret)
	if (verification.ok === false) {
		const reason = verification.reason
		const status = reason === 'malformed' ? 400 : 401
		return NextResponse.json(
			{
				ok: false,
				reason,
				error: 'Invalid token.',
			} as UpgradeError,
			{ status }
		)
	}

	const email = normalizeEmail(verification.payload.email)
	if (!email) {
		return NextResponse.json(
			{ ok: false, reason: 'missing_email', error: 'Email is required.' } as UpgradeError,
			{ status: 400 }
		)
	}

	const emailDomain = extractEmailDomain(email)
	const allowStripeSearch = isEnvEnabled(process.env.STRIPE_CUSTOMER_SEARCH_ENABLED)

	try {
		const stripe = getStripe()
		let { stripeCustomerId } = await getStripeCustomerRecord(email)

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

		// Stripe Billing Portal is the source of truth for upgrades + proration.
		const session = await stripe.billingPortal.sessions.create({
			customer: stripeCustomerId,
			return_url: BILLING_PORTAL_RETURN_URL,
		})

		if (!session.url) {
			return NextResponse.json(
				{ ok: false, reason: 'portal_unavailable', error: 'Portal unavailable.' } as UpgradeError,
				{ status: 502 }
			)
		}

		return NextResponse.redirect(session.url, 302)
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

export async function GET(req: NextRequest) {
	return handleUpgradeVip(req)
}

export async function POST(req: NextRequest) {
	return handleUpgradeVip(req)
}
