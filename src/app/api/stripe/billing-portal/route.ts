import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/libs/prisma'
import { getStripe } from '@/lib/stripe'
import { getStripeConfig } from '@/lib/stripe-config'
import { verifyBillingPortalToken } from '@/lib/billing-portal-token'
import { normalizeEmail as normalizeEmailAddress } from '@/lib/normalize-email'
import {
	BILLING_PORTAL_DEFAULT_RETURN_URL,
	describeBillingPortalReturnUrl,
} from '@/lib/billing-portal-return'
import { redactEmail } from '@/lib/log-redact'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function buildReturnUrl(baseUrl: string, status: 'return' | 'error'): string {
	try {
		const url = new URL(baseUrl)
		url.searchParams.set('jpv_billing', status)
		return url.toString()
	} catch {
		return BILLING_PORTAL_DEFAULT_RETURN_URL
	}
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
	const normalizedEmail = normalizeEmailAddress(email)
	if (!normalizedEmail) {
		return { stripeCustomerId: null, stripeSubscriptionId: null }
	}
	const record = await prisma.customerProvisioning.findUnique({
		where: { normalizedEmail },
		select: { stripeCustomerId: true, stripeSubscriptionId: true },
	})

	return {
		stripeCustomerId: record?.stripeCustomerId ?? null,
		stripeSubscriptionId: record?.stripeSubscriptionId ?? null,
	}
}

type CustomerResolutionSource =
	| 'provisioning_record'
	| 'customers_list'
	| 'created'
	| 'none'

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
	const normalizedEmail = normalizeEmailAddress(email)
	if (!normalizedEmail) return
	const record = await prisma.customerProvisioning.findUnique({
		where: { normalizedEmail },
		select: { id: true, stripeCustomerId: true, normalizedEmail: true },
	})
	const existingByCustomer = await prisma.customerProvisioning.findUnique({
		where: { stripeCustomerId },
		select: { id: true, normalizedEmail: true },
	})
	if (existingByCustomer && existingByCustomer.normalizedEmail !== normalizedEmail) {
		console.warn('customer_provisioning_conflict', {
			reason: 'stripe_customer_id_in_use',
			normalizedEmail: redactEmail(normalizedEmail),
			stripeCustomerId,
			existingNormalizedEmail: redactEmail(existingByCustomer.normalizedEmail),
			context: 'billing-portal',
		})
		return
	}
	if (!record) {
		await prisma.customerProvisioning.create({
			data: { email, normalizedEmail, stripeCustomerId },
		})
		return
	}
	if (record.stripeCustomerId && record.stripeCustomerId !== stripeCustomerId) {
		console.warn('customer_provisioning_conflict', {
			reason: 'stripe_customer_id_mismatch',
			normalizedEmail: redactEmail(normalizedEmail),
			stripeCustomerId,
			existingStripeCustomerId: record.stripeCustomerId,
			context: 'billing-portal',
		})
		return
	}
	if (record.stripeCustomerId === stripeCustomerId) {
		return
	}
	await prisma.customerProvisioning.update({
		where: { id: record.id },
		data: { stripeCustomerId },
	})
}

async function resolveStripeCustomerId(
	email: string
): Promise<{ customerId: string | null; source: CustomerResolutionSource }> {
	const stripe = getStripe()
	const record = await getStripeCustomerRecord(email)
	const storedCustomerId = record.stripeCustomerId
	let storedMissing = false

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
			storedMissing = true
		}
	}

	const list = await stripe.customers.list({ email, limit: 10 })
	const sorted = [...list.data].sort((a, b) => (b.created ?? 0) - (a.created ?? 0))
	const fallback = sorted[0] ?? null
	if (fallback?.id) {
		if (!storedCustomerId || storedMissing) {
			await updateProvisioningCustomerId(email, fallback.id)
		}
		return { customerId: fallback.id, source: 'customers_list' }
	}

	const created = await stripe.customers.create({ email })
	if (created?.id) {
		await updateProvisioningCustomerId(email, created.id)
		return { customerId: created.id, source: 'created' }
	}

	return { customerId: null, source: 'none' }
}

