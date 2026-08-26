import 'server-only'
import type Stripe from 'stripe'
import prisma from '@/libs/prisma'
import { getServerConfig } from '@/lib/config'
import { sendWelcomeEmail } from '@/lib/email'
import { resolvePlanFromStripe, type Plan } from '@/lib/plans'
import { getStripe } from '@/lib/stripe'
import { paymentGraceEnd } from '@/lib/billing/commitmentPolicy'
import { isMonthlyCommitmentMetadata } from '@/lib/stripe-commitment'
import { normalizeEmail as normalizeEmailAddress } from '@/lib/normalize-email'
import { redactEmail } from '@/lib/log-redact'
import { provisionMemberFromCheckout } from '@/lib/members/provisionMemberFromCheckout'
import { buildMemberForgotPasswordUrl } from '@/lib/memberAuthUrls'

const ACTIVE_STATUSES = new Set<Stripe.Subscription.Status>([
	'active',
	'trialing',
])
const MEMBERSHIP_EMAIL_TEMPLATE_KEY = 'membership_access_ready'
const EMAIL_DEDUPE_WINDOW_MS = 2 * 60 * 1000

function isEnvEnabled(value?: string): boolean {
	if (!value) return false
	return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

type ProvisioningRecord = {
	id: string
	email: string | null
	normalizedEmail: string | null
	stripeCustomerId: string | null
	stripeSubscriptionId: string | null
	currentPlan: string | null
	plan: string | null
	billingCadence: string | null
	commitmentStatus: string | null
	commitmentStartAt: Date | null
	commitmentEndAt: Date | null
	paymentGraceEndsAt: Date | null
	lastPaidInvoiceId: string | null
	lastPaymentFailureAt: Date | null
	lastNotifiedPlan: string | null
	lastNotifiedAt: Date | null
	lastNotifiedEventId: string | null
}

type ProvisioningDecision = 'skip' | 'provision' | 'update_plan'

type NameSource = 'db' | 'stripe_customer' | 'session_customer_details' | 'none'
type EmailSource = 'session' | 'stripe_customer' | 'provisioning_record' | 'none'
type EmailSendSource = 'webhook' | 'manual_sync'

export type ProvisioningSummary = {
	ok: boolean
	decision: ProvisioningDecision
	reason: string
	oldPlan: string | null
	newPlan: string | null
	emailSent: boolean
	emailReason: string | null
	email: string | null
	resolvedEmail: string | null
	resolvedEmailSource: EmailSource | null
	stripeCustomerId: string | null
	stripeSubscriptionId: string | null
	plan: string | null
	priceId: string | null
}

export function logProvisioningDecision(params: {
	eventId?: string | null
	type?: string | null
	livemode?: boolean | null
	customerId?: string | null
	subscriptionId?: string | null
	email?: string | null
	incomingPlan?: string | null
	resolvedEmail?: string | null
	resolvedEmailSource?: EmailSource | null
	resolvedPlan?: string | null
	resolvedPriceId?: string | null
	oldPlan?: string | null
	newPlan?: string | null
	emailSent?: boolean
	emailReason?: string | null
	decision: ProvisioningDecision
	reason: string
}) {
	const payload: Record<string, unknown> = {
		eventId: params.eventId ?? null,
		type: params.type ?? null,
		livemode: typeof params.livemode === 'boolean' ? params.livemode : null,
		customerId: params.customerId ?? null,
		subscriptionId: params.subscriptionId ?? null,
		email: redactEmail(params.email ?? null),
		incomingPlan: params.incomingPlan ?? null,
		decision: params.decision,
		reason: params.reason,
	}

	if (params.resolvedEmail !== undefined) {
		payload.resolvedEmail = redactEmail(params.resolvedEmail)
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
	if (params.oldPlan !== undefined) {
		payload.oldPlan = params.oldPlan
	}
	if (params.newPlan !== undefined) {
		payload.newPlan = params.newPlan
	}
	if (typeof params.emailSent === 'boolean') {
		payload.emailSent = params.emailSent
	}
	if (params.emailReason !== undefined) {
		payload.emailReason = params.emailReason
	}

	console.info(JSON.stringify(payload))
}

function logProvisioningSkipDetails(params: {
	context: 'checkout' | 'subscription'
	eventId?: string | null
	livemode?: boolean | null
	customerId?: string | null
	subscriptionId?: string | null
	email?: string | null
	plan?: string | null
	resolvedEmail?: string | null
	resolvedEmailSource?: EmailSource | null
	resolvedPlan?: string | null
	resolvedPriceId?: string | null
	oldPlan?: string | null
	newPlan?: string | null
	emailSent?: boolean
	emailReason?: string | null
	reason: string
}) {
	const payload: Record<string, unknown> = {
		context: params.context,
		eventId: params.eventId ?? null,
		livemode: typeof params.livemode === 'boolean' ? params.livemode : null,
		stripeCustomerId: params.customerId ?? null,
		stripeSubscriptionId: params.subscriptionId ?? null,
		email: redactEmail(params.email ?? null),
		plan: params.plan ?? null,
		reason: params.reason,
	}

	if (params.resolvedEmail !== undefined) {
		payload.resolvedEmail = redactEmail(params.resolvedEmail)
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
	if (params.oldPlan !== undefined) {
		payload.oldPlan = params.oldPlan
	}
	if (params.newPlan !== undefined) {
		payload.newPlan = params.newPlan
	}
	if (typeof params.emailSent === 'boolean') {
		payload.emailSent = params.emailSent
	}
	if (params.emailReason !== undefined) {
		payload.emailReason = params.emailReason
	}

	console.info('membership_projection_skipped', payload)
}

function normalizePlanName(value: string | null | undefined): string | null {
	if (!value) return null
	const normalized = value.trim().toLowerCase()
	return normalized.length > 0 ? normalized : null
}

function dateFromIsoString(value: string | null | undefined): Date | null {
	if (!value) return null
	const date = new Date(value)
	return Number.isNaN(date.getTime()) ? null : date
}

function safeResolvePlanFromStripe(
	params: {
		metadataPlan?: string | null
		priceId?: string | null
		productId?: string | null
	},
	context: { source: 'checkout' | 'subscription'; id?: string | null }
): Plan | null {
	try {
		return resolvePlanFromStripe(params)
	} catch (error) {
		console.error('Stripe plan resolution failed', {
			source: context.source,
			id: context.id ?? null,
			metadataPlan: params.metadataPlan ?? null,
			priceId: params.priceId ?? null,
			productId: params.productId ?? null,
			message: (error as Error).message ?? 'unknown_error',
		})
		return null
	}
}

function isProvisioningPlan(value: string | null | undefined): value is Plan {
	return value === 'jpv_bootcamp_membership'
}

function evaluateEmailNotification(params: {
	allowEmail: boolean
	disabledReason?: string
	oldPlan: string | null
	newPlan: string | null
	lastNotifiedPlan: string | null
	lastNotifiedAt: Date | null
	lastNotifiedEventId: string | null
	sendKey?: string | null
	isNewCustomer?: boolean
}): { shouldSend: boolean; reason: string } {
	if (!params.allowEmail) {
		return { shouldSend: false, reason: params.disabledReason ?? 'disabled' }
	}
	if (!isProvisioningPlan(params.newPlan)) {
		return { shouldSend: false, reason: 'not_membership_plan' }
	}
	if (params.sendKey && params.lastNotifiedEventId === params.sendKey) {
		return { shouldSend: false, reason: 'send_key_already_notified' }
	}
	if (params.isNewCustomer) {
		return { shouldSend: true, reason: 'new_customer_for_email' }
	}
	if (params.lastNotifiedPlan === params.newPlan) {
		if (
			params.lastNotifiedAt &&
			Date.now() - params.lastNotifiedAt.getTime() < EMAIL_DEDUPE_WINDOW_MS
		) {
			return { shouldSend: false, reason: 'recent_duplicate' }
		}
		return { shouldSend: false, reason: 'already_notified_plan' }
	}
	if (params.oldPlan === params.newPlan) {
		return { shouldSend: false, reason: 'plan_unchanged' }
	}
	return { shouldSend: true, reason: 'plan_changed' }
}

function buildEmailSendKey(params: {
	eventId?: string | null
	subscriptionId?: string | null
	plan?: string | null
	effectiveAt?: number | null
}): string | null {
	if (params.eventId) {
		return params.eventId
	}
	if (params.subscriptionId && params.plan) {
		return `sub:${params.subscriptionId}:${params.plan}:${params.effectiveAt ?? 'na'}`
	}
	return null
}

function resolveStoredPlanName(record: ProvisioningRecord | null): string | null {
	if (!record) return null
	return normalizePlanName(record.currentPlan ?? record.plan ?? null)
}

function getEmailDomain(email: string): string {
	const [, domain] = email.split('@')
	return domain ?? 'unknown'
}

function resolveEmailSource(eventType?: string | null): EmailSendSource {
	return eventType === 'manual_sync' ? 'manual_sync' : 'webhook'
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
		plan: safeResolvePlanFromStripe(
			{ metadataPlan, priceId, productId },
			{ source: 'subscription', id: subscription.id }
		),
		priceId,
	}
}

async function resolvePlanFromCheckoutSession(
	session: Stripe.Checkout.Session
): Promise<{ plan: Plan | null; priceId: string | null }> {
	const stripe = getStripe()
	const rawMetadataPlan =
		typeof session.metadata?.plan === 'string' ? session.metadata.plan : null
	const metadataPlan = safeResolvePlanFromStripe(
		{ metadataPlan: rawMetadataPlan },
		{ source: 'checkout', id: session.id }
	)
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
				safeResolvePlanFromStripe(
					{
						priceId: lineItemInfo.priceId,
						productId: lineItemInfo.productId,
					},
					{ source: 'checkout', id: session.id }
				),
			priceId: lineItemInfo.priceId ?? fromSubscription.priceId,
		}
	}

	return {
		plan: safeResolvePlanFromStripe(
			{
				metadataPlan: rawMetadataPlan,
				priceId: lineItemInfo.priceId,
				productId: lineItemInfo.productId,
			},
			{ source: 'checkout', id: session.id }
		),
		priceId: lineItemInfo.priceId,
	}
}

