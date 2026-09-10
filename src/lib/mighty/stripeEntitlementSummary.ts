import { deriveMightyDesiredAccess } from './entitlement'

export type StripeRosterRow = {
	status: string
	stripeSubscriptionId: string | null
	subscriptionStatus: string | null
	paymentStatus: string | null
}

export function isStripeEntitled(row: StripeRosterRow): boolean {
	return deriveMightyDesiredAccess({
		recordStatus: row.status,
		subscriptionStatus: row.subscriptionStatus,
		paymentStatus: row.paymentStatus,
	}) === 'ALLOWED'
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
