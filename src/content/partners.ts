export type PartnerCategory = {
	slug: string
	name: string
	description?: string
}

export type PartnerEntry = {
	slug: string
	name: string
	category: string
	description: string
	affiliate_url: string
	tags?: string[]
	region?: string
}

export const partnerCategories: PartnerCategory[] = [
	{
		slug: 'finding-a-property',
		name: 'Finding a Property',
	},
	{
		slug: 'funding-the-deal',
		name: 'Funding the Deal',
	},
	{
		slug: 'legal-paperwork',
		name: 'Legal & Paperwork',
	},
	{
		slug: 'renovation-repairs',
		name: 'Renovation & Repairs',
	},
	{
		slug: 'letting-managing',
		name: 'Letting & Managing',
	},
	{
		slug: 'first-deal-complete',
		name: 'First Deal Complete',
	},
]

export const partners: PartnerEntry[] = []

export function getPartnerBySlug(slug: string): PartnerEntry | null {
	const normalized = slug.trim().toLowerCase()
	return partners.find((partner) => partner.slug === normalized) ?? null
}

export function getPartnersByCategory(categorySlug: string): PartnerEntry[] {
	return partners.filter((partner) => partner.category === categorySlug)
}

export function isPartnerCategory(slug: string): boolean {
	return partnerCategories.some((category) => category.slug === slug)
}
