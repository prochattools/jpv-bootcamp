import 'server-only'

import prisma from '@/libs/prisma'
import { normalizeEmail } from '@/lib/normalize-email'

export type BillingAccessState = 'available' | 'billing_hold' | 'inactive' | 'unknown'
export type BillingPaymentState =
	| 'failed'
	| 'paid'
	| 'refunded'
	| 'disputed'
	| 'dispute_won'
	| 'dispute_lost'
	| 'dispute_resolved'

export type BillingStatus = {
	hasBillingAccount: boolean
	hasActiveSubscription: boolean
	planLabel: string | null
	subscriptionStatus: string | null
	billingAccessState: BillingAccessState
	periodEndDate: Date | null
	cancelAtPeriodEnd: boolean
	paymentStatus: BillingPaymentState | null
	paymentFailedAt: Date | null
	paymentRefundedAt: Date | null
	paymentDisputeStatus: string | null
	paymentDisputedAt: Date | null
	paymentDisputeResolvedAt: Date | null
	showPaymentWarning: boolean
	showRefundNotice: boolean
	showDisputeNotice: boolean
	manageBillingAvailable: boolean
}

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing', 'past_due', 'unpaid'])
const BILLING_HOLD_SUBSCRIPTION_STATUSES = new Set(['past_due', 'unpaid', 'canceled'])
const BILLING_PAYMENT_STATES = new Set<BillingPaymentState>([
	'failed',
	'paid',
	'refunded',
	'disputed',
	'dispute_won',
	'dispute_lost',
	'dispute_resolved',
])

function resolveBillingAccessState(
	subscriptionStatus: string | null,
	paymentStatus: BillingPaymentState | null,
): BillingAccessState {
	if (paymentStatus === 'failed' || (subscriptionStatus && BILLING_HOLD_SUBSCRIPTION_STATUSES.has(subscriptionStatus))) {
		return 'billing_hold'
	}
	if (subscriptionStatus === 'active' || subscriptionStatus === 'trialing') return 'available'
	if (subscriptionStatus) return 'inactive'
	return 'unknown'
}

/**
 * Get billing status for an authenticated member without calling Stripe.
 * Reads from persisted CustomerProvisioning state.
 */
export async function getBillingStatus(
	memberEmail: string
): Promise<BillingStatus> {
	const normalizedEmail = normalizeEmail(memberEmail)
	if (!normalizedEmail) {
		return {
			hasBillingAccount: false,
			hasActiveSubscription: false,
			planLabel: null,
			subscriptionStatus: null,
			billingAccessState: 'unknown',
			periodEndDate: null,
			cancelAtPeriodEnd: false,
			paymentStatus: null,
			paymentFailedAt: null,
			paymentRefundedAt: null,
			paymentDisputeStatus: null,
			paymentDisputedAt: null,
			paymentDisputeResolvedAt: null,
			showPaymentWarning: false,
			showRefundNotice: false,
			showDisputeNotice: false,
			manageBillingAvailable: false,
		}
	}

	const record = await prisma.customerProvisioning.findUnique({
		where: { normalizedEmail },
		select: {
			stripeCustomerId: true,
			currentPlan: true,
			subscriptionStatus: true,
			subscriptionCurrentPeriodEnd: true,
			subscriptionCancelAtPeriodEnd: true,
			paymentStatus: true,
			paymentFailedAt: true,
			paymentRefundedAt: true,
			paymentDisputeStatus: true,
			paymentDisputedAt: true,
			paymentDisputeResolvedAt: true,
		},
	})

	if (!record || !record.stripeCustomerId) {
		return {
			hasBillingAccount: false,
			hasActiveSubscription: false,
			planLabel: null,
			subscriptionStatus: null,
			billingAccessState: 'unknown',
			periodEndDate: null,
			cancelAtPeriodEnd: false,
			paymentStatus: null,
			paymentFailedAt: null,
			paymentRefundedAt: null,
			paymentDisputeStatus: null,
			paymentDisputedAt: null,
			paymentDisputeResolvedAt: null,
			showPaymentWarning: false,
			showRefundNotice: false,
			showDisputeNotice: false,
			manageBillingAvailable: false,
		}
	}

	// Human-readable plan labels
	const planLabel = record.currentPlan
		? record.currentPlan.charAt(0).toUpperCase() + record.currentPlan.slice(1)
		: null

	const paymentStatus =
		record.paymentStatus && BILLING_PAYMENT_STATES.has(record.paymentStatus as BillingPaymentState)
			? record.paymentStatus as BillingPaymentState
			: null

	return {
		hasBillingAccount: true,
		hasActiveSubscription: Boolean(
			record.subscriptionStatus && ACTIVE_SUBSCRIPTION_STATUSES.has(record.subscriptionStatus),
		),
		planLabel,
		subscriptionStatus: record.subscriptionStatus,
		billingAccessState: resolveBillingAccessState(record.subscriptionStatus, paymentStatus),
		periodEndDate: record.subscriptionCurrentPeriodEnd,
		cancelAtPeriodEnd: record.subscriptionCancelAtPeriodEnd ?? false,
		paymentStatus,
		paymentFailedAt: record.paymentFailedAt,
		paymentRefundedAt: record.paymentRefundedAt,
		paymentDisputeStatus: record.paymentDisputeStatus,
		paymentDisputedAt: record.paymentDisputedAt,
		paymentDisputeResolvedAt: record.paymentDisputeResolvedAt,
		showPaymentWarning: paymentStatus === 'failed',
		showRefundNotice: paymentStatus === 'refunded',
		showDisputeNotice: paymentStatus === 'disputed',
		manageBillingAvailable: true,
	}
}
