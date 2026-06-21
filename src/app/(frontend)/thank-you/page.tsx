import { Suspense } from 'react'
import ThankYouClient from './ThankYouClient'

export const metadata = {
	title: "Thanks - you're in | JPV Bootcamp",
	description: 'Payment received. Check your inbox for login instructions.',
}

export default function ThankYouPage() {
	return (
		<main className="bg-jpv-gradient min-h-screen text-jpv-gray-50">
			<section className="px-6 py-24 sm:py-28">
				<div className="mx-auto max-w-3xl">
					<div className="rounded-3xl border border-jpv-gray-700/50 bg-jpv-bg-dark/60 p-8 shadow-jpv-card backdrop-blur">
						<div className="space-y-4">
							<p className="text-sm uppercase tracking-[0.4rem] text-jpv-green/80">
								Payment received
							</p>
							<h1 className="text-3xl font-semibold text-white sm:text-4xl">
								Thanks - you're in.
							</h1>
							<p className="text-base text-jpv-gray-300">
								You'll get an email shortly with login instructions. If you don't see it
								within 5 minutes, check spam or contact support.
							</p>
						</div>
						<div className="mt-6">
							<Suspense
								fallback={
									<p className="text-sm text-jpv-gray-300">
										Redirecting to the home page...
									</p>
								}
							>
								<ThankYouClient />
							</Suspense>
						</div>
					</div>
				</div>
			</section>
		</main>
	)
}
