import SponsoredApplyForm from '@/components/sponsored-apply-form'
import { getSponsoredSeatCounts } from '@/lib/sponsored-seats'

export const dynamic = 'force-dynamic'

export default async function SponsoredApplyPage() {
	const counts = await getSponsoredSeatCounts()

	return (
		<main className="mx-auto max-w-3xl px-6 py-12">
			<h1 className="text-3xl font-semibold">Apply for a sponsored membership</h1>
			<p className="mt-3 text-sm text-neutral-600">
				Sponsored memberships are limited. Apply and we&apos;ll email you if
				approved.
			</p>
			<div className="mt-8">
				<SponsoredApplyForm initialCounts={counts} />
			</div>
		</main>
	)
}
