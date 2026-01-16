import 'server-only'
import type Stripe from 'stripe'
import prisma from '@/libs/prisma'
import { sendWelcomeEmail } from '@/lib/email'
import { getPlanFromPriceId, type Plan } from '@/lib/plans'
import { getStripe } from '@/lib/stripe'
import { provisionWpUser } from '@/lib/wp'

const ACTIVE_STATUSES = new Set<Stripe.Subscription.Status>([
	'active',
	'trialing',
])

type ProvisioningRecord = {
	id: string
	wpUserId: number | null
	currentPlan: string | null
	plan: string | null
}

function normalizePlan(value: string | null | undefined): Plan | null {
	return value === 'pro' || value === 'vip' ? value : null
}

function resolveStoredPlan(record: ProvisioningRecord | null): Plan | null {
	if (!record) return null
	return normalizePlan(record.currentPlan ?? record.plan ?? null)
}

function getEmailDomain(email: string): string {
	const [, domain] = email.split('@')
	return domain ?? 'unknown'
}

function splitName(fullName?: string | null): { firstName?: string; lastName?: string } {
	if (!fullName) return {}
	const parts = fullName.trim().split(/\s+/)
	if (parts.length === 0) return {}
	if (parts.length === 1) return { firstName: parts[0] }
	return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

async function getCustomerEmail(
	customer: Stripe.Subscription['customer']
): Promise<string | null> {
	const stripe = getStripe()
	if (!customer) return null
	if (typeof customer !== 'string') {
		return 'deleted' in customer ? null : customer.email ?? null
	}

	const fetched = await stripe.customers.retrieve(customer)
	if ('deleted' in fetched) return null
	return fetched.email ?? null
}

async function getCheckoutSessionPriceId(sessionId: string): Promise<string | null> {
	const stripe = getStripe()
	const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, { limit: 10 })
	return lineItems.data[0]?.price?.id ?? null
}

function getPlanFromSubscription(subscription: Stripe.Subscription): {
	plan: Plan | null
	priceId: string | null
} {
	const metadataPlan = normalizePlan(subscription.metadata?.plan)
	const priceId = subscription.items?.data?.[0]?.price?.id ?? null
	return {
		plan: metadataPlan ?? getPlanFromPriceId(priceId),
		priceId,
	}
}

async function resolvePlanFromCheckoutSession(
	session: Stripe.Checkout.Session
): Promise<{ plan: Plan | null; priceId: string | null }> {
	const stripe = getStripe()
	const metadataPlan = normalizePlan(session.metadata?.plan)
	const lineItemPriceId = await getCheckoutSessionPriceId(session.id)

	if (metadataPlan) {
		return { plan: metadataPlan, priceId: lineItemPriceId }
	}

	if (session.subscription) {
		const subscriptionId =
			typeof session.subscription === 'string'
				? session.subscription
				: session.subscription.id
		const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
			expand: ['items.data.price'],
		})
		const fromSubscription = getPlanFromSubscription(subscription)
		return {
			plan: fromSubscription.plan,
			priceId: lineItemPriceId ?? fromSubscription.priceId,
		}
	}

	return {
		plan: getPlanFromPriceId(lineItemPriceId),
		priceId: lineItemPriceId,
	}
}

async function findProvisioningRecord(params: {
	email?: string | null
	stripeCustomerId?: string | null
	stripeSubscriptionId?: string | null
}): Promise<ProvisioningRecord | null> {
	const clauses = []
	if (params.stripeCustomerId) clauses.push({ stripeCustomerId: params.stripeCustomerId })
	if (params.stripeSubscriptionId) clauses.push({ stripeSubscriptionId: params.stripeSubscriptionId })
	if (params.email) clauses.push({ email: params.email })
	if (clauses.length === 0) return null

	return prisma.customerProvisioning.findFirst({
		where: { OR: clauses },
		select: {
			id: true,
			wpUserId: true,
			currentPlan: true,
			plan: true,
		},
	})
}

async function upsertProvisioningRecord({
	email,
	stripeCustomerId,
	stripeSubscriptionId,
	wpUserId,
	plan,
	status,
	lastEventId,
}: {
	email: string
	stripeCustomerId: string
	stripeSubscriptionId?: string | null
	wpUserId?: number | null
	plan: string
	status: string
	lastEventId?: string | null
}): Promise<void> {
	const existing = await prisma.customerProvisioning.findFirst({
		where: {
			OR: [{ stripeCustomerId }, { email }],
		},
	})

	const updateData: {
		email: string
		stripeCustomerId: string
		stripeSubscriptionId?: string | null
		wpUserId?: number | null
		plan?: string | null
		currentPlan?: string | null
		status: string
		lastEventId?: string | null
	} = {
		email,
		stripeCustomerId,
		stripeSubscriptionId: stripeSubscriptionId ?? null,
		plan: plan ?? null,
		currentPlan: plan ?? null,
		status,
		lastEventId: lastEventId ?? null,
	}

	if (typeof wpUserId === 'number') {
		updateData.wpUserId = wpUserId
	}

	if (existing) {
		await prisma.customerProvisioning.update({
			where: { id: existing.id },
			data: updateData,
		})
		return
	}

	await prisma.customerProvisioning.create({
		data: updateData,
	})
}

