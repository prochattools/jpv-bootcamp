export type MightyDesiredAccess = 'ALLOWED' | 'DENIED'

const BLOCKED_PAYMENT_STATUSES = new Set([
	'failed',
	'action_required',
	'disputed',
	'refunded',
	'dispute_lost',
])

const ALLOWED_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing'])

export type StripeEntitlementInput = {
	recordStatus?: string | null
	subscriptionStatus?: string | null
	paymentStatus?: string | null
	eventType?: string | null
	checkoutPaymentStatus?: string | null
}

function normalized(value: string | null | undefined): string {
	return value?.trim().toLowerCase() ?? ''
}

/**
 * Single billing decision used by both Stripe event ingestion and roster
 * reconciliation. Mighty state never contributes to this decision.
 */
export function deriveMightyDesiredAccess(input: StripeEntitlementInput): MightyDesiredAccess {
	const eventType = normalized(input.eventType)
	if (eventType === 'invoice.payment_failed') return 'DENIED'
	if (eventType === 'customer.subscription.deleted') return 'DENIED'
	if (eventType === 'invoice.paid') return 'ALLOWED'

	const checkoutPaymentStatus = normalized(input.checkoutPaymentStatus)
	if (eventType.startsWith('checkout.session.') && ['paid', 'no_payment_required'].includes(checkoutPaymentStatus)) {
		return 'ALLOWED'
	}

	if (normalized(input.recordStatus) !== '' && normalized(input.recordStatus) !== 'active') return 'DENIED'
	if (BLOCKED_PAYMENT_STATUSES.has(normalized(input.paymentStatus))) return 'DENIED'
	return ALLOWED_SUBSCRIPTION_STATUSES.has(normalized(input.subscriptionStatus)) ? 'ALLOWED' : 'DENIED'
}

export function isBlockedPaymentStatus(value: string | null | undefined): boolean {
	return BLOCKED_PAYMENT_STATUSES.has(normalized(value))
}