async function findProvisioningRecord(params: {
	email?: string | null
	stripeCustomerId?: string | null
	stripeSubscriptionId?: string | null
}): Promise<ProvisioningRecord | null> {
	const normalizedEmail = normalizeEmailAddress(params.email)
	if (normalizedEmail) {
		const byEmail = await prisma.customerProvisioning.findUnique({
			where: { normalizedEmail },
			select: {
				id: true,
				email: true,
				normalizedEmail: true,
				stripeCustomerId: true,
				stripeSubscriptionId: true,
				currentPlan: true,
				plan: true,
				billingCadence: true,
				commitmentStatus: true,
				commitmentStartAt: true,
				commitmentEndAt: true,
				paymentGraceEndsAt: true,
				lastPaidInvoiceId: true,
				lastPaymentFailureAt: true,
				lastNotifiedPlan: true,
				lastNotifiedAt: true,
				lastNotifiedEventId: true,
			},
		})
		if (byEmail) return byEmail
	}

	const clauses = []
	if (params.stripeCustomerId) clauses.push({ stripeCustomerId: params.stripeCustomerId })
	if (params.stripeSubscriptionId) clauses.push({ stripeSubscriptionId: params.stripeSubscriptionId })
	if (clauses.length === 0) return null

	return prisma.customerProvisioning.findFirst({
		where: { OR: clauses },
		select: {
			id: true,
			email: true,
			normalizedEmail: true,
			stripeCustomerId: true,
			stripeSubscriptionId: true,
			currentPlan: true,
			plan: true,
			billingCadence: true,
			commitmentStatus: true,
			commitmentStartAt: true,
			commitmentEndAt: true,
			paymentGraceEndsAt: true,
			lastPaidInvoiceId: true,
			lastPaymentFailureAt: true,
			lastNotifiedPlan: true,
			lastNotifiedAt: true,
			lastNotifiedEventId: true,
		},
	})
}

function logProvisioningConflict(params: {
	reason: string
	email?: string | null
	normalizedEmail?: string | null
	stripeCustomerId?: string | null
	existingStripeCustomerId?: string | null
	existingNormalizedEmail?: string | null
	subscriptionId?: string | null
	eventId?: string | null
	eventType?: string | null
	context: string
}) {
	console.warn('customer_provisioning_conflict', {
		reason: params.reason,
		email: redactEmail(params.email ?? null),
		normalizedEmail: redactEmail(params.normalizedEmail ?? null),
		stripeCustomerId: params.stripeCustomerId ?? null,
		existingStripeCustomerId: params.existingStripeCustomerId ?? null,
		existingNormalizedEmail: redactEmail(params.existingNormalizedEmail ?? null),
		subscriptionId: params.subscriptionId ?? null,
		eventId: params.eventId ?? null,
		eventType: params.eventType ?? null,
		context: params.context,
	})
}

