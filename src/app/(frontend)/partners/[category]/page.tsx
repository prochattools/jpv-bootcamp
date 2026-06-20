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
		<main className="mx-auto max-w-5xl px-6 py-12">
			<Link href="/partners" className="text-sm text-muted-foreground underline">
				Back to all partners
			</Link>
			<h1 className="mt-4 text-3xl font-semibold">{category.name}</h1>
			{category.description ? (
				<p className="mt-2 text-muted-foreground">{category.description}</p>
			) : null}

			{partners.length === 0 ? (
				<p className="mt-6 text-sm text-muted-foreground">
					Partner listings for this category are being updated.
				</p>
			) : (
				<ul className="mt-6 space-y-3">
					{partners.map((partner) => (
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
			)}
		</main>
	)
}
