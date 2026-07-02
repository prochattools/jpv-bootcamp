import 'server-only'

import prisma from '@/libs/prisma'
import { normalizeEmail } from '@/lib/normalize-email'

export type BillingStatus = {
	hasBillingAccount: boolean
	hasActiveSubscription: boolean
	planLabel: string | null
	subscriptionStatus: string | null
	periodEndDate: Date | null
	cancelAtPeriodEnd: boolean
	paymentStatus: 'failed' | 'paid' | null
	paymentFailedAt: Date | null
	showPaymentWarning: boolean
	manageBillingAvailable: boolean
}

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing', 'past_due', 'unpaid'])

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
			periodEndDate: null,
			cancelAtPeriodEnd: false,
			paymentStatus: null,
			paymentFailedAt: null,
			showPaymentWarning: false,
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
		},
	})

	if (!record || !record.stripeCustomerId) {
		return {
			hasBillingAccount: false,
			hasActiveSubscription: false,
			planLabel: null,
			subscriptionStatus: null,
			periodEndDate: null,
			cancelAtPeriodEnd: false,
			paymentStatus: null,
			paymentFailedAt: null,
			showPaymentWarning: false,
			manageBillingAvailable: false,
		}
	}

	// Human-readable plan labels
	const planLabel = record.currentPlan
		? record.currentPlan.charAt(0).toUpperCase() + record.currentPlan.slice(1)
		: null

	const paymentStatus =
		record.paymentStatus === 'failed' || record.paymentStatus === 'paid'
			? record.paymentStatus
			: null

	return {
		hasBillingAccount: true,
		hasActiveSubscription: Boolean(
			record.subscriptionStatus && ACTIVE_SUBSCRIPTION_STATUSES.has(record.subscriptionStatus),
		),
		planLabel,
		subscriptionStatus: record.subscriptionStatus,
		periodEndDate: record.subscriptionCurrentPeriodEnd,
		cancelAtPeriodEnd: record.subscriptionCancelAtPeriodEnd ?? false,
		paymentStatus,
		paymentFailedAt: record.paymentFailedAt,
		showPaymentWarning: paymentStatus === 'failed',
		manageBillingAvailable: true,
	}
}
