import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import prisma from '@/libs/prisma'
import { Prisma } from '@prisma/client'
import {
	PARTNERS_SESSION_COOKIE,
	sanitizeSessionId,
	getPartnerSession,
} from '@/lib/partners-session'
import { partnerCategories } from '@/content/partners'

export const dynamic = 'force-dynamic'

type PageProps = {
	searchParams?: {
		wp_user_id?: string
		partner_slug?: string
	}
}

function parseAdminIds(raw: string | undefined): Set<number> {
	if (!raw) return new Set()
	return new Set(
		raw
			.split(',')
			.map((value) => Number(value.trim()))
			.filter((value) => Number.isInteger(value) && value > 0)
	)
}

function normalizeSlug(value: string | undefined): string | undefined {
	if (!value) return undefined
	const trimmed = value.trim().toLowerCase()
	if (!trimmed) return undefined
	return trimmed
}

export default async function PartnersClicksAdminPage({
	searchParams,
}: PageProps) {
	const sessionCookie = cookies().get(PARTNERS_SESSION_COOKIE)?.value
	const sessionId = sanitizeSessionId(sessionCookie)
	if (!sessionId) {
		notFound()
	}

	const session = await getPartnerSession(sessionId)
	if (!session) {
		notFound()
	}

	const adminIds = parseAdminIds(process.env.PARTNERS_ADMIN_WP_USER_IDS)
	if (!adminIds.has(session.wpUserId)) {
		notFound()
	}

	const wpUserIdFilter = Number(searchParams?.wp_user_id)
	const partnerSlugFilter = normalizeSlug(searchParams?.partner_slug)

	const filters: Prisma.PartnerClickWhereInput = {}

	if (Number.isInteger(wpUserIdFilter) && wpUserIdFilter > 0) {
		filters.wpUserId = wpUserIdFilter
	}
	if (partnerSlugFilter) {
		filters.partnerSlug = partnerSlugFilter
	}

	const whereParts: Prisma.Sql[] = []
	if (filters.wpUserId) {
		whereParts.push(Prisma.sql`wp_user_id = ${filters.wpUserId}`)
	}
	if (filters.partnerSlug) {
		whereParts.push(Prisma.sql`partner_slug = ${filters.partnerSlug}`)
	}
	const whereSql =
		whereParts.length > 0
			? Prisma.sql`WHERE ${Prisma.join(whereParts, ' AND ')}`
			: Prisma.empty

	const [partnerTotals, categoryTotals, recentClicks] = await Promise.all([
		prisma.$queryRaw<{ partner_slug: string; count: number }[]>(Prisma.sql`
			SELECT partner_slug, COUNT(*)::int AS count
			FROM jpvbootcamp.partner_clicks
			${whereSql}
			GROUP BY partner_slug
			ORDER BY count DESC
		`),
		prisma.$queryRaw<{ category_slug: string; count: number }[]>(Prisma.sql`
			SELECT category_slug, COUNT(*)::int AS count
			FROM jpvbootcamp.partner_clicks
			${whereSql}
			GROUP BY category_slug
			ORDER BY count DESC
		`),
		prisma.partnerClick.findMany({
			where: filters,
			orderBy: { createdAt: 'desc' },
			take: 100,
		}),
	])

	const categoryNameBySlug = new Map(
		partnerCategories.map((category) => [category.slug, category.name])
	)

	return (
		<main className="mx-auto max-w-5xl px-6 py-12">
			<h1 className="text-2xl font-semibold">Partners Clicks</h1>
			<p className="mt-2 text-sm text-muted-foreground">
				Showing {recentClicks.length} recent clicks.
			</p>

			<section className="mt-8 grid gap-8 md:grid-cols-2">
				<div>
					<h2 className="text-lg font-semibold">Clicks by partner</h2>
					<ul className="mt-3 space-y-2 text-sm">
						{partnerTotals.map((item) => (
							<li key={item.partner_slug} className="flex justify-between">
								<span>{item.partner_slug}</span>
								<span>{item.count}</span>
							</li>
						))}
					</ul>
				</div>
				<div>
					<h2 className="text-lg font-semibold">Clicks by category</h2>
					<ul className="mt-3 space-y-2 text-sm">
						{categoryTotals.map((item) => (
							<li key={item.category_slug} className="flex justify-between">
								<span>
									{categoryNameBySlug.get(item.category_slug) ??
										item.category_slug}
								</span>
								<span>{item.count}</span>
							</li>
						))}
					</ul>
				</div>
			</section>

			<section className="mt-10">
				<h2 className="text-lg font-semibold">Recent clicks</h2>
				<div className="mt-4 overflow-x-auto rounded-lg border border-neutral-200">
					<table className="w-full text-sm">
						<thead className="bg-neutral-50 text-left">
							<tr>
								<th className="px-3 py-2">Time</th>
								<th className="px-3 py-2">WP User</th>
								<th className="px-3 py-2">Partner</th>
								<th className="px-3 py-2">Category</th>
								<th className="px-3 py-2">Ref path</th>
							</tr>
						</thead>
						<tbody>
							{recentClicks.map((click) => (
								<tr key={click.id} className="border-t">
									<td className="px-3 py-2">
										{click.createdAt.toISOString()}
									</td>
									<td className="px-3 py-2">{click.wpUserId}</td>
									<td className="px-3 py-2">{click.partnerSlug}</td>
									<td className="px-3 py-2">{click.categorySlug}</td>
									<td className="px-3 py-2">{click.refPath ?? '-'}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</section>
		</main>
	)
}
