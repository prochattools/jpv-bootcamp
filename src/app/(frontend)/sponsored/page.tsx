import SponsoredApplyForm from '@/components/sponsored-apply-form'
import { getSponsoredSeatCounts } from '@/lib/sponsored-seats'
import { ArrowLeft, Check } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function SponsoredApplyPage() {
	let counts = { available: 0 }
	try {
		counts = await getSponsoredSeatCounts()
	} catch (error) {
		console.error('sponsored_counts_failed', error)
	}

	return (
		<main className="min-h-[100dvh] bg-jpv-canvas text-jpv-ink">
			<section className="px-5 py-6 sm:py-8 md:px-8 lg:py-10">
				<div className="mx-auto w-full max-w-[72rem]">
					<a
						className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-jpv-brand-deep transition-colors hover:text-jpv-brand"
						href="/"
					>
						<ArrowLeft aria-hidden="true" size={17} />
						Back to JPV Bootcamp
					</a>

					<div className="mt-6 overflow-hidden rounded-jpv-panel border border-jpv-border shadow-jpv-card lg:grid lg:grid-cols-[0.82fr_1.18fr]">
						<div className="relative flex flex-col justify-between overflow-hidden bg-jpv-brand-deep px-6 py-10 text-jpv-canvas sm:px-10 sm:py-12 lg:px-12 lg:py-16">
							<div aria-hidden="true" className="absolute -right-16 -top-16 h-56 w-56 rounded-full border border-jpv-canvas/10" />
							<div className="relative">
								<p className="text-xs font-bold uppercase tracking-[0.14em] text-jpv-sunshine">Sponsored access</p>
								<h1 className="jpv-editorial-heading mt-5 max-w-[12ch] text-4xl leading-[1.05] text-jpv-canvas sm:text-5xl">
									Apply for a sponsored membership.
								</h1>
								<p className="mt-6 max-w-md text-base leading-7 text-jpv-canvas/80">
									Pay-it-forward-funded JPV Bootcamp Membership places are limited. Apply and we&apos;ll email you if approved.
								</p>
							</div>

							<ul className="relative mt-10 space-y-3 text-sm text-jpv-canvas/85" aria-label="Application process">
								<li className="flex items-center gap-3"><Check aria-hidden="true" className="text-jpv-sunshine" size={17} />Complete the short application</li>
								<li className="flex items-center gap-3"><Check aria-hidden="true" className="text-jpv-sunshine" size={17} />We review and call you to discuss your request</li>
								<li className="flex items-center gap-3"><Check aria-hidden="true" className="text-jpv-sunshine" size={17} />You&apos;ll receive an email if approved</li>
							</ul>
						</div>

						<div className="bg-jpv-canvas px-6 py-10 sm:px-10 sm:py-12 lg:px-12 lg:py-16">
							<p className="jpv-eyebrow">Application</p>
							<h2 className="jpv-editorial-heading mt-3 text-3xl text-jpv-ink">Tell us about yourself.</h2>
							<p className="mt-3 max-w-xl text-sm leading-6 text-jpv-muted">Complete the details below so your application can be reviewed.</p>
							<div className="mt-8">
								<SponsoredApplyForm initialCounts={counts} />
							</div>
						</div>
					</div>
				</div>
			</section>
		</main>
	)
}