async function upsertProvisioningRecord({
	email,
	stripeCustomerId,
	stripeSubscriptionId,
	plan,
	status,
	lastEventId,
	stripePriceId,
	subscriptionStatus,
	subscriptionCurrentPeriodEnd,
	subscriptionCancelAtPeriodEnd,
	subscriptionUpdatedAt,
	stripeSubscriptionScheduleId,
	stripeCheckoutSessionId,
	billingCadence,
	commitmentStatus,
	commitmentStartAt,
	commitmentEndAt,
	cancellationRequestedAt,
	cancellationEffectiveAt,
	paymentGraceEndsAt,
	lastPaidInvoiceId,
	lastPaymentFailureAt,
	contractVersion,
	contractAcceptedAt,
	immediateAccessConsentAt,
	earlyTerminationReason,
	earlyTerminationApprovedBy,
}: {
	email: string
	stripeCustomerId: string
	stripeSubscriptionId?: string | null
	plan: string
	status: string
	lastEventId?: string | null
	stripePriceId?: string | null
	subscriptionStatus?: string | null
	subscriptionCurrentPeriodEnd?: Date | null
	subscriptionCancelAtPeriodEnd?: boolean | null
	subscriptionUpdatedAt?: Date | null
	stripeSubscriptionScheduleId?: string | null
	stripeCheckoutSessionId?: string | null
	billingCadence?: string | null
	commitmentStatus?: string | null
	commitmentStartAt?: Date | null
	commitmentEndAt?: Date | null
	cancellationRequestedAt?: Date | null
	cancellationEffectiveAt?: Date | null
	paymentGraceEndsAt?: Date | null
	lastPaidInvoiceId?: string | null
	lastPaymentFailureAt?: Date | null
	contractVersion?: string | null
	contractAcceptedAt?: Date | null
	immediateAccessConsentAt?: Date | null
	earlyTerminationReason?: string | null
	earlyTerminationApprovedBy?: string | null
}): Promise<void> {
	const normalizedEmail = normalizeEmailAddress(email)
	if (!normalizedEmail) {
		logProvisioningConflict({
			reason: 'invalid_email',
			email,
			normalizedEmail: redactEmail(normalizedEmail),
			stripeCustomerId,
			context: 'upsert',
		})
		return
	}

	const existingByEmail = await prisma.customerProvisioning.findUnique({
		where: { normalizedEmail },
		select: { id: true, stripeCustomerId: true, normalizedEmail: true },
	})

	const existingByCustomer = await prisma.customerProvisioning.findUnique({
		where: { stripeCustomerId },
		select: { id: true, stripeCustomerId: true, normalizedEmail: true },
	})

	if (existingByCustomer && existingByCustomer.normalizedEmail !== normalizedEmail) {
		logProvisioningConflict({
			reason: 'stripe_customer_id_mismatch',
			email,
			normalizedEmail: redactEmail(normalizedEmail),
			stripeCustomerId,
			existingStripeCustomerId: existingByCustomer.stripeCustomerId,
			existingNormalizedEmail: existingByCustomer.normalizedEmail,
			context: 'upsert',
		})
		return
	}

	const existing = existingByEmail ?? existingByCustomer

	const updateData: {
		email: string
		normalizedEmail: string
		stripeCustomerId?: string
		stripeSubscriptionId?: string | null
		plan?: string | null
		currentPlan?: string | null
		status: string
		lastEventId?: string | null
		stripePriceId?: string | null
		subscriptionStatus?: string | null
		subscriptionCurrentPeriodEnd?: Date | null
		subscriptionCancelAtPeriodEnd?: boolean | null
		subscriptionUpdatedAt?: Date | null
		stripeSubscriptionScheduleId?: string | null
		stripeCheckoutSessionId?: string | null
		billingCadence?: string | null
		commitmentStatus?: string | null
		commitmentStartAt?: Date | null
		commitmentEndAt?: Date | null
		cancellationRequestedAt?: Date | null
		cancellationEffectiveAt?: Date | null
		paymentGraceEndsAt?: Date | null
		lastPaidInvoiceId?: string | null
		lastPaymentFailureAt?: Date | null
		contractVersion?: string | null
		contractAcceptedAt?: Date | null
		immediateAccessConsentAt?: Date | null
		earlyTerminationReason?: string | null
		earlyTerminationApprovedBy?: string | null
	} = {
		email,
		normalizedEmail,
		stripeCustomerId,
		stripeSubscriptionId: stripeSubscriptionId ?? null,
		plan: plan ?? null,
		currentPlan: plan ?? null,
		status,
		lastEventId: lastEventId ?? null,
		stripePriceId: stripePriceId ?? null,
		subscriptionStatus: subscriptionStatus ?? null,
		subscriptionCurrentPeriodEnd: subscriptionCurrentPeriodEnd ?? null,
		subscriptionCancelAtPeriodEnd: subscriptionCancelAtPeriodEnd ?? null,
		subscriptionUpdatedAt: subscriptionUpdatedAt ?? null,
	}

	if (stripeSubscriptionScheduleId !== undefined) {
		updateData.stripeSubscriptionScheduleId = stripeSubscriptionScheduleId
	}
	if (stripeCheckoutSessionId !== undefined) {
		updateData.stripeCheckoutSessionId = stripeCheckoutSessionId
	}
	if (billingCadence !== undefined) updateData.billingCadence = billingCadence
	if (commitmentStatus !== undefined) updateData.commitmentStatus = commitmentStatus
	if (commitmentStartAt !== undefined) updateData.commitmentStartAt = commitmentStartAt
	if (commitmentEndAt !== undefined) updateData.commitmentEndAt = commitmentEndAt
	if (cancellationRequestedAt !== undefined) {
		updateData.cancellationRequestedAt = cancellationRequestedAt
	}
	if (cancellationEffectiveAt !== undefined) {
		updateData.cancellationEffectiveAt = cancellationEffectiveAt
	}
	if (paymentGraceEndsAt !== undefined) updateData.paymentGraceEndsAt = paymentGraceEndsAt
	if (lastPaidInvoiceId !== undefined) updateData.lastPaidInvoiceId = lastPaidInvoiceId
	if (lastPaymentFailureAt !== undefined) {
		updateData.lastPaymentFailureAt = lastPaymentFailureAt
	}
	if (contractVersion !== undefined) updateData.contractVersion = contractVersion
	if (contractAcceptedAt !== undefined) updateData.contractAcceptedAt = contractAcceptedAt
	if (immediateAccessConsentAt !== undefined) {
		updateData.immediateAccessConsentAt = immediateAccessConsentAt
	}
	if (earlyTerminationReason !== undefined) {
		updateData.earlyTerminationReason = earlyTerminationReason
	}
	if (earlyTerminationApprovedBy !== undefined) {
		updateData.earlyTerminationApprovedBy = earlyTerminationApprovedBy
	}

	if (existing?.stripeCustomerId && existing.stripeCustomerId !== stripeCustomerId) {
		logProvisioningConflict({
			reason: 'stripe_customer_id_mismatch',
			email,
			normalizedEmail,
			stripeCustomerId,
			existingStripeCustomerId: existing.stripeCustomerId,
			existingNormalizedEmail: existing.normalizedEmail,
			context: 'upsert',
		})
		// Keep existing Stripe customer id to avoid clobbering.
		delete updateData.stripeCustomerId
	}

	try {
		if (existing) {
			await prisma.customerProvisioning.update({
				where: { id: existing.id },
				data: updateData,
			})
			return
		}

		const stripeCustomerIdForCreate = updateData.stripeCustomerId
		if (!stripeCustomerIdForCreate) {
			logProvisioningConflict({
				reason: 'missing_stripe_customer_id',
				email,
				normalizedEmail,
				stripeCustomerId,
				context: 'upsert',
			})
			return
		}

		await prisma.customerProvisioning.create({
			data: {
				...updateData,
				stripeCustomerId: stripeCustomerIdForCreate,
			},
		})
	} catch (error) {
		const message = (error as Error).message ?? 'unknown_error'
		logProvisioningConflict({
			reason: 'upsert_failed',
			email,
			normalizedEmail,
			stripeCustomerId,
			existingStripeCustomerId: existing?.stripeCustomerId ?? null,
			existingNormalizedEmail: existing?.normalizedEmail ?? null,
			context: 'upsert',
		})
		console.error('customer_provisioning_upsert_failed', {
			message,
			email: redactEmail(email),
			normalizedEmail: redactEmail(normalizedEmail),
			stripeCustomerId,
		})
	}
}