async function handleBillingPortal(req: NextRequest): Promise<NextResponse> {
	const tokenSecret = (process.env.BILLING_PORTAL_HMAC_SECRET || '').trim()
	if (!tokenSecret) {
		console.error('BILLING_PORTAL_HMAC_SECRET missing')
		return NextResponse.redirect(
			buildReturnUrl(BILLING_PORTAL_DEFAULT_RETURN_URL, 'error'),
			302
		)
	}

	const headerToken = extractBearerToken(req)
	const queryToken = req.nextUrl.searchParams.get('token')
	const token = headerToken || (queryToken ? queryToken.trim() : null)

	if (!token) {
		return NextResponse.redirect(
			buildReturnUrl(BILLING_PORTAL_DEFAULT_RETURN_URL, 'error'),
			302
		)
	}

	const verification = verifyBillingPortalToken(token, tokenSecret)
	if (verification.ok === false) {
		console.warn('billing_portal_token_invalid', {
			reason: verification.reason,
		})
		return NextResponse.redirect(
			buildReturnUrl(BILLING_PORTAL_DEFAULT_RETURN_URL, 'error'),
			302
		)
	}

	const email = normalizeEmailAddress(verification.payload.email)
	if (!email) {
		return NextResponse.redirect(
			buildReturnUrl(BILLING_PORTAL_DEFAULT_RETURN_URL, 'error'),
			302
		)
	}
	const returnInfo = describeBillingPortalReturnUrl(verification.payload.returnUrl)
	const returnUrl = returnInfo.url

	const emailDomain = extractEmailDomain(email)
	let resolvedCustomerId: string | null = null
	let resolvedCustomerSource: CustomerResolutionSource = 'none'
	let stripeConfig: ReturnType<typeof getStripeConfig> | null = null

	try {
		stripeConfig = getStripeConfig()
		const portalConfigId = stripeConfig.portalConfigurationId
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
			console.warn('portal_session_created', {
				stripeEnv: stripeConfig.env,
				configurationId: portalConfigId,
				customerId: resolvedCustomerId,
				sourceRoute: '/api/stripe/billing-portal',
				source: resolvedCustomerSource,
				return_host: returnInfo.host,
				return_path: returnInfo.path,
				ok: false,
				reason: 'customer_not_found',
			})
			return NextResponse.redirect(buildReturnUrl(returnUrl, 'error'), 302)
		}

		console.info('Billing portal session', {
			env: stripeConfig.env,
			configurationId: portalConfigId,
			resolvedCustomerId,
			source: resolvedCustomerSource,
			returnHost: returnInfo.host,
			returnPath: returnInfo.path,
		})

		const session = await stripe.billingPortal.sessions.create({
			customer: resolvedCustomerId,
			return_url: returnUrl,
			configuration: portalConfigId,
		})

		console.info('portal_session_created', {
			stripeEnv: stripeConfig.env,
			configurationId: portalConfigId,
			customerId: resolvedCustomerId,
			portal_session_id: session.id ?? null,
			sourceRoute: '/api/stripe/billing-portal',
			source: resolvedCustomerSource,
			return_host: returnInfo.host,
			return_path: returnInfo.path,
			ok: true,
		})

		if (!session.url) {
			console.error('Billing portal failed', {
				emailDomain,
				reason: 'portal_unavailable',
				resolvedCustomerId,
				source: resolvedCustomerSource,
			})
			console.warn('portal_session_created', {
				stripeEnv: stripeConfig.env,
				configurationId: portalConfigId,
				customerId: resolvedCustomerId,
				portal_session_id: session.id ?? null,
				sourceRoute: '/api/stripe/billing-portal',
				source: resolvedCustomerSource,
				return_host: returnInfo.host,
				return_path: returnInfo.path,
				ok: false,
				reason: 'portal_unavailable',
			})
			return NextResponse.redirect(buildReturnUrl(returnUrl, 'error'), 302)
		}

		return NextResponse.redirect(session.url, 302)
	} catch (error) {
		console.error('Billing portal failed', {
			emailDomain,
			reason: (error as Error).message || 'unknown_error',
			resolvedCustomerId,
			source: resolvedCustomerSource,
		})
		console.warn('portal_session_created', {
			stripeEnv: stripeConfig?.env ?? null,
			configurationId: stripeConfig?.portalConfigurationId ?? null,
			customerId: resolvedCustomerId,
			sourceRoute: '/api/stripe/billing-portal',
			source: resolvedCustomerSource,
			ok: false,
			reason: 'unexpected_error',
		})
		return NextResponse.redirect(
			buildReturnUrl(BILLING_PORTAL_DEFAULT_RETURN_URL, 'error'),
			302
		)
	}
}

export async function GET(req: NextRequest) {
	return handleBillingPortal(req)
}

export async function POST(req: NextRequest) {
	return handleBillingPortal(req)
}
