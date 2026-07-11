import 'server-only'

import prisma from '@/libs/prisma'
import { normalizeEmail } from '@/lib/normalize-email'

export type BillingAccessState = 'available' | 'billing_hold' | 'inactive' | 'unknown'
export type BillingPaymentState =
	| 'failed'
	| 'action_required'
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
	billingCadence: string | null
	commitmentStatus: string | null
	commitmentStartAt: Date | null
	commitmentEndAt: Date | null
	cancellationRequestedAt: Date | null
	cancellationEffectiveAt: Date | null
	paymentGraceEndsAt: Date | null
	withinPaymentGrace: boolean
	restrictedPortalRequired: boolean
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

const BILLING_PAYMENT_STATES = new Set<BillingPaymentState>([
	'failed',
	'action_required',
	'paid',
	'refunded',
	'disputed',
	'dispute_won',
	'dispute_lost',
	'dispute_resolved',
])

function emptyBillingStatus(): BillingStatus {
	return {
		hasBillingAccount: false,
		hasActiveSubscription: false,
		planLabel: null,
		subscriptionStatus: null,
		billingAccessState: 'unknown',
		periodEndDate: null,
		cancelAtPeriodEnd: false,
		billingCadence: null,
		commitmentStatus: null,
		commitmentStartAt: null,
		commitmentEndAt: null,
		cancellationRequestedAt: null,
		cancellationEffectiveAt: null,
		paymentGraceEndsAt: null,
		withinPaymentGrace: false,
		restrictedPortalRequired: false,
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

function resolveBillingAccessState(params: {
	subscriptionStatus: string | null
	paymentStatus: BillingPaymentState | null
	withinPaymentGrace: boolean
}): BillingAccessState {
	const { subscriptionStatus, paymentStatus, withinPaymentGrace } = params
	if (subscriptionStatus === 'unpaid' || subscriptionStatus === 'canceled') {
		return 'billing_hold'
	}
	if (subscriptionStatus === 'past_due') {
		return withinPaymentGrace ? 'available' : 'billing_hold'
	}
	if (paymentStatus === 'failed' || paymentStatus === 'action_required') {
		return withinPaymentGrace ? 'available' : 'billing_hold'
	}
	if (subscriptionStatus === 'active' || subscriptionStatus === 'trialing') {
		return 'available'
	}
	if (subscriptionStatus) return 'inactive'
	return 'unknown'
}

export async function getBillingStatus(memberEmail: string): Promise<BillingStatus> {
	const normalizedEmail = normalizeEmail(memberEmail)
	if (!normalizedEmail) return emptyBillingStatus()

	const record = await prisma.customerProvisioning.findUnique({
		where: { normalizedEmail },
		select: {
			stripeCustomerId: true,
			currentPlan: true,
			subscriptionStatus: true,
			subscriptionCurrentPeriodEnd: true,
			subscriptionCancelAtPeriodEnd: true,
			billingCadence: true,
			commitmentStatus: true,
			commitmentStartAt: true,
			commitmentEndAt: true,
			cancellationRequestedAt: true,
			cancellationEffectiveAt: true,
			paymentGraceEndsAt: true,
			paymentStatus: true,
			paymentFailedAt: true,
			paymentRefundedAt: true,
			paymentDisputeStatus: true,
			paymentDisputedAt: true,
			paymentDisputeResolvedAt: true,
		},
	})

	if (!record || !record.stripeCustomerId) return emptyBillingStatus()

	const planLabel = record.currentPlan
		? record.currentPlan.charAt(0).toUpperCase() + record.currentPlan.slice(1)
		: null
	const paymentStatus =
		record.paymentStatus && BILLING_PAYMENT_STATES.has(record.paymentStatus as BillingPaymentState)
			? (record.paymentStatus as BillingPaymentState)
			: null
	const withinPaymentGrace = Boolean(
		record.paymentGraceEndsAt && record.paymentGraceEndsAt.getTime() >= Date.now(),
	)
	const billingAccessState = resolveBillingAccessState({
		subscriptionStatus: record.subscriptionStatus,
		paymentStatus,
		withinPaymentGrace,
	})
	const restrictedPortalRequired =
		record.billingCadence === 'monthly_commitment' &&
		(record.commitmentStatus === 'pending' ||
			record.commitmentStatus === 'active' ||
			record.commitmentStatus === 'cancellation_requested')

	return {
		hasBillingAccount: true,
		hasActiveSubscription: billingAccessState === 'available',
		planLabel,
		subscriptionStatus: record.subscriptionStatus,
		billingAccessState,
		periodEndDate: record.subscriptionCurrentPeriodEnd,
		cancelAtPeriodEnd: record.subscriptionCancelAtPeriodEnd ?? false,
		billingCadence: record.billingCadence,
		commitmentStatus: record.commitmentStatus,
		commitmentStartAt: record.commitmentStartAt,
		commitmentEndAt: record.commitmentEndAt,
		cancellationRequestedAt: record.cancellationRequestedAt,
		cancellationEffectiveAt: record.cancellationEffectiveAt,
		paymentGraceEndsAt: record.paymentGraceEndsAt,
		withinPaymentGrace,
		restrictedPortalRequired,
		paymentStatus,
		paymentFailedAt: record.paymentFailedAt,
		paymentRefundedAt: record.paymentRefundedAt,
		paymentDisputeStatus: record.paymentDisputeStatus,
		paymentDisputedAt: record.paymentDisputedAt,
		paymentDisputeResolvedAt: record.paymentDisputeResolvedAt,
		showPaymentWarning:
			paymentStatus === 'failed' ||
			paymentStatus === 'action_required' ||
			record.subscriptionStatus === 'past_due',
		showRefundNotice: paymentStatus === 'refunded',
		showDisputeNotice: paymentStatus === 'disputed',
		manageBillingAvailable: true,
	}
}