export async function provisionFromCheckoutSession(
	session: Stripe.Checkout.Session,
	eventId?: string | null
): Promise<void> {
	if (session.mode !== 'subscription') {
		console.info('Checkout session ignored (non-subscription)', {
			sessionId: session.id,
		})
		return
	}

	if (session.payment_status && !['paid', 'no_payment_required'].includes(session.payment_status)) {
		console.info('Checkout session not paid yet', {
			sessionId: session.id,
			paymentStatus: session.payment_status,
		})
		return
	}

	const email = session.customer_email ?? session.customer_details?.email
	if (!email) {
		console.warn('Checkout session missing email', { sessionId: session.id })
		return
	}

	const customerId =
		typeof session.customer === 'string' ? session.customer : session.customer?.id ?? ''
	const subscriptionId =
		typeof session.subscription === 'string'
			? session.subscription
			: session.subscription?.id ?? ''

	if (!customerId) {
		console.warn('Checkout session missing customer ID', { sessionId: session.id })
		return
	}

	const { plan: resolvedPlan } = await resolvePlanFromCheckoutSession(session)
	const existing = await findProvisioningRecord({
		email,
		stripeCustomerId: customerId,
		stripeSubscriptionId: subscriptionId || null,
	})
	const storedPlan = resolveStoredPlan(existing)
	const plan = resolvedPlan ?? storedPlan
	if (!plan) {
		console.warn('Checkout session missing plan', { sessionId: session.id })
		return
	}

	if (existing?.wpUserId) {
		console.debug('Provisioning already complete; skipping WP call.', {
			sessionId: session.id,
			customerId,
			emailDomain: getEmailDomain(email),
		})
		await upsertProvisioningRecord({
			email,
			stripeCustomerId: customerId,
			stripeSubscriptionId: subscriptionId || null,
			wpUserId: existing.wpUserId,
			plan,
			status: 'active',
			lastEventId: eventId ?? null,
		})
		return
	}

	console.debug('Provisioning checkout session', {
		sessionId: session.id,
		plan,
		customerId,
		subscriptionId,
		emailDomain: getEmailDomain(email),
	})

	const { firstName, lastName } = splitName(session.customer_details?.name)
	const displayName = [firstName, lastName].filter(Boolean).join(' ').trim()

	const wpProvision = await provisionWpUser({
		email,
		plan,
		name: displayName || session.customer_details?.name || null,
		stripeCustomerId: customerId,
	})
	if (!wpProvision) {
		return
	}

	await upsertProvisioningRecord({
		email,
		stripeCustomerId: customerId,
		stripeSubscriptionId: subscriptionId || null,
		wpUserId: wpProvision.wpUserId,
		plan,
		status: 'active',
		lastEventId: eventId ?? null,
	})

	await sendWelcomeEmail({
		to: email,
		plan,
		resetUrl: wpProvision.resetLink,
	})
}

export async function syncFromSubscription(
	subscriptionId: string,
	eventId?: string | null
): Promise<void> {
	const stripe = getStripe()
	const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
		expand: ['items.data.price'],
	})

	const email = await getCustomerEmail(subscription.customer)
	if (!email) {
		console.warn('Subscription missing customer email', {
			subscriptionId: subscription.id,
		})
		return
	}

	const { plan: resolvedPlan } = getPlanFromSubscription(subscription)
	const customerId =
		typeof subscription.customer === 'string'
			? subscription.customer
			: subscription.customer?.id ?? ''
	if (!customerId) {
		console.warn('Subscription missing customer ID', { subscriptionId: subscription.id })
		return
	}

	const existing = await findProvisioningRecord({
		email,
		stripeCustomerId: customerId,
		stripeSubscriptionId: subscription.id,
	})
	const storedPlan = resolveStoredPlan(existing)
	const plan = resolvedPlan ?? storedPlan

	const isActive = ACTIVE_STATUSES.has(subscription.status)
	if (isActive && !plan) {
		console.warn('Active subscription missing plan', { subscriptionId: subscription.id })
		return
	}
	const nextPlan = isActive ? plan ?? 'none' : 'none'
	const nextStatus = isActive ? 'active' : 'inactive'

	console.debug('Syncing subscription', {
		subscriptionId: subscription.id,
		status: subscription.status,
		plan: nextPlan,
		emailDomain: getEmailDomain(email),
	})

	if (!existing?.wpUserId) {
		const wpProvision = await provisionWpUser({
			email,
			plan: nextPlan,
			name: null,
			stripeCustomerId: customerId || null,
		})
		if (!wpProvision) {
			return
		}

		await upsertProvisioningRecord({
			email,
			stripeCustomerId: customerId,
			stripeSubscriptionId: subscription.id,
			wpUserId: wpProvision.wpUserId,
			plan: nextPlan,
			status: nextStatus,
			lastEventId: eventId ?? null,
		})
		return
	}

	await upsertProvisioningRecord({
		email,
		stripeCustomerId: customerId,
		stripeSubscriptionId: subscription.id,
		wpUserId: existing.wpUserId,
		plan: nextPlan,
		status: nextStatus,
		lastEventId: eventId ?? null,
	})
}
