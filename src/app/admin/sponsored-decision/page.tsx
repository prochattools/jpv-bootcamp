type DecisionResult = 'approved' | 'rejected' | 'expired' | 'already_processed'

function getMessage(result: DecisionResult) {
	switch (result) {
		case 'approved':
			return 'Application approved. The sponsored month is now active.'
		case 'rejected':
			return 'Application rejected.'
		case 'already_processed':
			return 'This decision link has already been used.'
		case 'expired':
		default:
			return 'This decision link is expired or invalid.'
	}
}

export default function SponsoredDecisionPage({
	searchParams,
}: {
	searchParams?: { result?: string }
}) {
	const raw = searchParams?.result
	const result =
		raw === 'approved' || raw === 'rejected' || raw === 'already_processed'
			? (raw as DecisionResult)
			: 'expired'

	return (
		<main className="mx-auto max-w-xl px-6 py-16 text-center">
			<h1 className="text-2xl font-semibold">Sponsored decision</h1>
			<p className="mt-4 text-sm text-neutral-600">{getMessage(result)}</p>
		</main>
	)
}