export type InvoicePaymentProjectionStatus =
	| 'failed'
	| 'action_required'
	| 'paid'
	| 'refunded'
	| 'disputed'
	| 'dispute_won'
	| 'dispute_lost'
	| 'dispute_resolved'

export type InvoicePaymentProjectionResult = {
	updated: boolean
	deduped: boolean
	stale: boolean
	recovered: boolean
	previousStatus: string | null
}

export async function projectInvoicePaymentState(params: {
	stripeCustomerId?: string | null
	stripeSubscriptionId?: string | null
	stripeInvoiceId?: string | null
	stripeChargeId?: string | null
	stripePaymentIntentId?: string | null
	disputeStatus?: string | null
	eventId: string
	paymentStatus: InvoicePaymentProjectionStatus
	occurredAt?: Date
}): Promise<InvoicePaymentProjectionResult> {
	const stripeCustomerId = params.stripeCustomerId?.trim() || null
	const stripeSubscriptionId = params.stripeSubscriptionId?.trim() || null
	const stripeInvoiceId = params.stripeInvoiceId?.trim() || null
	const stripeChargeId = params.stripeChargeId?.trim() || null
	const stripePaymentIntentId = params.stripePaymentIntentId?.trim() || null
	const disputeStatus = params.disputeStatus?.trim() || null
	const occurredAt = params.occurredAt ?? new Date()
	const whereOr: Array<Record<string, unknown>> = []
	if (stripeCustomerId) whereOr.push({ stripeCustomerId })
	if (stripeSubscriptionId) whereOr.push({ stripeSubscriptionId })
	if (stripePaymentIntentId) whereOr.push({ paymentLastPaymentIntentId: stripePaymentIntentId })
	if (stripeChargeId) whereOr.push({ paymentLastChargeId: stripeChargeId })

	if (whereOr.length === 0) {
		return { updated: false, deduped: false, stale: false, recovered: false, previousStatus: null }
	}

	const existing = await prisma.customerProvisioning.findFirst({
		where: { OR: whereOr },
		select: {
			id: true,
			billingCadence: true,
			commitmentStatus: true,
			subscriptionStatus: true,
			paymentGraceEndsAt: true,
			lastPaidInvoiceId: true,
			lastPaymentFailureAt: true,
			paymentStatus: true,
			paymentRecoveredAt: true,
			paymentRefundedAt: true,
			paymentDisputeStatus: true,
			paymentDisputedAt: true,
			paymentDisputeResolvedAt: true,
			paymentUpdatedAt: true,
			paymentLastEventId: true,
			paymentLastInvoiceId: true,
			paymentLastChargeId: true,
			paymentLastPaymentIntentId: true,
		},
	})

	if (!existing) {
		return { updated: false, deduped: false, stale: false, recovered: false, previousStatus: null }
	}

	if (existing.paymentLastEventId === params.eventId) {
		return {
			updated: false,
			deduped: true,
			stale: false,
			recovered: false,
			previousStatus: existing.paymentStatus,
		}
	}

	if (existing.paymentUpdatedAt && existing.paymentUpdatedAt.getTime() > occurredAt.getTime()) {
		return {
			updated: false,
			deduped: false,
			stale: true,
			recovered: false,
			previousStatus: existing.paymentStatus,
		}
	}

	const paid = params.paymentStatus === 'paid'
	const paymentAttentionRequired =
		params.paymentStatus === 'failed' || params.paymentStatus === 'action_required'
	const recovered = paid && existing.paymentStatus === 'failed'
	const disputeResolved =
		params.paymentStatus === 'dispute_won' ||
		params.paymentStatus === 'dispute_lost' ||
		params.paymentStatus === 'dispute_resolved'
	const monthlyCommitment = existing.billingCadence === 'monthly_commitment'
	const providerAllowsAccess =
		existing.subscriptionStatus === 'active' || existing.subscriptionStatus === 'trialing'
	const activateMonthlyAccess = monthlyCommitment && paid && providerAllowsAccess

	await prisma.customerProvisioning.update({
		where: { id: existing.id },
		data: {
			paymentStatus: params.paymentStatus,
			paymentFailedAt: paymentAttentionRequired ? occurredAt : undefined,
			paymentRecoveredAt: recovered ? occurredAt : existing.paymentRecoveredAt,
			paymentRefundedAt:
				params.paymentStatus === 'refunded' ? occurredAt : existing.paymentRefundedAt,
			paymentDisputeStatus: disputeStatus ?? existing.paymentDisputeStatus,
			paymentDisputedAt:
				params.paymentStatus === 'disputed' ? occurredAt : existing.paymentDisputedAt,
			paymentDisputeResolvedAt:
				disputeResolved ? occurredAt : existing.paymentDisputeResolvedAt,
			paymentUpdatedAt: occurredAt,
			paymentLastEventId: params.eventId,
			paymentLastInvoiceId: stripeInvoiceId ?? existing.paymentLastInvoiceId,
			paymentLastChargeId: stripeChargeId ?? existing.paymentLastChargeId,
			paymentLastPaymentIntentId:
				stripePaymentIntentId ?? existing.paymentLastPaymentIntentId,
			lastPaidInvoiceId: paid ? stripeInvoiceId ?? existing.lastPaidInvoiceId : undefined,
			lastPaymentFailureAt: paymentAttentionRequired ? occurredAt : undefined,
			paymentGraceEndsAt: paymentAttentionRequired
				? paymentGraceEnd(occurredAt)
				: paid
					? null
					: undefined,
			plan: activateMonthlyAccess ? 'jpv_bootcamp_membership' : undefined,
			currentPlan: activateMonthlyAccess ? 'jpv_bootcamp_membership' : undefined,
			status: activateMonthlyAccess ? 'active' : undefined,
			commitmentStatus:
				activateMonthlyAccess && existing.commitmentStatus === 'pending'
					? 'active'
					: undefined,
		},
	})

	return {
		updated: true,
		deduped: false,
		stale: false,
		recovered,
		previousStatus: existing.paymentStatus,
	}
}

