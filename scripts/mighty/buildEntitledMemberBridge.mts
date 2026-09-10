import prisma from '../../src/libs/prisma'
import { isStripeEntitled, summarizeStripeRoster, type StripeRosterRow } from '../../src/lib/mighty/stripeEntitlementSummary'

type BridgeRow = {
	email: string
	stripeCustomerId: string
	stripeSubscriptionId: string | null
	plan: string | null
}

function arg(name: string): string | null {
	const prefix = `--${name}=`
	const value = process.argv.find((candidate) => candidate.startsWith(prefix))
	return value ? value.slice(prefix.length) : null
}

function csv(value: string | null): string {
	return `"${(value ?? '').replace(/"/g, '""')}"`
}

async function main(): Promise<void> {
	const format = arg('format') ?? 'summary'
	if (!['summary', 'csv'].includes(format)) {
		throw new Error('format_must_be_summary_or_csv')
	}

	const rows = await prisma.customerProvisioning.findMany({
		where: { status: 'active' },
		select: {
			email: true,
			stripeCustomerId: true,
			stripeSubscriptionId: true,
			plan: true,
			status: true,
			subscriptionStatus: true,
			paymentStatus: true,
		},
		orderBy: { normalizedEmail: 'asc' },
	})
	const stripeSummary = summarizeStripeRoster(rows)
	const entitledRows = rows.filter((row) => isStripeEntitled(row as StripeRosterRow))

	const bridgeRows: BridgeRow[] = entitledRows.map((row) => ({
		email: row.email,
		stripeCustomerId: row.stripeCustomerId,
		stripeSubscriptionId: row.stripeSubscriptionId,
		plan: row.plan,
	}))

	if (format === 'csv') {
		console.log('email,stripe_customer_id,stripe_subscription_id,plan')
		for (const row of bridgeRows) {
			console.log([
				csv(row.email),
				csv(row.stripeCustomerId),
				csv(row.stripeSubscriptionId),
				csv(row.plan),
			].join(','))
		}
		return
	}

	console.log(JSON.stringify({
		readOnly: true,
		totalCandidateStripeSubscriptions: stripeSummary.totalCandidateStripeSubscriptions,
		entitledSubscriberCount: bridgeRows.length,
		ambiguousOrUnmatchedRecordCount: stripeSummary.ambiguousOrUnmatchedRecordCount,
		recordsRequiringManualReview: stripeSummary.recordsRequiringManualReview,
		missingStripeSubscriptionIdCount: stripeSummary.missingStripeSubscriptionIdCount,
		missingSubscriptionStatusCount: stripeSummary.missingSubscriptionStatusCount,
		output: 'Use --format=csv only when an operator explicitly needs a local, secure bridge roster. Do not commit or upload the output.',
	}, null, 2))
}

main()
	.catch((error) => {
		console.error(error instanceof Error ? error.message : 'unknown_error')
		process.exitCode = 1
	})
	.finally(async () => {
		await prisma.$disconnect()
	})
