import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/libs/prisma'
import { getStripe } from '@/lib/stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEFAULT_RETURN_URL = 'https://portal.jpvbootcamp.com/community/'
const ALLOWED_RETURN_ORIGINS = new Set([
	'https://portal.jpvbootcamp.com',
	'https://jpvbootcamp.com',
])

function isEnvEnabled(value?: string): boolean {
	if (!value) return false
	return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

function resolveReturnUrl(raw: string | null): string {
	if (!raw) return DEFAULT_RETURN_URL
	try {
		const candidate = new URL(raw, DEFAULT_RETURN_URL)
		if (!ALLOWED_RETURN_ORIGINS.has(candidate.origin)) {
			return DEFAULT_RETURN_URL
		}
		return candidate.toString()
	} catch {
		return DEFAULT_RETURN_URL
	}
}

function normalizeEmail(value: string | null): string | null {
	if (!value) return null
	const trimmed = value.trim().toLowerCase()
	return trimmed.length > 0 ? trimmed : null
}

function logFailure(params: {
	reason: string
	status: number
	message: string
	email?: string | null
	returnUrl: string
}) {
	console.error('Billing portal error', {
		reason: params.reason,
		status: params.status,
		message: params.message,
		email: params.email ?? null,
		returnUrl: params.returnUrl,
	})
}

function plainError(status: number, message: string) {
	return new NextResponse(message, {
		status,
		headers: { 'content-type': 'text/plain; charset=utf-8' },
	})
}

async function getStripeCustomerIdByEmail(email: string): Promise<string | null> {
	const record = await prisma.customerProvisioning.findFirst({
		where: {
			email: { equals: email, mode: 'insensitive' },
		},
		select: { stripeCustomerId: true },
	})
	return record?.stripeCustomerId ?? null
}

async function searchStripeCustomerIdByEmail(email: string): Promise<string | null> {
	const stripe = getStripe()
	const result = await stripe.customers.search({
		query: `email:"${email}"`,
		limit: 1,
	})
	return result.data[0]?.id ?? null
}

export async function GET(req: NextRequest) {
	const returnUrl = resolveReturnUrl(req.nextUrl.searchParams.get('return'))
	const emailParam = normalizeEmail(req.nextUrl.searchParams.get('email'))
	// Stripe email search is opt-in to avoid open-ended lookups by default.
	const allowStripeSearch = isEnvEnabled(process.env.STRIPE_CUSTOMER_SEARCH_ENABLED)

	try {
		const email = emailParam
		if (!email) {
			const message = 'Email is required to access the billing portal.'
			logFailure({ reason: 'missing_email', status: 403, message, email, returnUrl })
			return plainError(403, message)
		}

		let stripeCustomerId = await getStripeCustomerIdByEmail(email)

		if (!stripeCustomerId && allowStripeSearch) {
			stripeCustomerId = await searchStripeCustomerIdByEmail(email)
		}

		if (!stripeCustomerId) {
			const status = allowStripeSearch ? 404 : 403
			const message = allowStripeSearch
				? 'Stripe customer not found for the supplied email.'
				: 'No provisioning record found for the supplied email.'
			logFailure({ reason: 'customer_not_found', status, message, email, returnUrl })
			return plainError(status, message)
		}

		const stripe = getStripe()
		const session = await stripe.billingPortal.sessions.create({
			customer: stripeCustomerId,
			return_url: returnUrl,
		})

		if (!session.url) {
			const message = 'Stripe portal session URL was not returned.'
			logFailure({ reason: 'missing_portal_url', status: 500, message, email, returnUrl })
			return plainError(500, message)
		}

		return NextResponse.redirect(session.url, { status: 302 })
	} catch (error) {
		const message = (error as Error).message || 'Billing portal request failed.'
		logFailure({ reason: 'unexpected_error', status: 500, message, email: emailParam, returnUrl })
		return plainError(500, 'Billing portal request failed.')
	}
}