async function markProvisioningNotified(params: {
	stripeCustomerId: string
	email: string
	plan: string
	sendKey?: string | null
}): Promise<void> {
	const now = new Date()
	const normalizedEmail = normalizeEmailAddress(params.email)
	const byEmail = normalizedEmail
		? await prisma.customerProvisioning.findUnique({
				where: { normalizedEmail },
				select: { id: true },
		  })
		: null
	const byCustomer = await prisma.customerProvisioning.findUnique({
		where: { stripeCustomerId: params.stripeCustomerId },
		select: { id: true },
	})
	const targetId = byEmail?.id ?? byCustomer?.id ?? null
	if (!targetId) {
		console.warn('customer_provisioning_missing_for_notification', {
			email: redactEmail(params.email),
			normalizedEmail: redactEmail(normalizedEmail),
			stripeCustomerId: params.stripeCustomerId,
			sendKey: params.sendKey ?? null,
		})
		return
	}

	try {
		await prisma.customerProvisioning.update({
			where: { id: targetId },
			data: {
				lastNotifiedPlan: params.plan,
				lastNotifiedAt: now,
				lastNotifiedEventId: params.sendKey ?? null,
			},
		})
	} catch (error) {
		console.error('customer_provisioning_notification_update_failed', {
			email: redactEmail(params.email),
			normalizedEmail: redactEmail(normalizedEmail),
			stripeCustomerId: params.stripeCustomerId,
			sendKey: params.sendKey ?? null,
			message: (error as Error).message ?? 'unknown_error',
		})
	}
}

