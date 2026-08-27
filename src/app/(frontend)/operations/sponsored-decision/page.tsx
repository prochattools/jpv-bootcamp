type DecisionResult =
	| 'checkout_sent'
	| 'rejected'
	| 'expired'
	| 'invalid'
	| 'no_seats'
	| 'already_processed'
	| 'account_failed'

function getMessage(result: DecisionResult): { text: string; tone: 'success' | 'danger' | 'neutral' } {
	switch (result) {
		case 'checkout_sent':
			return { text: 'Application approved. A standard Stripe membership checkout has been sent; the sponsored month starts after checkout is completed.', tone: 'success' }
		case 'rejected':
			return { text: 'Application rejected.', tone: 'neutral' }
		case 'no_seats':
			return { text: 'No sponsored seats are available right now.', tone: 'danger' }
		case 'account_failed':
			return { text: 'Approved, but membership sync failed. Please check logs.', tone: 'danger' }
		case 'already_processed':
			return { text: 'This decision link has already been used.', tone: 'neutral' }
		case 'invalid':
			return { text: 'This decision link is invalid.', tone: 'danger' }
		case 'expired':
		default:
			return { text: 'This decision link is expired or invalid.', tone: 'danger' }
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
		raw === 'checkout_sent' ||
		raw === 'rejected' ||
		raw === 'already_processed' ||
		raw === 'no_seats' ||
		raw === 'invalid' ||
		raw === 'account_failed'
			? (raw as DecisionResult)
			: 'expired'

	const message = getMessage(result)

	const noticeClass =
		message.tone === 'success'
			? 'jpv-notice border-jpv-green/20 bg-emerald-50 text-emerald-800'
			: message.tone === 'danger'
				? 'jpv-notice jpv-notice-danger'
				: 'jpv-notice'

	return (
		<main className='mx-auto max-w-xl px-4 py-16 text-center sm:px-6'>
			<p className='jpv-eyebrow'>Sponsored seats</p>
			<h1 className='mt-3 text-2xl font-semibold tracking-tight text-jpv-ink'>Sponsored decision</h1>
			<p className={`mt-6 ${noticeClass}`}>{message.text}</p>
		</main>
	)
}
