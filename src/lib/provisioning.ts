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

function isDryRunWpSync(options?: { dryRun?: boolean }): boolean {
	if (typeof options?.dryRun === 'boolean') return options.dryRun
	return isEnvEnabled(process.env.DRY_RUN_WP_SYNC)
}

type ProvisioningRecord = {
	id: string
	wpUserId: number | null
	currentPlan: string | null
	plan: string | null
}

type ProvisioningDecision = 'skip' | 'provision' | 'update_plan'

type WpExistsStatus = boolean | 'unknown'
type NameSource = 'db' | 'stripe_customer' | 'session_customer_details' | 'none'
type EmailSource = 'session' | 'stripe_customer' | 'provisioning_record' | 'none'

type WpActions = {
	addTags: string[]
	removeTags: string[]
	setMembershipLevel: string | null
}

export type ProvisioningSummary = {
	ok: boolean
	decision: ProvisioningDecision
	reason: string
	email: string | null
	resolvedEmail: string | null
	resolvedEmailSource: EmailSource | null
	stripeCustomerId: string | null
	stripeSubscriptionId: string | null
	plan: string | null
	priceId: string | null
	wpUserId: number | null
	actions: WpActions | null
	dryRun: boolean
}

export function logProvisioningDecision(params: {
	eventId?: string | null
	type?: string | null
	customerId?: string | null
	subscriptionId?: string | null
	email?: string | null
	incomingPlan?: string | null
	resolvedEmail?: string | null
	resolvedEmailSource?: EmailSource | null
	resolvedPlan?: string | null
	resolvedPriceId?: string | null
	dbWpUserId?: number | null
	wpUserId?: number | null
	wpExists?: WpExistsStatus
	decision: ProvisioningDecision
	reason: string
	actions?: WpActions | null
	forceProvision?: boolean
	dryRun?: boolean
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

	if (params.resolvedEmail !== undefined) {
		payload.resolvedEmail = params.resolvedEmail
	}
	if (params.resolvedEmailSource !== undefined) {
		payload.resolvedEmailSource = params.resolvedEmailSource
	}
	if (params.resolvedPlan !== undefined) {
		payload.resolvedPlan = params.resolvedPlan
	}
	if (params.resolvedPriceId !== undefined) {
		payload.resolvedPriceId = params.resolvedPriceId
	}
	if (typeof params.wpUserId === 'number') {
		payload.wpUserId = params.wpUserId
	}
	if (params.actions) {
		payload.actions = params.actions
	}
	if (typeof params.forceProvision === 'boolean') {
		payload.forceProvision = params.forceProvision
	}
	if (params.dryRun) {
		payload.dryRun = true
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
	resolvedEmail?: string | null
	resolvedEmailSource?: EmailSource | null
	resolvedPlan?: string | null
	resolvedPriceId?: string | null
	wpUserId?: number | null
	reason: string
	actions?: WpActions | null
	forceProvision?: boolean
	dryRun?: boolean
}) {
	const payload: Record<string, unknown> = {
		context: params.context,
		eventId: params.eventId ?? null,
		stripeCustomerId: params.customerId ?? null,
		stripeSubscriptionId: params.subscriptionId ?? null,
		email: params.email ?? null,
		plan: params.plan ?? null,
		wpUserId: typeof params.wpUserId === 'number' ? params.wpUserId : null,
		reason: normalizeSkipReason(params.reason),
	}

	if (params.resolvedEmail !== undefined) {
		payload.resolvedEmail = params.resolvedEmail
	}
	if (params.resolvedEmailSource !== undefined) {
		payload.resolvedEmailSource = params.resolvedEmailSource
	}
	if (params.resolvedPlan !== undefined) {
		payload.resolvedPlan = params.resolvedPlan
	}
	if (params.resolvedPriceId !== undefined) {
		payload.resolvedPriceId = params.resolvedPriceId
	}
	if (params.actions) {
		payload.actions = params.actions
	}
	if (typeof params.forceProvision === 'boolean') {
		payload.forceProvision = params.forceProvision
	}
	if (params.dryRun) {
		payload.dryRun = true
	}

	console.info('WP provisioning skipped', payload)
}

function normalizePlanName(value: string | null | undefined): string | null {
	if (!value) return null
	const normalized = value.trim().toLowerCase()
	return normalized.length > 0 ? normalized : null
}

function buildWpActions(plan: string | null): WpActions | null {
	if (plan === 'vip') {
		return {
			addTags: ['VIP'],
			removeTags: ['Pro'],
			setMembershipLevel: 'vip',
		}
	}
	if (plan === 'pro') {
		return {
			addTags: ['Pro'],
			removeTags: ['VIP'],
			setMembershipLevel: 'pro',
		}
	}
	return null
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

let hasLoggedMissingEmailSubscriberTable = false

function isMissingEmailSubscriberTable(error: unknown): boolean {
	if (!error) return false
	if (typeof error === 'object' && error !== null) {
		const code = (error as { code?: string }).code
		if (code === 'P2021') return true
	}
	if (error instanceof Error) {
		const message = error.message || ''
		return message.includes('email_subscribers') || message.includes('EmailSubscriber')
	}
	return false
}

async function getLocalSubscriberName(email: string): Promise<string | null> {
	const normalized = email.trim().toLowerCase()
	if (!normalized) return null
	let record: { name: string | null } | null = null
	try {
		record = await prisma.emailSubscriber.findUnique({
			where: { email: normalized },
			select: { name: true },
		})
	} catch (error) {
		if (isMissingEmailSubscriberTable(error)) {
			if (!hasLoggedMissingEmailSubscriberTable) {
				console.warn('EmailSubscriber table missing; skipping subscriber name lookup.')
				hasLoggedMissingEmailSubscriberTable = true
			}
			return null
		}
		throw error
	}
	const name = record?.name?.trim()
	return name && name.length > 0 ? name : null
}

async function getStripeCustomerName(customerId: string | null): Promise<string | null> {
	if (!customerId) return null
	const stripe = getStripe()
	const customer = await stripe.customers.retrieve(customerId)
	if ('deleted' in customer) return null
	const name = customer.name?.trim()
	return name && name.length > 0 ? name : null
}

async function resolveProvisioningNames(params: {
	email: string
	customerId?: string | null
	sessionName?: string | null
	stripeCustomerName?: string | null
}): Promise<{ firstName: string; lastName: string; fullName: string; source: NameSource; hasName: boolean }> {
	const localName = await getLocalSubscriberName(params.email)
	if (localName) {
		return {
			firstName: '',
			lastName: '',
			fullName: localName,
			source: 'db',
			hasName: true,
		}
	}

	let stripeName = params.stripeCustomerName?.trim() ?? null
	if (!stripeName && params.customerId) {
		stripeName = await getStripeCustomerName(params.customerId)
	}
	if (stripeName) {
		return {
			firstName: '',
			lastName: '',
			fullName: stripeName,
			source: 'stripe_customer',
			hasName: true,
		}
	}

	const sessionName = params.sessionName?.trim()
	if (sessionName) {
		return {
			firstName: '',
			lastName: '',
			fullName: sessionName,
			source: 'session_customer_details',
			hasName: true,
		}
	}

	return {
		firstName: '',
		lastName: '',
		fullName: '',
		source: 'none',
		hasName: false,
	}
}

async function getCustomerProfile(
	customer: Stripe.Subscription['customer']
): Promise<{ email: string | null; name: string | null }> {
	const stripe = getStripe()
	if (!customer) return { email: null, name: null }
	if (typeof customer !== 'string') {
		if ('deleted' in customer) return { email: null, name: null }
		const email = customer.email ?? null
		const name = customer.name ?? null
		if (email) {
			return { email, name }
		}
		if (!customer.id) return { email: null, name }
		const fetched = await stripe.customers.retrieve(customer.id)
		if ('deleted' in fetched) return { email: null, name }
		return { email: fetched.email ?? null, name: fetched.name ?? name ?? null }
	}

	const fetched = await stripe.customers.retrieve(customer)
	if ('deleted' in fetched) return { email: null, name: null }
	return { email: fetched.email ?? null, name: fetched.name ?? null }
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
	const recurringItem =
		subscription.items?.data?.find((item) => item.price?.recurring) ??
		subscription.items?.data?.[0] ??
		null
	const price = recurringItem?.price ?? null
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
	eventType?: string | null,
	options?: { dryRun?: boolean }
): Promise<ProvisioningSummary> {
	let email: string | null = null
	let resolvedEmail: string | null = null
	let resolvedEmailSource: EmailSource | null = null
	let customerId: string | null = null
	let subscriptionId: string | null = null
	let incomingPlan: string | null = null
	let resolvedPlan: string | null = null
	let resolvedPriceId: string | null = null
	let actions: WpActions | null = null
	let dbWpUserId: number | null = null
	let wpExists: WpExistsStatus = 'unknown'
	let wpUserId: number | null = null
	const forceProvision = isForceProvisionEnabled()
	const dryRun = isDryRunWpSync(options)

	const logDecision = (decision: ProvisioningDecision, reason: string) => {
		logProvisioningDecision({
			eventId: eventId ?? null,
			type: eventType ?? null,
			customerId,
			subscriptionId,
			email,
			incomingPlan,
			resolvedEmail,
			resolvedEmailSource,
			resolvedPlan,
			resolvedPriceId,
			dbWpUserId,
			wpUserId,
			wpExists,
			decision,
			reason,
			actions,
			forceProvision,
			dryRun,
		})
	}

	const buildSummary = (decision: ProvisioningDecision, reason: string): ProvisioningSummary => ({
		ok: decision !== 'skip' || reason === 'wp_exists_plan_unchanged',
		decision,
		reason,
		email,
		resolvedEmail,
		resolvedEmailSource,
		stripeCustomerId: customerId,
		stripeSubscriptionId: subscriptionId,
		plan: incomingPlan,
		priceId: resolvedPriceId,
		wpUserId,
		actions,
		dryRun,
	})

	if (session.mode !== 'subscription') {
		logDecision('skip', 'non_subscription')
		return buildSummary('skip', 'non_subscription')
	}

	if (session.payment_status && !['paid', 'no_payment_required'].includes(session.payment_status)) {
		logDecision('skip', 'payment_not_complete')
		return buildSummary('skip', 'payment_not_complete')
	}

	email = session.customer_email ?? session.customer_details?.email ?? null
	resolvedEmailSource = email ? 'session' : null
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
	if (!email && customerId) {
		const stripe = getStripe()
		const customer = await stripe.customers.retrieve(customerId)
		if (!('deleted' in customer)) {
			email = customer.email ?? null
			if (email) {
				resolvedEmailSource = 'stripe_customer'
			}
		}
	}
	if (!email && existing?.email) {
		email = existing.email
		resolvedEmailSource = 'provisioning_record'
	}
	resolvedEmail = email
	const storedWpUserId =
		typeof existing?.wpUserId === 'number' && existing.wpUserId > 0
			? existing.wpUserId
			: null
	if (storedWpUserId) {
		dbWpUserId = storedWpUserId
		wpUserId = storedWpUserId
	}

	if (!email) {
		logDecision('skip', 'missing_email')
		return buildSummary('skip', 'missing_email')
	}

	if (!customerId) {
		logDecision('skip', 'missing_customer_id')
		return buildSummary('skip', 'missing_customer_id')
	}

	const { plan, priceId } = await resolvePlanFromCheckoutSession(session)
	resolvedPlan = plan
	resolvedPriceId = priceId
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
		return buildSummary('skip', 'invalid_plan')
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
			resolvedEmail,
			resolvedEmailSource,
			resolvedPlan,
			resolvedPriceId,
			wpUserId: storedWpUserId,
			reason,
			actions,
			forceProvision,
			dryRun,
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
		return buildSummary('skip', reason)
	}

	actions = buildWpActions(incomingPlan)

	if (dryRun) {
		wpUserId = storedWpUserId
		console.info('WP provisioning dry run', {
			sessionId: session.id,
			plan: incomingPlan,
			customerId,
			subscriptionId,
			emailDomain: getEmailDomain(email),
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
		logDecision(decision, reason)
		return buildSummary(decision, reason)
	}

	console.debug('Provisioning checkout session', {
		sessionId: session.id,
		plan: incomingPlan,
		customerId,
		subscriptionId,
		emailDomain: getEmailDomain(email),
	})

	const nameInfo = await resolveProvisioningNames({
		email,
		customerId,
		sessionName: session.customer_details?.name ?? null,
	})

	console.info('WP provisioning request', {
		email,
		customerId,
		subscriptionId,
		plan,
	})

	console.info('WP provisioning name fields', {
		hasName: nameInfo.hasName,
		source: nameInfo.source,
	})

	const wpProvision = await provisionWpUser({
		email,
		plan,
		name: nameInfo.fullName || null,
		firstName: nameInfo.firstName,
		lastName: nameInfo.lastName,
		fullName: nameInfo.fullName,
		stripeCustomerId: customerId,
		stripeSubscriptionId: subscriptionId || null,
	})
	if (!wpProvision) {
		logDecision('skip', 'wp_provision_disabled')
		return buildSummary('skip', 'wp_provision_disabled')
	}
	wpUserId = wpProvision.wpUserId

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
	return buildSummary(decision, reason)
}

export async function syncFromSubscription(
	subscriptionId: string,
	eventId?: string | null,
	eventType?: string | null,
	options?: { dryRun?: boolean }
): Promise<ProvisioningSummary> {
	let email: string | null = null
	let resolvedEmail: string | null = null
	let resolvedEmailSource: EmailSource | null = null
	let customerId: string | null = null
	let incomingPlan: string | null = null
	let resolvedPlan: string | null = null
	let resolvedPriceId: string | null = null
	let actions: WpActions | null = null
	let dbWpUserId: number | null = null
	let wpExists: WpExistsStatus = 'unknown'
	let wpUserId: number | null = null
	const forceProvision = isForceProvisionEnabled()
	const dryRun = isDryRunWpSync(options)

	const logDecision = (decision: ProvisioningDecision, reason: string) => {
		logProvisioningDecision({
			eventId: eventId ?? null,
			type: eventType ?? null,
			customerId,
			subscriptionId,
			email,
			incomingPlan,
			resolvedEmail,
			resolvedEmailSource,
			resolvedPlan,
			resolvedPriceId,
			dbWpUserId,
			wpUserId,
			wpExists,
			decision,
			reason,
			actions,
			forceProvision,
			dryRun,
		})
	}

	const buildSummary = (decision: ProvisioningDecision, reason: string): ProvisioningSummary => ({
		ok: decision !== 'skip' || reason === 'wp_exists_plan_unchanged',
		decision,
		reason,
		email,
		resolvedEmail,
		resolvedEmailSource,
		stripeCustomerId: customerId,
		stripeSubscriptionId: subscriptionId,
		plan: incomingPlan,
		priceId: resolvedPriceId,
		wpUserId,
		actions,
		dryRun,
	})

	const stripe = getStripe()
	const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
		expand: ['items.data.price', 'latest_invoice.payment_intent'],
	})

	const customerProfile = await getCustomerProfile(subscription.customer)
	email = customerProfile.email
	resolvedEmailSource = email ? 'stripe_customer' : null
	customerId =
		typeof subscription.customer === 'string'
			? subscription.customer
			: subscription.customer?.id ?? null
	const stripeCustomerName = customerProfile.name

	const existing = await findProvisioningRecord({
		email,
		stripeCustomerId: customerId,
		stripeSubscriptionId: subscription.id,
	})
	if (!email && existing?.email) {
		email = existing.email
		resolvedEmailSource = 'provisioning_record'
	}
	resolvedEmail = email
	const storedWpUserId =
		typeof existing?.wpUserId === 'number' && existing.wpUserId > 0
			? existing.wpUserId
			: null
	if (storedWpUserId) {
		dbWpUserId = storedWpUserId
		wpUserId = storedWpUserId
	}

	if (!email) {
		logDecision('skip', 'missing_email')
		return buildSummary('skip', 'missing_email')
	}

	if (!customerId) {
		logDecision('skip', 'missing_customer_id')
		return buildSummary('skip', 'missing_customer_id')
	}

	const latestInvoice =
		subscription.latest_invoice &&
		typeof subscription.latest_invoice !== 'string'
			? subscription.latest_invoice
			: null
	const paymentIntent =
		latestInvoice &&
		latestInvoice.payment_intent &&
		typeof latestInvoice.payment_intent !== 'string'
			? latestInvoice.payment_intent
			: null
	const paymentRequiresAction =
		paymentIntent &&
		new Set([
			'requires_action',
			'requires_payment_method',
			'requires_confirmation',
			'processing',
		]).has(paymentIntent.status)
	const paymentDue = (latestInvoice?.amount_due ?? 0) > 0
	const isUpgradePending =
		eventType === 'customer.subscription.updated' &&
		paymentDue &&
		paymentRequiresAction

	if (isUpgradePending) {
		logDecision('skip', 'awaiting_proration_payment')
		return buildSummary('skip', 'awaiting_proration_payment')
	}

	const { plan, priceId } = getPlanFromSubscription(subscription)
	resolvedPlan = plan
	resolvedPriceId = priceId
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
		return buildSummary('skip', 'invalid_plan')
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
		return buildSummary('skip', 'invalid_plan')
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
			resolvedEmail,
			resolvedEmailSource,
			resolvedPlan,
			resolvedPriceId,
			wpUserId: storedWpUserId,
			reason,
			actions,
			forceProvision,
			dryRun,
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
		return buildSummary('skip', reason)
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
		return buildSummary('skip', 'invalid_plan')
	}

	actions = buildWpActions(incomingPlan)

	if (dryRun) {
		wpUserId = storedWpUserId
		console.info('WP provisioning dry run', {
			subscriptionId: subscription.id,
			plan: incomingPlan,
			customerId,
			emailDomain: getEmailDomain(email),
		})
		await upsertProvisioningRecord({
			email,
			stripeCustomerId: customerId,
			stripeSubscriptionId: subscription.id,
			wpUserId: storedWpUserId,
			plan: incomingPlan,
			status: nextStatus,
			lastEventId: eventId ?? null,
		})
		logDecision(decision, reason)
		return buildSummary(decision, reason)
	}

	console.info('WP provisioning request', {
		email,
		customerId,
		subscriptionId: subscription.id,
		plan: incomingPlan,
	})

	const nameInfo = await resolveProvisioningNames({
		email,
		customerId,
		stripeCustomerName,
	})

	console.info('WP provisioning name fields', {
		hasName: nameInfo.hasName,
		source: nameInfo.source,
	})

	const wpProvision = await provisionWpUser({
		email,
		plan: incomingPlan,
		name: nameInfo.fullName || null,
		firstName: nameInfo.firstName,
		lastName: nameInfo.lastName,
		fullName: nameInfo.fullName,
		stripeCustomerId: customerId || null,
		stripeSubscriptionId: subscription.id,
	})
	if (!wpProvision) {
		logDecision('skip', 'wp_provision_disabled')
		return buildSummary('skip', 'wp_provision_disabled')
	}
	wpUserId = wpProvision.wpUserId

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
	return buildSummary(decision, reason)
}
