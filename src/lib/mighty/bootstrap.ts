import type Stripe from 'stripe'

import prisma from '@/libs/prisma'
import { normalizeEmail } from '@/lib/normalize-email'
import {
	queueMightyAccessSync,
} from './accessSync'
import { deriveMightyDesiredAccess, type MightyDesiredAccess } from './entitlement'
import { MightySafetyError } from './mutationPolicy'

export const PHASE_A_BOOTSTRAP_EMAIL = 'westhoek@hotmail.com'
export const PHASE_A_BOOTSTRAP_PLAN_ID = 2000039

type LocalStripeIdentity = {
	id: string
	email: string
	normalizedEmail: string
	stripeCustomerId: string
	stripeSubscriptionId: string | null
	status: string
	plan: string | null
	currentPlan: string | null
	subscriptionStatus: string | null
	subscriptionUpdatedAt: Date | null
	paymentStatus: string | null
}

type BootstrapStore = {
	customerProvisioning: {
		findUnique: (args: { where: Record<string, string>; select: Record<string, boolean> }) => Promise<LocalStripeIdentity | null>
	}
}

type BootstrapStripe = Pick<Stripe, 'customers' | 'subscriptions'>

const LOCAL_IDENTITY_SELECT = {
	id: true,
	email: true,
	normalizedEmail: true,
	stripeCustomerId: true,
	stripeSubscriptionId: true,
	status: true,
	plan: true,
	currentPlan: true,
	subscriptionStatus: true,
	subscriptionUpdatedAt: true,
	paymentStatus: true,
} as const

const SUPPORTED_SUBSCRIPTION_STATES = new Set([
	'active',
	'trialing',
	'past_due',
	'canceled',
	'unpaid',
	'incomplete',
	'incomplete_expired',
	'paused',
])

function fail(code: string, detail?: string): never {
	throw new MightySafetyError(code, detail ?? code)
}

function stripeRelationshipId(value: unknown): string | null {
	if (typeof value === 'string' && value.trim()) return value.trim()
	if (value && typeof value === 'object' && 'id' in value) {
		const id = (value as { id?: unknown }).id
		return typeof id === 'string' && id.trim() ? id.trim() : null
	}
	return null
}

function stripeCustomerEmail(customer: Stripe.Customer | Stripe.DeletedCustomer): string | null {
	if ('deleted' in customer && customer.deleted) return null
	return normalizeEmail((customer as Stripe.Customer).email)
}

function ensureExactIdentity(local: LocalStripeIdentity, email: string): void {
	if (normalizeEmail(local.email) !== email || normalizeEmail(local.normalizedEmail) !== email) {
		fail('mighty_bootstrap_identity_ambiguous')
	}
	if (!local.stripeCustomerId?.trim() || !local.stripeSubscriptionId?.trim()) {
		fail('mighty_bootstrap_stripe_identity_missing')
	}
}

async function resolveExactLocalIdentity(
	store: BootstrapStore,
	email: string,
): Promise<LocalStripeIdentity> {
	const local = await store.customerProvisioning.findUnique({
		where: { normalizedEmail: email },
		select: LOCAL_IDENTITY_SELECT,
	})
	if (!local) fail('mighty_bootstrap_identity_missing')
	ensureExactIdentity(local, email)

	const byCustomer = await store.customerProvisioning.findUnique({
		where: { stripeCustomerId: local.stripeCustomerId },
		select: { id: true, normalizedEmail: true },
	})
	const bySubscription = await store.customerProvisioning.findUnique({
		where: { stripeSubscriptionId: local.stripeSubscriptionId as string },
		select: { id: true, normalizedEmail: true },
	})
	if (
		(byCustomer && (byCustomer.id !== local.id || normalizeEmail(byCustomer.normalizedEmail) !== email)) ||
		(bySubscription && (bySubscription.id !== local.id || normalizeEmail(bySubscription.normalizedEmail) !== email))
	) {
		fail('mighty_bootstrap_identity_ambiguous')
	}
	return local
}

function deriveCurrentAccess(local: LocalStripeIdentity, subscriptionStatus: string): MightyDesiredAccess {
	return deriveMightyDesiredAccess({
		recordStatus: local.status,
		subscriptionStatus,
		paymentStatus: local.paymentStatus,
	})
}

export type MightyAccessBootstrapResult = {
	queued: boolean
	reason?: string
	rowId?: string
	desiredAccess: MightyDesiredAccess
	stateSource: 'operator_bootstrap'
	stateObservedAt: Date
	stripeCustomerId: string
	stripeSubscriptionId: string
}

export async function bootstrapMightyAccessSync(params: {
	email: string
	stripe: BootstrapStripe
	prismaClient?: BootstrapStore
}): Promise<MightyAccessBootstrapResult> {
	const email = normalizeEmail(params.email)
	if (email !== PHASE_A_BOOTSTRAP_EMAIL) fail('mighty_bootstrap_email_not_authorized')

	const store = params.prismaClient ?? (prisma as unknown as BootstrapStore)
	const local = await resolveExactLocalIdentity(store, email)
	const stripeCustomerId = local.stripeCustomerId.trim()
	const stripeSubscriptionId = local.stripeSubscriptionId?.trim()
	if (!stripeSubscriptionId) fail('mighty_bootstrap_stripe_identity_missing')

	const customer = await params.stripe.customers.retrieve(stripeCustomerId)
	const customerEmail = stripeCustomerEmail(customer)
	if (customerEmail !== email) fail('mighty_bootstrap_stripe_customer_mismatch')

	const subscription = await params.stripe.subscriptions.retrieve(stripeSubscriptionId) as unknown as Stripe.Subscription
	if (subscription.id !== stripeSubscriptionId) fail('mighty_bootstrap_stripe_subscription_mismatch')
	if (stripeRelationshipId(subscription.customer) !== stripeCustomerId) {
		fail('mighty_bootstrap_stripe_subscription_customer_mismatch')
	}
	if (!SUPPORTED_SUBSCRIPTION_STATES.has(subscription.status)) {
		fail('mighty_bootstrap_subscription_state_unsupported')
	}
	const providerUpdated = (subscription as unknown as { updated?: unknown }).updated
	const observedSeconds = Number.isInteger(providerUpdated) && (providerUpdated as number) > 0
		? providerUpdated as number
		: local.subscriptionUpdatedAt
			? Math.floor(local.subscriptionUpdatedAt.getTime() / 1000)
			: subscription.created
	if (!Number.isInteger(observedSeconds) || observedSeconds <= 0) {
		fail('mighty_bootstrap_subscription_observation_missing')
	}

	const stateObservedAt = new Date(observedSeconds * 1000)
	const desiredAccess = deriveCurrentAccess(local, subscription.status)
	const queued = await queueMightyAccessSync({
		email,
		stripeCustomerId,
		stripeSubscriptionId,
		stateSource: 'operator_bootstrap',
		stateObservedAt,
		plan: local.currentPlan ?? local.plan,
		desiredAccess,
		welcomeRequired: false,
	})

	return {
		...queued,
		desiredAccess,
		stateSource: 'operator_bootstrap',
		stateObservedAt,
		stripeCustomerId,
		stripeSubscriptionId,
	}
}
