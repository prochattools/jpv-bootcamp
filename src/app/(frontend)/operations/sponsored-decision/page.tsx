type DecisionResult =
	| 'approved'
	| 'rejected'
	| 'expired'
	| 'invalid'
	| 'no_seats'
	| 'already_processed'
	| 'account_failed'

function getMessage(result: DecisionResult) {
	switch (result) {
		case 'approved':
			return 'Application approved. The sponsored month is now active.'
		case 'rejected':
			return 'Application rejected.'
		case 'no_seats':
			return 'No sponsored seats are available right now.'
		case 'account_failed':
			return 'Approved, but membership sync failed. Please check logs.'
		case 'already_processed':
			return 'This decision link has already been used.'
		case 'invalid':
			return 'This decision link is invalid.'
		case 'expired':
		default:
			return 'This decision link is expired or invalid.'
	}
}

export default async function SponsoredDecisionPage({
	searchParams,
}: {
	searchParams?: Promise<{ result?: string }>
}) {
	const params = await searchParams
	const raw = params?.result
	const result =
		raw === 'approved' ||
		raw === 'rejected' ||
		raw === 'already_processed' ||
		raw === 'no_seats' ||
		raw === 'invalid' ||
		raw === 'account_failed'
			? (raw as DecisionResult)
			: 'expired'

	return (
		<main className="mx-auto max-w-xl px-6 py-16 text-center">
			<h1 className="text-2xl font-semibold">Sponsored decision</h1>
			<p className="mt-4 text-sm text-neutral-600">{getMessage(result)}</p>
		</main>
	)
}
