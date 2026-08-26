import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
	getPartnersByCategory,
	isPartnerCategory,
	partnerCategories,
} from '@/content/partners'

export const dynamic = 'force-dynamic'

type PageProps = {
	params: Promise<{ category: string }>
}

export default async function PartnersCategoryPage({ params }: PageProps) {
	const { category: categorySlug } = await params
	if (!isPartnerCategory(categorySlug)) {
		notFound()
	}
	const category = partnerCategories.find((item) => item.slug === categorySlug)
	if (!category) {
		notFound()
	}

	const partners = getPartnersByCategory(categorySlug)

	return (
		<main className="mx-auto max-w-5xl bg-jpv-canvas px-6 py-12 text-jpv-ink">
			<Link
				href="/partners"
				className="inline-flex items-center gap-1 text-sm text-jpv-muted underline underline-offset-2 hover:text-jpv-ink"
			>
				<span aria-hidden="true">&larr;</span> All partners
			</Link>
			<h1 className="mt-4 text-3xl font-semibold">{category.name}</h1>
			{category.description ? (
				<p className="mt-2 text-jpv-muted">{category.description}</p>
			) : null}

			{partners.length === 0 ? (
				<p className="mt-8 text-sm text-jpv-muted">
					No partners listed in this category yet. Check back soon.
				</p>
			) : (
				<ul className="mt-6 space-y-3">
					{partners.map((partner) => (
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
			)}
		</main>
	)
}
