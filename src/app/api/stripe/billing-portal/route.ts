import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/libs/prisma'
import { getStripe } from '@/lib/stripe'
import { verifyBillingPortalToken } from '@/lib/billing-portal-token'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BILLING_PORTAL_RETURN_URL =
	'https://portal.jpvbootcamp.com/community/?jpv_billing=return'

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

function buildReturnUrl(status: 'return' | 'error'): string {
	try {
		const url = new URL(BILLING_PORTAL_RETURN_URL)
		url.searchParams.set('jpv_billing', status)
		return url.toString()
	} catch {
		return BILLING_PORTAL_RETURN_URL
	}
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

type CustomerResolutionSource = 'provisioning_record' | 'customers_list' | 'none'

function isStripeCustomerMissing(error: unknown): boolean {
	if (!error || typeof error !== 'object') return false
	const stripeError = error as { code?: string; message?: string }
	if (stripeError.code === 'resource_missing') return true
	return Boolean(stripeError.message?.includes('No such customer'))
}

async function updateProvisioningCustomerId(
	email: string,
	stripeCustomerId: string
): Promise<void> {
	await prisma.customerProvisioning.updateMany({
		where: { email: { equals: email, mode: 'insensitive' } },
		data: { stripeCustomerId },
	})
}

async function resolveStripeCustomerId(
	email: string
): Promise<{ customerId: string | null; source: CustomerResolutionSource }> {
	const stripe = getStripe()
	const record = await getStripeCustomerRecord(email)
	const storedCustomerId = record.stripeCustomerId

	if (storedCustomerId) {
		try {
			const customer = await stripe.customers.retrieve(storedCustomerId)
			if (!('deleted' in customer)) {
				return { customerId: storedCustomerId, source: 'provisioning_record' }
			}
		} catch (error) {
			if (!isStripeCustomerMissing(error)) {
				throw error
			}
		}
	}

	const list = await stripe.customers.list({ email, limit: 10 })
	const sorted = [...list.data].sort((a, b) => (b.created ?? 0) - (a.created ?? 0))
	const fallback = sorted[0] ?? null
	if (!fallback) {
		return { customerId: null, source: 'none' }
	}

	if (fallback.id && fallback.id !== storedCustomerId) {
		await updateProvisioningCustomerId(email, fallback.id)
	}

	return { customerId: fallback.id, source: 'customers_list' }
}

async function handleBillingPortal(req: NextRequest): Promise<NextResponse> {
	const tokenSecret = (process.env.BILLING_PORTAL_HMAC_SECRET || '').trim()
	if (!tokenSecret) {
		console.error('BILLING_PORTAL_HMAC_SECRET missing')
		return NextResponse.redirect(buildReturnUrl('error'), 302)
	}

	const headerToken = extractBearerToken(req)
	const queryToken = req.nextUrl.searchParams.get('token')
	const token = headerToken || (queryToken ? queryToken.trim() : null)

	if (!token) {
		return NextResponse.redirect(buildReturnUrl('error'), 302)
	}

	const verification = verifyBillingPortalToken(token, tokenSecret)
	if (verification.ok === false) {
		return NextResponse.redirect(buildReturnUrl('error'), 302)
	}

	const email = normalizeEmail(verification.payload.email)
	if (!email) {
		return NextResponse.redirect(buildReturnUrl('error'), 302)
	}

	const emailDomain = extractEmailDomain(email)
	let resolvedCustomerId: string | null = null
	let resolvedCustomerSource: CustomerResolutionSource = 'none'

	try {
		const stripe = getStripe()
		const resolution = await resolveStripeCustomerId(email)
		resolvedCustomerId = resolution.customerId
		resolvedCustomerSource = resolution.source

		if (!resolvedCustomerId) {
			console.error('Billing portal failed', {
				emailDomain,
				reason: 'customer_not_found',
				resolvedCustomerId,
				source: resolvedCustomerSource,
			})
			return NextResponse.redirect(buildReturnUrl('error'), 302)
		}

		const session = await stripe.billingPortal.sessions.create({
			customer: resolvedCustomerId,
			return_url: BILLING_PORTAL_RETURN_URL,
		})

		if (!session.url) {
			console.error('Billing portal failed', {
				emailDomain,
				reason: 'portal_unavailable',
				resolvedCustomerId,
				source: resolvedCustomerSource,
			})
			return NextResponse.redirect(buildReturnUrl('error'), 302)
		}

		return NextResponse.redirect(session.url, 302)
	} catch (error) {
		console.error('Billing portal failed', {
			emailDomain,
			reason: (error as Error).message || 'unknown_error',
			resolvedCustomerId,
			source: resolvedCustomerSource,
		})
		return NextResponse.redirect(buildReturnUrl('error'), 302)
	}
}

export async function GET(req: NextRequest) {
	return handleBillingPortal(req)
}

export async function POST(req: NextRequest) {
	return handleBillingPortal(req)
}
