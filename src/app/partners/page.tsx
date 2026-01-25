import Link from 'next/link'
import {
	getPartnersByCategory,
	partnerCategories,
	partners,
} from '@/content/partners'

export const dynamic = 'force-dynamic'

export default function PartnersPage() {
	return (
		<main className="mx-auto max-w-5xl px-6 py-12">
			<div className="space-y-4">
				<h1 className="text-3xl font-semibold">Partners &amp; Deals</h1>
				<p className="text-muted-foreground">
					Member-only partners curated for each stage of the property journey.
				</p>
			</div>

			<section className="mt-10">
				<h2 className="text-xl font-semibold">Browse by category</h2>
				<div className="mt-4 grid gap-3 md:grid-cols-2">
					{partnerCategories.map((category) => (
						<Link
							key={category.slug}
							href={`/partners/${category.slug}`}
							className="rounded-lg border border-neutral-200 bg-white p-4 transition hover:border-neutral-300"
						>
							<div className="text-lg font-medium">{category.name}</div>
							{category.description ? (
								<p className="text-sm text-muted-foreground">
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
					<p className="mt-4 text-sm text-muted-foreground">
						Partner listings are being updated. Check back soon.
					</p>
				) : (
					<div className="mt-4 space-y-6">
						{partnerCategories.map((category) => {
							const categoryPartners = getPartnersByCategory(category.slug)
							if (categoryPartners.length === 0) return null
							return (
								<div key={category.slug} className="space-y-3">
									<h3 className="text-lg font-semibold">{category.name}</h3>
									<ul className="space-y-2">
										{categoryPartners.map((partner) => (
											<li
												key={partner.slug}
												className="rounded-md border border-neutral-200 p-4"
											>
												<div className="flex items-center justify-between gap-4">
													<div>
														<div className="font-medium">{partner.name}</div>
														<p className="text-sm text-muted-foreground">
															{partner.description}
														</p>
													</div>
													<Link
														href={`/out/${partner.slug}`}
														className="text-sm font-semibold text-neutral-900 underline"
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
