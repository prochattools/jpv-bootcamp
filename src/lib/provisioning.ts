import 'server-only'
import type Stripe from 'stripe'
import prisma from '@/libs/prisma'
import { sendWelcomeEmail } from '@/lib/email'
import { resolvePlanFromStripe, type Plan } from '@/lib/plans'
import { getStripe } from '@/lib/stripe'
import { getWpUserExists, provisionWpUser } from '@/lib/wp'

const ACTIVE_STATUSES = new Set<Stripe.Subscription.Status>([
	'active',
	'trialing',
])

function isEnvEnabled(value?: string): boolean {
	if (!value) return false
	return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

function isForceProvisionEnabled(): boolean {
	return isEnvEnabled(process.env.WP_PROVISION_FORCE)
}

type ProvisioningRecord = {
	id: string
	wpUserId: number | null
	currentPlan: string | null
	plan: string | null
}

type ProvisioningDecision = 'skip' | 'provision' | 'update_plan'

type WpExistsStatus = boolean | 'unknown'

export function logProvisioningDecision(params: {
	eventId?: string | null
	type?: string | null
	customerId?: string | null
	subscriptionId?: string | null
	email?: string | null
	incomingPlan?: string | null
	dbWpUserId?: number | null
	wpExists?: WpExistsStatus
	decision: ProvisioningDecision
	reason: string
	forceProvision?: boolean
}) {
	const payload: Record<string, unknown> = {
		eventId: params.eventId ?? null,
		type: params.type ?? null,
		customerId: params.customerId ?? null,
		subscriptionId: params.subscriptionId ?? null,
		email: params.email ?? null,
		incomingPlan: params.incomingPlan ?? null,
		dbWpUserId: typeof params.dbWpUserId === 'number' ? params.dbWpUserId : null,
		wpExists: params.wpExists ?? 'unknown',
		decision: params.decision,
		reason: params.reason,
	}

	if (typeof params.forceProvision === 'boolean') {
		payload.forceProvision = params.forceProvision
	}

	console.info(JSON.stringify(payload))
}

function normalizeSkipReason(reason: string): string {
	return reason === 'wp_exists_plan_unchanged' ? 'wp_user_exists' : reason
}

function logProvisioningSkipDetails(params: {
	context: 'checkout' | 'subscription'
	eventId?: string | null
	customerId?: string | null
	subscriptionId?: string | null
	email?: string | null
	plan?: string | null
	wpUserId?: number | null
	reason: string
	forceProvision?: boolean
}) {
	const payload = {
		context: params.context,
		eventId: params.eventId ?? null,
		stripeCustomerId: params.customerId ?? null,
		stripeSubscriptionId: params.subscriptionId ?? null,
		email: params.email ?? null,
		plan: params.plan ?? null,
		wpUserId: typeof params.wpUserId === 'number' ? params.wpUserId : null,
		reason: normalizeSkipReason(params.reason),
	}

	if (typeof params.forceProvision === 'boolean') {
		payload.forceProvision = params.forceProvision
	}

	console.info('WP provisioning skipped', payload)
}

function normalizePlanName(value: string | null | undefined): string | null {
	if (!value) return null
	const normalized = value.trim().toLowerCase()
	return normalized.length > 0 ? normalized : null
}

function isProvisioningPlan(value: string | null | undefined): value is Plan {
	return value === 'pro' || value === 'vip'
}

function resolveStoredPlanName(record: ProvisioningRecord | null): string | null {
	if (!record) return null
	return normalizePlanName(record.currentPlan ?? record.plan ?? null)
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

async function getCheckoutSessionLineItemInfo(
	sessionId: string
): Promise<{ priceId: string | null; productId: string | null }> {
	const stripe = getStripe()
	const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, { limit: 10 })
	const price = lineItems.data[0]?.price ?? null
	const productId =
		typeof price?.product === 'string'
			? price.product
			: price?.product?.id ?? null
	return {
		priceId: price?.id ?? null,
		productId,
	}
}

function getPlanFromSubscription(subscription: Stripe.Subscription): {
	plan: Plan | null
	priceId: string | null
} {
	const metadataPlan =
		typeof subscription.metadata?.plan === 'string'
			? subscription.metadata.plan
			: null
	const price = subscription.items?.data?.[0]?.price ?? null
	const priceId = price?.id ?? null
	const productId =
		typeof price?.product === 'string'
			? price.product
			: price?.product?.id ?? null
	return {
		plan: resolvePlanFromStripe({ metadataPlan, priceId, productId }),
		priceId,
	}
}

async function resolvePlanFromCheckoutSession(
	session: Stripe.Checkout.Session
): Promise<{ plan: Plan | null; priceId: string | null }> {
	const stripe = getStripe()
	const rawMetadataPlan =
		typeof session.metadata?.plan === 'string' ? session.metadata.plan : null
	const metadataPlan = resolvePlanFromStripe({ metadataPlan: rawMetadataPlan })
	const lineItemInfo = await getCheckoutSessionLineItemInfo(session.id)

	if (metadataPlan) {
		return { plan: metadataPlan, priceId: lineItemInfo.priceId }
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
			plan:
				fromSubscription.plan ??
				resolvePlanFromStripe({
					priceId: lineItemInfo.priceId,
					productId: lineItemInfo.productId,
				}),
			priceId: lineItemInfo.priceId ?? fromSubscription.priceId,
		}
	}

	return {
		plan: resolvePlanFromStripe({
			metadataPlan: rawMetadataPlan,
			priceId: lineItemInfo.priceId,
			productId: lineItemInfo.productId,
		}),
		priceId: lineItemInfo.priceId,
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

async function markProvisioningNeedsReprovision(
	recordId: string,
	lastEventId?: string | null
): Promise<void> {
	await prisma.customerProvisioning.update({
		where: { id: recordId },
		data: {
			wpUserId: null,
			status: 'needs_reprovision',
			lastEventId: lastEventId ?? null,
		},
	})
}

export async function provisionFromCheckoutSession(
	session: Stripe.Checkout.Session,
	eventId?: string | null,
	eventType?: string | null
): Promise<void> {
	let email: string | null = null
	let customerId: string | null = null
	let subscriptionId: string | null = null
	let incomingPlan: string | null = null
	let dbWpUserId: number | null = null
	let wpExists: WpExistsStatus = 'unknown'
	const forceProvision = isForceProvisionEnabled()

	const logDecision = (decision: ProvisioningDecision, reason: string) => {
		logProvisioningDecision({
			eventId: eventId ?? null,
			type: eventType ?? null,
			customerId,
			subscriptionId,
			email,
			incomingPlan,
			dbWpUserId,
			wpExists,
			decision,
			reason,
			forceProvision,
		})
	}

	if (session.mode !== 'subscription') {
		logDecision('skip', 'non_subscription')
		return
	}

	if (session.payment_status && !['paid', 'no_payment_required'].includes(session.payment_status)) {
		logDecision('skip', 'payment_not_complete')
		return
	}

	email = session.customer_email ?? session.customer_details?.email ?? null
	customerId =
		typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null
	subscriptionId =
		typeof session.subscription === 'string'
			? session.subscription
			: session.subscription?.id ?? null

	const existing = await findProvisioningRecord({
		email,
		stripeCustomerId: customerId,
		stripeSubscriptionId: subscriptionId || null,
	})
	const storedWpUserId =
		typeof existing?.wpUserId === 'number' && existing.wpUserId > 0
			? existing.wpUserId
			: null
	if (storedWpUserId) {
		dbWpUserId = storedWpUserId
	}

	if (!email) {
		logDecision('skip', 'missing_email')
		return
	}

	if (!customerId) {
		logDecision('skip', 'missing_customer_id')
		return
	}

	const { plan } = await resolvePlanFromCheckoutSession(session)
	const storedPlanName = resolveStoredPlanName(existing)

	if (!plan) {
		console.error('WP provisioning skipped: invalid plan', {
			sessionId: session.id,
			email,
			customerId,
			subscriptionId,
			plan: plan ?? null,
		})
		logDecision('skip', 'invalid_plan')
		return
	}

	incomingPlan = plan

	const planChanged = storedPlanName !== incomingPlan
	let decision: ProvisioningDecision = 'provision'
	let reason = existing ? 'missing_wp_user_id' : 'no_provisioning_record'
	let shouldSendWelcomeEmail = true

	if (storedWpUserId) {
		let lookupFailed = false
		try {
			const lookup = await getWpUserExists({
				wpUserId: storedWpUserId,
				email,
			})
			if (lookup) {
				wpExists = lookup.exists
			} else {
				lookupFailed = true
			}
		} catch {
			lookupFailed = true
		}

		if (wpExists === false) {
			await markProvisioningNeedsReprovision(existing.id, eventId ?? null)
			decision = 'provision'
			reason = 'wp_missing_reprovision'
			shouldSendWelcomeEmail = true
		} else if (wpExists === true) {
			if (planChanged) {
				decision = 'update_plan'
				reason = 'plan_changed'
				shouldSendWelcomeEmail = false
			} else {
				decision = 'skip'
				reason = 'wp_exists_plan_unchanged'
			}
		} else if (lookupFailed) {
			decision = 'provision'
			reason = 'wp_lookup_failed'
			shouldSendWelcomeEmail = false
		}
	}

	if (decision === 'skip' && forceProvision && storedWpUserId) {
		console.info('WP provisioning force enabled; bypassing skip.', {
			sessionId: session.id,
			customerId,
			subscriptionId,
			wpUserId: storedWpUserId,
			reason: normalizeSkipReason(reason),
		})
		decision = 'provision'
		reason = 'force_reprovision'
		shouldSendWelcomeEmail = false
	}

	if (decision === 'skip') {
		logProvisioningSkipDetails({
			context: 'checkout',
			eventId: eventId ?? null,
			customerId,
			subscriptionId,
			email,
			plan: incomingPlan,
			wpUserId: storedWpUserId,
			reason,
			forceProvision,
		})
		await upsertProvisioningRecord({
			email,
			stripeCustomerId: customerId,
			stripeSubscriptionId: subscriptionId || null,
			wpUserId: storedWpUserId,
			plan: incomingPlan,
			status: 'active',
			lastEventId: eventId ?? null,
		})
		logDecision('skip', reason)
		return
	}

	console.debug('Provisioning checkout session', {
		sessionId: session.id,
		plan: incomingPlan,
		customerId,
		subscriptionId,
		emailDomain: getEmailDomain(email),
	})

	const { firstName, lastName } = splitName(session.customer_details?.name)
	const displayName = [firstName, lastName].filter(Boolean).join(' ').trim()

	console.info('WP provisioning request', {
		email,
		customerId,
		subscriptionId,
		plan,
	})

	const wpProvision = await provisionWpUser({
		email,
		plan,
		name: displayName || session.customer_details?.name || null,
		stripeCustomerId: customerId,
	})
	if (!wpProvision) {
		logDecision('skip', 'wp_provision_disabled')
		return
	}

	await upsertProvisioningRecord({
		email,
		stripeCustomerId: customerId,
		stripeSubscriptionId: subscriptionId || null,
		wpUserId: wpProvision.wpUserId,
		plan: incomingPlan,
		status: 'active',
		lastEventId: eventId ?? null,
	})

	if (shouldSendWelcomeEmail) {
		await sendWelcomeEmail({
			to: email,
			plan,
			resetUrl: wpProvision.resetLink,
		})
	}

	logDecision(decision, reason)
}

export async function syncFromSubscription(
	subscriptionId: string,
	eventId?: string | null,
	eventType?: string | null
): Promise<void> {
	let email: string | null = null
	let customerId: string | null = null
	let incomingPlan: string | null = null
	let dbWpUserId: number | null = null
	let wpExists: WpExistsStatus = 'unknown'
	const forceProvision = isForceProvisionEnabled()

	const logDecision = (decision: ProvisioningDecision, reason: string) => {
		logProvisioningDecision({
			eventId: eventId ?? null,
			type: eventType ?? null,
			customerId,
			subscriptionId,
			email,
			incomingPlan,
			dbWpUserId,
			wpExists,
			decision,
			reason,
			forceProvision,
		})
	}

	const stripe = getStripe()
	const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
		expand: ['items.data.price'],
	})

	email = await getCustomerEmail(subscription.customer)
	customerId =
		typeof subscription.customer === 'string'
			? subscription.customer
			: subscription.customer?.id ?? null

	const existing = await findProvisioningRecord({
		email,
		stripeCustomerId: customerId,
		stripeSubscriptionId: subscription.id,
	})
	const storedWpUserId =
		typeof existing?.wpUserId === 'number' && existing.wpUserId > 0
			? existing.wpUserId
			: null
	if (storedWpUserId) {
		dbWpUserId = storedWpUserId
	}

	if (!email) {
		logDecision('skip', 'missing_email')
		return
	}

	if (!customerId) {
		logDecision('skip', 'missing_customer_id')
		return
	}

	const { plan } = getPlanFromSubscription(subscription)
	const storedPlanName = resolveStoredPlanName(existing)

	const isActive = ACTIVE_STATUSES.has(subscription.status)
	if (isActive && !plan) {
		console.error('WP provisioning skipped: invalid plan', {
			subscriptionId: subscription.id,
			email,
			customerId,
			plan: plan ?? null,
		})
		logDecision('skip', 'invalid_plan')
		return
	}
	const nextPlan = isActive ? plan ?? 'none' : 'none'
	incomingPlan = normalizePlanName(nextPlan)
	if (!incomingPlan) {
		console.error('WP provisioning skipped: invalid plan', {
			subscriptionId: subscription.id,
			email,
			customerId,
			plan: nextPlan ?? null,
		})
		logDecision('skip', 'invalid_plan')
		return
	}
	const nextStatus = isActive ? 'active' : 'inactive'

	console.debug('Syncing subscription', {
		subscriptionId: subscription.id,
		status: subscription.status,
		plan: incomingPlan ?? 'none',
		emailDomain: getEmailDomain(email),
	})

	const planChanged = incomingPlan !== storedPlanName
	let decision: ProvisioningDecision = 'provision'
	let reason = existing ? 'missing_wp_user_id' : 'no_provisioning_record'

	if (storedWpUserId) {
		let lookupFailed = false
		try {
			const lookup = await getWpUserExists({
				wpUserId: storedWpUserId,
				email,
			})
			if (lookup) {
				wpExists = lookup.exists
			} else {
				lookupFailed = true
			}
		} catch {
			lookupFailed = true
		}

		if (wpExists === false) {
			await markProvisioningNeedsReprovision(existing.id, eventId ?? null)
			decision = 'provision'
			reason = 'wp_missing_reprovision'
		} else if (wpExists === true) {
			if (planChanged) {
				decision = 'update_plan'
				reason = 'plan_changed'
			} else {
				decision = 'skip'
				reason = 'wp_exists_plan_unchanged'
			}
		} else if (lookupFailed) {
			decision = 'provision'
			reason = 'wp_lookup_failed'
		}
	}

	if (decision === 'skip' && forceProvision && storedWpUserId) {
		console.info('WP provisioning force enabled; bypassing skip.', {
			subscriptionId: subscription.id,
			customerId,
			wpUserId: storedWpUserId,
			reason: normalizeSkipReason(reason),
		})
		decision = 'provision'
		reason = 'force_reprovision'
	}

	if (decision === 'skip') {
		logProvisioningSkipDetails({
			context: 'subscription',
			eventId: eventId ?? null,
			customerId,
			subscriptionId: subscription.id,
			email,
			plan: incomingPlan,
			wpUserId: storedWpUserId,
			reason,
			forceProvision,
		})
		await upsertProvisioningRecord({
			email,
			stripeCustomerId: customerId,
			stripeSubscriptionId: subscription.id,
			wpUserId: storedWpUserId,
			plan: incomingPlan ?? 'none',
			status: nextStatus,
			lastEventId: eventId ?? null,
		})
		logDecision('skip', reason)
		return
	}

	if (!isProvisioningPlan(incomingPlan)) {
		console.error('WP provisioning skipped: invalid plan', {
			subscriptionId: subscription.id,
			email,
			customerId,
			plan: incomingPlan ?? null,
			status: subscription.status,
		})
		await upsertProvisioningRecord({
			email,
			stripeCustomerId: customerId,
			stripeSubscriptionId: subscription.id,
			wpUserId: storedWpUserId,
			plan: incomingPlan ?? 'none',
			status: nextStatus,
			lastEventId: eventId ?? null,
		})
		logDecision('skip', 'invalid_plan')
		return
	}

	console.info('WP provisioning request', {
		email,
		customerId,
		subscriptionId: subscription.id,
		plan: incomingPlan,
	})

	const wpProvision = await provisionWpUser({
		email,
		plan: incomingPlan,
		name: null,
		stripeCustomerId: customerId || null,
	})
	if (!wpProvision) {
		logDecision('skip', 'wp_provision_disabled')
		return
	}

	await upsertProvisioningRecord({
		email,
		stripeCustomerId: customerId,
		stripeSubscriptionId: subscription.id,
		wpUserId: wpProvision.wpUserId,
		plan: incomingPlan,
		status: nextStatus,
		lastEventId: eventId ?? null,
	})

	logDecision(decision, reason)
}
