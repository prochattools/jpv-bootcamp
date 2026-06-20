import { getStripe } from '@/lib/stripe'
import { isSponsoredSeatSession } from '@/lib/sponsored-seats'

export const dynamic = 'force-dynamic'

type PageProps = {
	searchParams?: Promise<{ session_id?: string }>
}

export default async function SponsoredThankYouPage({ searchParams }: PageProps) {
	const params = await searchParams
	const sessionId = (params?.session_id ?? '').trim()
	let tierLabel: string | null = null

	if (sessionId) {
		try {
			const stripe = getStripe()
			const session = await stripe.checkout.sessions.retrieve(sessionId)
			const tier = isSponsoredSeatSession(session)
			if (tier) {
				tierLabel = tier === 'vip' ? 'VIP' : 'Pro'
			}
		} catch {
			tierLabel = null
		}
	}

	const heading = tierLabel
		? `Thanks for sponsoring a ${tierLabel} month.`
		: 'Thanks for your support.'

	return (
		<main className="bg-jpv-gradient min-h-screen text-jpv-gray-50">
			<section className="px-6 py-24 sm:py-28">
				<div className="mx-auto max-w-3xl">
					<div className="rounded-3xl border border-jpv-gray-700/50 bg-jpv-bg-dark/60 p-8 shadow-jpv-card backdrop-blur">
						<div className="space-y-4">
							<p className="text-sm uppercase tracking-[0.4rem] text-jpv-green/80">
								Sponsored seat confirmed
							</p>
							<h1 className="text-3xl font-semibold text-white sm:text-4xl">
								{heading}
							</h1>
							<p className="text-base text-jpv-gray-300">
								Your purchase added a sponsored seat. You won&apos;t receive access
								yourself, but someone else will benefit from your generosity.
							</p>
						</div>
						<div className="mt-6">
							<a
								href="/"
								className="inline-flex items-center justify-center rounded-full border border-jpv-gray-600 px-6 py-2 text-sm font-semibold text-jpv-gray-100 transition hover:border-jpv-green hover:text-white"
							>
								Back to home
							</a>
						</div>
					</div>
				</div>
			</section>
		</main>
	)
}