export async function provisionFromCheckoutSession(
	session: Stripe.Checkout.Session,
	eventId?: string | null,
	eventType?: string | null,
	options?: { dryRun?: boolean; allowEmail?: boolean; eventLivemode?: boolean | null }
): Promise<ProvisioningSummary> {
	let email: string | null = null
	let resolvedEmail: string | null = null
	let resolvedEmailSource: EmailSource | null = null
	let customerId: string | null = null
	let subscriptionId: string | null = null
	let incomingPlan: string | null = null
	let resolvedPlan: string | null = null
	let resolvedPriceId: string | null = null
	let oldPlan: string | null = null
	let newPlan: string | null = null
	let emailSent = false
	let emailReason: string | null = null
	const allowEmail = options?.allowEmail ?? false
	const disableNonWebhookEmails = isEnvEnabled(process.env.DISABLE_NON_WEBHOOK_EMAILS)
	const eventLivemode =
		typeof options?.eventLivemode === 'boolean' ? options?.eventLivemode : null
	const emailSource = resolveEmailSource(eventType)
	const billingCadence =
		typeof session.metadata?.billing_cadence === 'string'
			? session.metadata.billing_cadence
			: session.metadata?.billing === 'monthly'
				? 'monthly_commitment'
				: session.metadata?.billing === 'annual'
					? 'annual'
					: null
	const monthlyCommitment = isMonthlyCommitmentMetadata(session.metadata)
	const contractVersion = session.metadata?.contract_version ?? null
	const contractAcceptedAt = dateFromIsoString(session.metadata?.contract_accepted_at)
	const immediateAccessConsentAt = dateFromIsoString(
		session.metadata?.immediate_access_consent_at,
	)

	const logDecision = (decision: ProvisioningDecision, reason: string) => {
		logProvisioningDecision({
			eventId: eventId ?? null,
			type: eventType ?? null,
			livemode: eventLivemode,
			customerId,
			subscriptionId,
			email,
			incomingPlan,
			resolvedEmail,
			resolvedEmailSource,
			resolvedPlan,
			resolvedPriceId,
			oldPlan,
			newPlan,
			emailSent,
			emailReason,
			decision,
			reason,
		})
	}

	const buildSummary = (decision: ProvisioningDecision, reason: string): ProvisioningSummary => ({
		ok: decision !== 'skip',
		decision,
		reason,
		oldPlan,
		newPlan,
		emailSent,
		emailReason,
		email,
		resolvedEmail,
		resolvedEmailSource,
		stripeCustomerId: customerId,
		stripeSubscriptionId: subscriptionId,
		plan: incomingPlan,
		priceId: resolvedPriceId,
	})

	if (session.mode !== 'subscription') {
		logDecision('skip', 'non_subscription')
		return buildSummary('skip', 'non_subscription')
	}

	if (
		monthlyCommitment &&
		(!contractVersion || !contractAcceptedAt || !immediateAccessConsentAt)
	) {
		logDecision('skip', 'missing_commitment_consent')
		return buildSummary('skip', 'missing_commitment_consent')
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
	if (!resolvedPriceId) {
		console.warn('provisioning_missing_price_id', {
			context: 'checkout',
			sessionId: session.id,
			subscriptionId,
			eventId: eventId ?? null,
		})
	}
	const storedPlanName = resolveStoredPlanName(existing)
	const lastNotifiedPlan = existing?.lastNotifiedPlan ?? null
	const lastNotifiedAt = existing?.lastNotifiedAt ?? null
	const lastNotifiedEventId = existing?.lastNotifiedEventId ?? null

	if (!plan || !isProvisioningPlan(plan)) {
		console.error('membership projection skipped: invalid plan', {
			sessionId: session.id,
			email: redactEmail(email),
			customerId,
			subscriptionId,
			plan: plan ?? null,
		})
		logDecision('skip', 'invalid_plan')
		return buildSummary('skip', 'invalid_plan')
	}

	incomingPlan = plan
	const emailSendKey = buildEmailSendKey({
		eventId: eventId ?? null,
		subscriptionId,
		plan: incomingPlan,
		effectiveAt: typeof session.created === 'number' ? session.created : null,
	})

	const planChanged = storedPlanName !== incomingPlan
	const isNewCustomerCheckout = Boolean(existing && existing.stripeCustomerId && existing.stripeCustomerId !== customerId)
	const decision: ProvisioningDecision = existing
		? planChanged ? 'update_plan' : isNewCustomerCheckout ? 'update_plan' : 'skip'
		: 'provision'
	const reason = existing
		? planChanged ? 'plan_changed' : isNewCustomerCheckout ? 'new_customer_same_plan' : 'plan_unchanged'
		: 'no_projection_record'
	oldPlan = storedPlanName
	newPlan = incomingPlan
	const isCanonicalEmailEvent =
		eventType === 'checkout.session.completed' ||
		eventType === 'customer.subscription.updated' ||
		eventType === 'manual_sync'
	const emailEval = evaluateEmailNotification({
		allowEmail: allowEmail && isCanonicalEmailEvent,
		disabledReason: !isCanonicalEmailEvent ? 'event_not_canonical' : undefined,
		oldPlan,
		newPlan,
		lastNotifiedPlan,
		lastNotifiedAt,
		lastNotifiedEventId,
		sendKey: emailSendKey,
		isNewCustomer: isNewCustomerCheckout,
	})
	emailReason = emailEval.reason

	console.debug('Projecting checkout session', {
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
		plan: monthlyCommitment ? 'none' : incomingPlan,
		status: monthlyCommitment ? 'pending_payment' : 'active',
		lastEventId: eventId ?? null,
		stripePriceId: resolvedPriceId,
		stripeCheckoutSessionId: session.id,
		billingCadence,
		commitmentStatus: monthlyCommitment ? 'pending' : undefined,
		contractVersion: monthlyCommitment ? contractVersion : undefined,
		contractAcceptedAt: monthlyCommitment ? contractAcceptedAt : undefined,
		immediateAccessConsentAt: monthlyCommitment ? immediateAccessConsentAt : undefined,
	})

	let memberCredentials: { email: string; password: string } | null = null
	let memberWasCreated = false
	try {
		const customerName = (session.customer_details?.name) ?? null
		const memberResult = await provisionMemberFromCheckout({
			email,
			displayName: customerName,
			stripeCustomerId: customerId,
		})
		memberWasCreated = memberResult.created
		if (memberResult.created && memberResult.password) {
			memberCredentials = { email, password: memberResult.password }
		}
	} catch (memberError) {
		console.error('provisionMemberFromCheckout failed (non-blocking)', {
			email: redactEmail(email),
			error: (memberError as Error).message,
		})
		// Do not acknowledge the Stripe event when the Payload account could not
		// be created. Stripe will retry the webhook.
		throw memberError
	}
	const emailVariant = memberWasCreated || !existing ? 'welcome' : 'upgrade'

	if (emailEval.shouldSend) {
		if (disableNonWebhookEmails && emailSource !== 'webhook') {
			emailSent = false
			emailReason = 'non_webhook_disabled'
			console.info('Non-webhook email skipped', {
				email: redactEmail(email),
				templateKey: MEMBERSHIP_EMAIL_TEMPLATE_KEY,
				plan,
				eventId: eventId ?? null,
				source: emailSource,
				dedupeReason: emailReason,
			})
		} else {
			let emailAttempts = 0
			const maxAttempts = 3
			let lastEmailError: Error | null = null

			while (emailAttempts < maxAttempts && !emailSent) {
				try {
					const dedupeKey = `${email}|${subscriptionId ?? 'none'}|${incomingPlan}`
					const portalUrl = getServerConfig().email.portalUrl
					await sendWelcomeEmail({
						to: email,
						plan,
						resetUrl: buildMemberForgotPasswordUrl(portalUrl),
						credentials: memberCredentials,
						meta: {
							templateKey: MEMBERSHIP_EMAIL_TEMPLATE_KEY,
							variant: emailVariant,
							eventId: eventId ?? null,
							eventType: eventType ?? null,
							subscriptionId: subscriptionId ?? null,
							customerId,
							source: emailSource,
							dedupeKey,
							stackHint: 'lib/provisioning:provisionFromCheckoutSession',
						},
					})
					emailSent = true
					await markProvisioningNotified({
						stripeCustomerId: customerId,
						email,
						plan,
						sendKey: emailSendKey ?? null,
					})
					console.info('Membership email sent', {
						email: redactEmail(email),
						templateKey: MEMBERSHIP_EMAIL_TEMPLATE_KEY,
						plan: incomingPlan,
						eventId: eventId ?? null,
						source: emailSource,
						dedupeReason: emailReason,
					})
				} catch (error) {
					emailAttempts++
					lastEmailError = error as Error
					const errorMsg = (error as Error).message ?? 'unknown_error'
					const isTransient = errorMsg.includes('timeout') ||
						errorMsg.includes('ECONNREFUSED') ||
						errorMsg.includes('ECONNRESET') ||
						errorMsg.includes('ETIMEDOUT')

					if (emailAttempts < maxAttempts && isTransient) {
						const backoffMs = Math.min(1000 * Math.pow(2, emailAttempts - 1), 4000)
						console.warn('Membership email transient error, retrying', {
							email: redactEmail(email),
							attempt: emailAttempts,
							backoffMs,
							message: errorMsg,
						})
						await new Promise(resolve => setTimeout(resolve, backoffMs))
					} else {
						emailSent = false
						emailReason = isTransient ? 'send_timeout' : 'send_failed'
						console.error('Membership email failed (terminal)', {
							emailDomain: getEmailDomain(email),
							plan,
							eventId: eventId ?? null,
							attempts: emailAttempts,
							message: lastEmailError?.message ?? 'unknown_error',
						})
						break
					}
				}
			}
		}
	}

	logDecision(decision, reason)
	return buildSummary(decision, reason)
}

export async function syncFromSubscription(
	subscriptionId: string,
	eventId?: string | null,
	eventType?: string | null,
	options?: { dryRun?: boolean; allowEmail?: boolean; eventLivemode?: boolean | null }
): Promise<ProvisioningSummary> {
	let email: string | null = null
	let resolvedEmail: string | null = null
	let resolvedEmailSource: EmailSource | null = null
	let customerId: string | null = null
	let incomingPlan: string | null = null
	let resolvedPlan: string | null = null
	let resolvedPriceId: string | null = null
	let oldPlan: string | null = null
	let newPlan: string | null = null
	let emailSent = false
	let emailReason: string | null = null
	const allowEmail = options?.allowEmail ?? false
	const disableNonWebhookEmails = isEnvEnabled(process.env.DISABLE_NON_WEBHOOK_EMAILS)
	const eventLivemode =
		typeof options?.eventLivemode === 'boolean' ? options?.eventLivemode : null
	const emailSource = resolveEmailSource(eventType)

	const logDecision = (decision: ProvisioningDecision, reason: string) => {
		logProvisioningDecision({
			eventId: eventId ?? null,
			type: eventType ?? null,
			livemode: eventLivemode,
			customerId,
			subscriptionId,
			email,
			incomingPlan,
			resolvedEmail,
			resolvedEmailSource,
			resolvedPlan,
			resolvedPriceId,
			oldPlan,
			newPlan,
			emailSent,
			emailReason,
			decision,
			reason,
		})
	}

	const buildSummary = (decision: ProvisioningDecision, reason: string): ProvisioningSummary => ({
		ok: decision !== 'skip',
		decision,
		reason,
		oldPlan,
		newPlan,
		emailSent,
		emailReason,
		email,
		resolvedEmail,
		resolvedEmailSource,
		stripeCustomerId: customerId,
		stripeSubscriptionId: subscriptionId,
		plan: incomingPlan,
		priceId: resolvedPriceId,
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

	if (!subscription.items?.data || subscription.items.data.length === 0) {
		logDecision('skip', 'missing_subscription_items')
		return buildSummary('skip', 'missing_subscription_items')
	}

	const { plan, priceId } = getPlanFromSubscription(subscription)
	resolvedPlan = plan
	resolvedPriceId = priceId
	if (!resolvedPriceId) {
		console.warn('provisioning_missing_price_id', {
			context: 'subscription',
			subscriptionId: subscription.id,
			eventId: eventId ?? null,
		})
	}
	const storedPlanName = resolveStoredPlanName(existing)

	// Extract subscription projection data for state reconciliation
	const subscriptionDataForProjection = {
		stripePriceId: priceId ?? null,
		subscriptionStatus: subscription.status ?? null,
		subscriptionCurrentPeriodEnd:
			typeof subscription.current_period_end === 'number'
				? new Date(subscription.current_period_end * 1000)
				: null,
		subscriptionCancelAtPeriodEnd: subscription.cancel_at_period_end ?? null,
		subscriptionUpdatedAt: new Date(),
	}

	const isActive = ACTIVE_STATUSES.has(subscription.status)
	const monthlyCommitment =
		isMonthlyCommitmentMetadata(subscription.metadata) ||
		existing?.billingCadence === 'monthly_commitment'
	const hasVerifiedPaidInvoice = Boolean(existing?.lastPaidInvoiceId)
	const accessActive = isActive && (!monthlyCommitment || hasVerifiedPaidInvoice)
	if (accessActive && (!plan || !isProvisioningPlan(plan))) {
		console.error('membership projection skipped: invalid plan', {
			subscriptionId: subscription.id,
			email: redactEmail(email),
			customerId,
			plan: plan ?? null,
		})
		logDecision('skip', 'invalid_plan')
		return buildSummary('skip', 'invalid_plan')
	}
	const nextPlan = accessActive ? plan ?? 'none' : 'none'
	incomingPlan = normalizePlanName(nextPlan)
	if (!incomingPlan) {
		console.error('membership projection skipped: invalid plan', {
			subscriptionId: subscription.id,
			email: redactEmail(email),
			customerId,
			plan: nextPlan ?? null,
		})
		logDecision('skip', 'invalid_plan')
		return buildSummary('skip', 'invalid_plan')
	}
	const nextStatus = accessActive
		? 'active'
		: isActive && monthlyCommitment
			? 'pending_payment'
			: 'inactive'
	const projectedBillingCadence = monthlyCommitment
		? 'monthly_commitment'
		: subscription.metadata?.billing_cadence === 'annual' || subscription.metadata?.billing === 'annual'
			? 'annual'
			: existing?.billingCadence ?? null
	const projectedCommitmentStatus = monthlyCommitment
		? existing?.commitmentStatus ?? (hasVerifiedPaidInvoice ? 'active' : 'pending')
		: undefined
	const emailSendKey = buildEmailSendKey({
		eventId: eventId ?? null,
		subscriptionId: subscription.id,
		plan: incomingPlan,
		effectiveAt:
			typeof subscription.current_period_start === 'number'
				? subscription.current_period_start
				: null,
	})

	console.debug('Syncing subscription', {
		subscriptionId: subscription.id,
		status: subscription.status,
		plan: incomingPlan ?? 'none',
		emailDomain: getEmailDomain(email),
	})

	const lastNotifiedPlan = existing?.lastNotifiedPlan ?? null
	const lastNotifiedAt = existing?.lastNotifiedAt ?? null
	const lastNotifiedEventId = existing?.lastNotifiedEventId ?? null
	oldPlan = storedPlanName
	newPlan = incomingPlan
	const isCanonicalEmailEvent = eventType === 'customer.subscription.updated' || eventType === 'manual_sync'
	const isNewCustomer = Boolean(existing && existing.stripeCustomerId && existing.stripeCustomerId !== customerId)
	const emailEval = evaluateEmailNotification({
		allowEmail: allowEmail && isCanonicalEmailEvent,
		disabledReason: !isCanonicalEmailEvent ? 'event_not_canonical' : undefined,
		oldPlan,
		newPlan,
		lastNotifiedPlan,
		lastNotifiedAt,
		lastNotifiedEventId,
		sendKey: emailSendKey,
		isNewCustomer,
	})
	emailReason = emailEval.reason

	const planChanged = incomingPlan !== storedPlanName
	let decision: ProvisioningDecision = 'provision'
	let reason = 'no_projection_record'

	if (existing) {
		if (planChanged) {
			decision = 'update_plan'
			reason = 'plan_changed'
		} else if (isNewCustomer) {
			decision = 'update_plan'
			reason = 'new_customer_same_plan'
		} else {
			decision = 'skip'
			reason = 'plan_unchanged'
		}
	}

	if (decision === 'skip') {
		logProvisioningSkipDetails({
			context: 'subscription',
			eventId: eventId ?? null,
			livemode: eventLivemode,
			customerId,
			subscriptionId: subscription.id,
			email,
			plan: incomingPlan,
			resolvedEmail,
			resolvedEmailSource,
			resolvedPlan,
			resolvedPriceId,
			oldPlan,
			newPlan,
			emailSent,
			emailReason,
			reason,
		})
		await upsertProvisioningRecord({
			email,
			stripeCustomerId: customerId,
			stripeSubscriptionId: subscription.id,
			plan: incomingPlan ?? 'none',
			status: nextStatus,
			lastEventId: eventId ?? null,
			stripePriceId: resolvedPriceId,
			subscriptionStatus: subscription.status,
			subscriptionCurrentPeriodEnd: subscription.current_period_end
				? new Date(subscription.current_period_end * 1000)
				: null,
			subscriptionCancelAtPeriodEnd: subscription.cancel_at_period_end ?? null,
			subscriptionUpdatedAt: new Date(),
			billingCadence: projectedBillingCadence,
			commitmentStatus: projectedCommitmentStatus,
		})
		logDecision('skip', reason)
		return buildSummary('skip', reason)
	}

	if (!isProvisioningPlan(incomingPlan)) {
		console.error('membership projection skipped: invalid plan', {
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
			plan: incomingPlan ?? 'none',
			status: nextStatus,
			lastEventId: eventId ?? null,
			stripePriceId: resolvedPriceId,
			subscriptionStatus: subscription.status,
			subscriptionCurrentPeriodEnd: subscription.current_period_end
				? new Date(subscription.current_period_end * 1000)
				: null,
			subscriptionCancelAtPeriodEnd: subscription.cancel_at_period_end ?? null,
			subscriptionUpdatedAt: new Date(),
			billingCadence: projectedBillingCadence,
			commitmentStatus: projectedCommitmentStatus,
		})
		logDecision('skip', 'invalid_plan')
		return buildSummary('skip', 'invalid_plan')
	}

	console.info('membership_projection_sync', {
		email: redactEmail(email),
		customerId,
		subscriptionId: subscription.id,
		plan: incomingPlan,
	})

	const emailVariant = existing ? 'upgrade' : 'welcome'

	await upsertProvisioningRecord({
		email,
		stripeCustomerId: customerId,
		stripeSubscriptionId: subscription.id,
		plan: incomingPlan,
		status: nextStatus,
		lastEventId: eventId ?? null,
		stripePriceId: resolvedPriceId,
		subscriptionStatus: subscription.status,
		subscriptionCurrentPeriodEnd: subscription.current_period_end
			? new Date(subscription.current_period_end * 1000)
			: null,
		subscriptionCancelAtPeriodEnd: subscription.cancel_at_period_end ?? null,
		subscriptionUpdatedAt: new Date(),
		billingCadence: projectedBillingCadence,
		commitmentStatus: projectedCommitmentStatus,
	})

	if (emailEval.shouldSend) {
		if (disableNonWebhookEmails && emailSource !== 'webhook') {
			emailSent = false
			emailReason = 'non_webhook_disabled'
			console.info('Non-webhook email skipped', {
				email: redactEmail(email),
				templateKey: MEMBERSHIP_EMAIL_TEMPLATE_KEY,
				plan: incomingPlan,
				eventId: eventId ?? null,
				source: emailSource,
				dedupeReason: emailReason,
			})
		} else {
			try {
				const dedupeKey = `${email}|${subscription.id}|${incomingPlan}`
				const portalUrl = getServerConfig().email.portalUrl
				await sendWelcomeEmail({
					to: email,
					plan: incomingPlan,
					resetUrl: buildMemberForgotPasswordUrl(portalUrl),
					meta: {
						templateKey: MEMBERSHIP_EMAIL_TEMPLATE_KEY,
						variant: emailVariant,
						eventId: eventId ?? null,
						eventType: eventType ?? null,
						subscriptionId: subscription.id,
						customerId,
						source: emailSource,
						dedupeKey,
						stackHint: 'lib/provisioning:syncFromSubscription',
					},
				})
				emailSent = true
				await markProvisioningNotified({
					stripeCustomerId: customerId,
					email,
					plan: incomingPlan,
					sendKey: emailSendKey ?? null,
				})
				console.info('Membership email sent', {
					email: redactEmail(email),
					templateKey: MEMBERSHIP_EMAIL_TEMPLATE_KEY,
					plan: incomingPlan,
					eventId: eventId ?? null,
					source: emailSource,
					dedupeReason: emailReason,
				})
			} catch (error) {
				emailSent = false
				emailReason = 'send_failed'
				console.error('Membership email failed', {
					emailDomain: getEmailDomain(email),
					plan: incomingPlan,
					eventId: eventId ?? null,
					message: (error as Error).message ?? 'unknown_error',
				})
			}
		}
	}

	logDecision(decision, reason)
	return buildSummary(decision, reason)
}
