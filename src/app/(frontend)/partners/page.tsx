import Link from 'next/link'
import {
	getPartnersByCategory,
	partnerCategories,
	partners,
} from '@/content/partners'

export const dynamic = 'force-dynamic'

export default function PartnersPage() {
	return (
		<main className="mx-auto max-w-5xl bg-jpv-canvas px-6 py-12 text-jpv-ink">
			<div className="space-y-3">
				<h1 className="text-3xl font-semibold">Partners &amp; Deals</h1>
				<p className="text-jpv-muted">
					Member-only partners curated for each stage of the property journey.
				</p>
			</div>

			<section className="mt-10">
				<h2 className="text-xl font-semibold">Browse by category</h2>
				<div className="mt-4 grid gap-3 sm:grid-cols-2">
					{partnerCategories.map((category) => (
						<Link
							key={category.slug}
							href={`/partners/${category.slug}`}
							className="block rounded-jpv-card border border-jpv-border bg-jpv-canvas p-4 text-jpv-ink transition-colors hover:border-jpv-brand hover:bg-jpv-surface"
						>
							<div className="text-base font-semibold text-jpv-ink">
								{category.name}
							</div>
							{category.description ? (
								<p className="mt-1 text-sm text-jpv-muted">
									{category.description}
								</p>
							) : null}
						</Link>
					))}
				</div>
			</section>

			<section className="mt-12">
				<h2 className="text-xl font-semibold">All partners</h2>
				{partners.length === 0 ? (
					<p className="mt-4 text-sm text-jpv-muted">
						Partner listings are being updated. Check back soon.
					</p>
				) : (
					<div className="mt-4 space-y-6">
						{partnerCategories.map((category) => {
							const categoryPartners = getPartnersByCategory(category.slug)
							if (categoryPartners.length === 0) return null
							return (
								<div key={category.slug} className="space-y-3">
									<h3 className="text-base font-semibold text-jpv-ink">
										{category.name}
									</h3>
									<ul className="space-y-2">
										{categoryPartners.map((partner) => (
											<li
												key={partner.slug}
												className="rounded-jpv-card border border-jpv-border p-4"
											>
												<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
													<div className="min-w-0">
														<div className="font-medium">{partner.name}</div>
														<p className="text-sm text-jpv-muted">
															{partner.description}
														</p>
													</div>
													<Link
														href={`/out/${partner.slug}`}
														className="inline-flex shrink-0 items-center text-sm font-semibold text-jpv-brand-deep underline underline-offset-2 hover:text-jpv-brand"
													>
														View partner
													</Link>
												</div>
											</li>
										))}
									</ul>
								</div>
							)
						})}
					</div>
				)}
			</section>
		</main>
	)
}
