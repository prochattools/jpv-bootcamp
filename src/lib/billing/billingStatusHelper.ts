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
			manageBillingAvailable: false,
		}
	}

	// Human-readable plan labels
	const planLabel = record.currentPlan
		? record.currentPlan.charAt(0).toUpperCase() + record.currentPlan.slice(1)
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
		manageBillingAvailable: true,
	}
}
