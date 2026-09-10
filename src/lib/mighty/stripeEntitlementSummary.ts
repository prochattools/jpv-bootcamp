const BLOCKED_PAYMENT_STATUSES = new Set([
	'failed',
	'action_required',
	'disputed',
	'refunded',
	'dispute_lost',
])

export type StripeRosterRow = {
	status: string
	stripeSubscriptionId: string | null
	subscriptionStatus: string | null
	paymentStatus: string | null
}

export function isStripeEntitled(row: StripeRosterRow): boolean {
	return (
		row.status === 'active' &&
		(row.subscriptionStatus === 'active' || row.subscriptionStatus === 'trialing') &&
		(row.paymentStatus === null || !BLOCKED_PAYMENT_STATUSES.has(row.paymentStatus))
	)
}

export function summarizeStripeRoster(rows: StripeRosterRow[]) {
	const activeRows = rows.filter((row) => row.status === 'active')
	const entitledRows = activeRows.filter(isStripeEntitled)

	return {
		totalActiveProvisioningRecords: activeRows.length,
		totalCandidateStripeSubscriptions: activeRows.filter((row) => Boolean(row.stripeSubscriptionId?.trim())).length,
		entitledSubscriberCount: entitledRows.length,
		ambiguousOrUnmatchedRecordCount: activeRows.length - entitledRows.length,
		recordsRequiringManualReview: activeRows.filter((row) => !isStripeEntitled(row)).length,
		missingStripeSubscriptionIdCount: activeRows.filter((row) => !row.stripeSubscriptionId?.trim()).length,
		missingSubscriptionStatusCount: activeRows.filter((row) => !row.subscriptionStatus?.trim()).length,
	}
}
