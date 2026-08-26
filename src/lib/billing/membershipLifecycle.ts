export type MembershipLifecycleState =
	| 'pending'
	| 'active'
	| 'past_due'
	| 'cancelled'
	| 'expired'
	| 'suspended'
	| 'revoked'
	| 'unreconciled'

export type MembershipAccessDecision = {
	state: MembershipLifecycleState
	accessAllowed: boolean
	reason:
		| 'active_subscription'
		| 'payment_grace'
		| 'pending_activation'
		| 'payment_overdue'
		| 'cancelled_at_period_end'
		| 'subscription_ended'
		| 'subscription_paused'
		| 'payment_revoked'
		| 'missing_or_unknown_state'
}

export type MembershipPaymentState =
	| 'failed'
	| 'action_required'
	| 'paid'
	| 'refunded'
	| 'disputed'
	| 'dispute_won'
	| 'dispute_lost'
	| 'dispute_resolved'
	| null

export function resolveMembershipLifecycle(params: {
	hasBillingAccount: boolean
	subscriptionStatus: string | null
	paymentStatus: MembershipPaymentState
	withinPaymentGrace: boolean
	cancelAtPeriodEnd: boolean
}): MembershipAccessDecision {
	const {
		hasBillingAccount,
		subscriptionStatus,
		paymentStatus,
		withinPaymentGrace,
		cancelAtPeriodEnd,
	} = params

	if (!hasBillingAccount || !subscriptionStatus) {
		return {
			state: 'unreconciled',
			accessAllowed: false,
			reason: 'missing_or_unknown_state',
		}
	}

	if (paymentStatus === 'dispute_lost' || paymentStatus === 'refunded') {
		return { state: 'revoked', accessAllowed: false, reason: 'payment_revoked' }
	}

	if (subscriptionStatus === 'paused') {
		return { state: 'suspended', accessAllowed: false, reason: 'subscription_paused' }
	}

	if (subscriptionStatus === 'canceled') {
		return { state: 'cancelled', accessAllowed: false, reason: 'subscription_ended' }
	}

	if (subscriptionStatus === 'unpaid' || subscriptionStatus === 'incomplete_expired') {
		return { state: 'expired', accessAllowed: false, reason: 'subscription_ended' }
	}

	if (subscriptionStatus === 'incomplete') {
		return { state: 'pending', accessAllowed: false, reason: 'pending_activation' }
	}

	if (subscriptionStatus === 'trialing') {
		return { state: 'active', accessAllowed: true, reason: 'active_subscription' }
	}

	if (
		subscriptionStatus === 'past_due' ||
		paymentStatus === 'failed' ||
		paymentStatus === 'action_required'
	) {
		return withinPaymentGrace
			? { state: 'past_due', accessAllowed: true, reason: 'payment_grace' }
			: { state: 'past_due', accessAllowed: false, reason: 'payment_overdue' }
	}

	if (subscriptionStatus === 'active') {
		return cancelAtPeriodEnd
			? { state: 'cancelled', accessAllowed: true, reason: 'cancelled_at_period_end' }
			: { state: 'active', accessAllowed: true, reason: 'active_subscription' }
	}

	return {
		state: 'unreconciled',
		accessAllowed: false,
		reason: 'missing_or_unknown_state',
	}
}
