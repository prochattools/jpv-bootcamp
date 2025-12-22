import 'server-only'
import type Stripe from 'stripe'
import { config } from '@/lib/config'
import { sendWelcomeEmail } from '@/lib/email'
import { getPlanFromPriceId, getWpRoleForPlan, type Plan } from '@/lib/plans'
import { getStripe } from '@/lib/stripe'
import { wpCreateUser, wpFindUserByEmail, wpSetUserRole, wpUpdateUserMeta } from '@/lib/wp'

function normalizePlan(value: string | null | undefined): Plan | null {
	return value === 'pro' || value === 'vip' ? value : null
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

async function getCheckoutSessionPriceId(
	sessionId: string
): Promise<string | null> {
	const stripe = getStripe()
	const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, { limit: 10 })
	return lineItems.data[0]?.price?.id ?? null
}

function getPlanFromSubscription(
	subscription: Stripe.Subscription
): { plan: Plan | null; priceId: string | null } {
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

async function upsertWpUserByEmail(
	email: string,
	name?: string | null
): Promise<{ id: number }> {
	const existing = await wpFindUserByEmail(email)
	if (existing) return existing
	const { firstName, lastName } = splitName(name)
	return wpCreateUser({
		email,
		firstName,
		lastName,
		role: config.wp.roleDefault,
	})
}

export async function provisionFromCheckoutSession(
	session: Stripe.Checkout.Session
): Promise<void> {
	if (session.mode !== 'subscription') {
		console.info('Checkout session ignored (non-subscription)', {
			sessionId: session.id,
		})
		return
	}

	const email = session.customer_email ?? session.customer_details?.email
	if (!email) {
		console.warn('Checkout session missing email', { sessionId: session.id })
		return
	}

	const { plan, priceId } = await resolvePlanFromCheckoutSession(session)
	if (!plan) {
		console.warn('Checkout session missing plan', { sessionId: session.id })
		return
	}

	const customerId =
		typeof session.customer === 'string' ? session.customer : session.customer?.id ?? ''
	const subscriptionId =
		typeof session.subscription === 'string'
			? session.subscription
			: session.subscription?.id ?? ''

	console.info('Provisioning checkout session', {
		sessionId: session.id,
		plan,
		customerId,
		subscriptionId,
		emailDomain: getEmailDomain(email),
	})

	const user = await upsertWpUserByEmail(email, session.customer_details?.name)
	await wpSetUserRole(user.id, getWpRoleForPlan(plan))
	await wpUpdateUserMeta(user.id, {
		stripe_customer_id: customerId,
		stripe_subscription_id: subscriptionId,
		jpv_plan: plan,
		stripe_price_id: priceId ?? '',
		stripe_checkout_session_id: session.id,
	})
	await sendWelcomeEmail({ to: email, plan })
}

export async function syncFromSubscription(subscriptionId: string): Promise<void> {
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

	const { plan, priceId } = getPlanFromSubscription(subscription)
	const customerId =
		typeof subscription.customer === 'string'
			? subscription.customer
			: subscription.customer?.id ?? ''

	if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
		console.info('Subscription delinquent, no role change', {
			subscriptionId: subscription.id,
			status: subscription.status,
			emailDomain: getEmailDomain(email),
		})
		return
	}

	const isActive = subscription.status === 'active' || subscription.status === 'trialing'
	const targetRole = isActive && plan ? getWpRoleForPlan(plan) : config.wp.roleDefault
	const planValue = isActive && plan ? plan : 'none'

	console.info('Syncing subscription', {
		subscriptionId: subscription.id,
		status: subscription.status,
		plan: planValue,
		emailDomain: getEmailDomain(email),
	})

	const user = await upsertWpUserByEmail(email, null)
	await wpSetUserRole(user.id, targetRole)
	await wpUpdateUserMeta(user.id, {
		stripe_customer_id: customerId,
		stripe_subscription_id: subscription.id,
		jpv_plan: planValue,
		stripe_price_id: priceId ?? '',
		stripe_checkout_session_id: '',
	})
}
