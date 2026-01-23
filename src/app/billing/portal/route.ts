import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/libs/prisma'
import { getStripe } from '@/lib/stripe'
import { getStripeConfig } from '@/lib/stripe-config'
import { verifyBillingPortalToken } from '@/lib/billing-portal-token'
import { normalizeEmail as normalizeEmailAddress } from '@/lib/normalize-email'

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

function extractEmailDomain(email: string | null | undefined): string | null {
	if (!email) return null
	const atIndex = email.indexOf('@')
	if (atIndex <= 0 || atIndex === email.length - 1) return null
	return email.slice(atIndex + 1)
}

function logFailure(params: {
	reason: string
	status: number
	message: string
	email?: string | null
	returnUrl: string
	source: 'session' | 'token' | 'none'
}) {
	console.error('Billing portal error', {
		reason: params.reason,
		status: params.status,
		message: params.message,
		source: params.source,
		emailDomain: extractEmailDomain(params.email ?? null),
		returnUrl: params.returnUrl,
	})
}

function logSuccess(params: {
	source: 'session' | 'token'
	email: string
	returnUrl: string
}) {
	console.info('Billing portal redirect', {
		source: params.source,
		emailDomain: extractEmailDomain(params.email),
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
	const normalizedEmail = normalizeEmailAddress(email)
	if (!normalizedEmail) return null
	const record = await prisma.customerProvisioning.findUnique({
		where: { normalizedEmail },
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
	const returnParam = req.nextUrl.searchParams.get('return')
	const returnUrlFromQuery = resolveReturnUrl(returnParam)
	const emailParam = normalizeEmailAddress(req.nextUrl.searchParams.get('email'))
	const tokenParam = req.nextUrl.searchParams.get('token')
	// Stripe email search is opt-in to avoid open-ended lookups by default.
	const allowStripeSearch = isEnvEnabled(process.env.STRIPE_CUSTOMER_SEARCH_ENABLED)
	let email = emailParam
	let source: 'session' | 'token' | 'none' = email ? 'session' : 'none'
	let returnUrl = returnUrlFromQuery
	const tokenSecret = (process.env.BILLING_PORTAL_HMAC_SECRET || '').trim()

	try {
		if (!email && tokenParam) {
			if (!tokenSecret) {
				console.error('BILLING_PORTAL_HMAC_SECRET missing')
				const message = 'Billing portal token verification is not configured.'
				logFailure({
					reason: 'missing_secret',
					status: 500,
					message,
					email,
					returnUrl,
					source: 'token',
				})
				return plainError(500, message)
			}

			const verification = verifyBillingPortalToken(tokenParam, tokenSecret)
			if (verification.ok === false) {
				const reason = verification.reason
				const message =
					reason === 'malformed'
						? 'Malformed billing portal token.'
						: 'Billing portal token is invalid or expired.'
				const status = reason === 'malformed' ? 400 : 403
				logFailure({
					reason,
					status,
					message,
					email,
					returnUrl,
					source: 'token',
				})
				return plainError(status, message)
			}

			email = normalizeEmail(verification.payload.email)
			source = email ? 'token' : 'none'
			returnUrl = resolveReturnUrl(verification.payload.returnUrl ?? null)
		}

		if (!email) {
			const message = 'Email is required to access the billing portal.'
			logFailure({
				reason: 'missing_email',
				status: 403,
				message,
				email,
				returnUrl,
				source,
			})
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
			logFailure({
				reason: 'customer_not_found',
				status,
				message,
				email,
				returnUrl,
				source,
			})
			return plainError(status, message)
		}

		const stripeConfig = getStripeConfig()
		const portalConfigId = stripeConfig.portalConfigurationId
		const stripe = getStripe()
		const session = await stripe.billingPortal.sessions.create({
			customer: stripeCustomerId,
			return_url: returnUrl,
			configuration: portalConfigId,
		})

		console.info('portal_session_created', {
			stripeEnv: stripeConfig.env,
			configurationId: portalConfigId,
			customerId: stripeCustomerId,
			sourceRoute: '/billing/portal',
		})

		if (!session.url) {
			const message = 'Stripe portal session URL was not returned.'
			logFailure({
				reason: 'missing_portal_url',
				status: 500,
				message,
				email,
				returnUrl,
				source,
			})
			return plainError(500, message)
		}

		logSuccess({ source: source === 'token' ? 'token' : 'session', email, returnUrl })
		return NextResponse.redirect(session.url, { status: 302 })
	} catch (error) {
		const message = (error as Error).message || 'Billing portal request failed.'
		logFailure({
			reason: 'unexpected_error',
			status: 500,
			message,
			email,
			returnUrl,
			source,
		})
		return plainError(500, 'Billing portal request failed.')
	}
}
