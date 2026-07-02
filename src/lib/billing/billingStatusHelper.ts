import 'server-only'

import prisma from '@/libs/prisma'
import { normalizeEmail } from '@/lib/normalize-email'

export type BillingStatus = {
	hasBillingAccount: boolean
	planLabel: string | null
	subscriptionStatus: string | null
	periodEndDate: Date | null
	cancelAtPeriodEnd: boolean
	manageBillingAvailable: boolean
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
		planLabel,
		subscriptionStatus: record.subscriptionStatus,
		periodEndDate: record.subscriptionCurrentPeriodEnd,
		cancelAtPeriodEnd: record.subscriptionCancelAtPeriodEnd ?? false,
		manageBillingAvailable: true,
	}
}
