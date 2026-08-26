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
import { ResponsiveDataTable } from '@/components/operations/ResponsiveDataTable'

export const dynamic = 'force-dynamic'

type PageProps = {
	searchParams?: Promise<{
		account_id?: string
		partner_slug?: string
	}>
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

export default async function PartnersClicksAdminPage({ searchParams }: PageProps) {
	const [cookieStore, resolvedSearchParams] = await Promise.all([
		cookies(),
		searchParams,
	])
	const sessionCookie = cookieStore.get(PARTNERS_SESSION_COOKIE)?.value
	const sessionId = sanitizeSessionId(sessionCookie)
	if (!sessionId) notFound()

	const session = await getPartnerSession(sessionId)
	if (!session) notFound()

	const adminIds = parseAdminIds(process.env.PARTNERS_ADMIN_ACCOUNT_IDS)
	if (!adminIds.has(session.accountId)) notFound()

	const accountIdFilter = Number(resolvedSearchParams?.account_id)
	const partnerSlugFilter = normalizeSlug(resolvedSearchParams?.partner_slug)

	const filters: Prisma.PartnerClickWhereInput = {}

	if (Number.isInteger(accountIdFilter) && accountIdFilter > 0) {
		filters.accountId = accountIdFilter
	}
	if (partnerSlugFilter) {
		filters.partnerSlug = partnerSlugFilter
	}

	const whereParts: Prisma.Sql[] = []
	if (filters.accountId) {
		whereParts.push(Prisma.sql`account_id = ${filters.accountId}`)
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
		<main className='mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6'>
			<section className='space-y-2'>
				<p className='jpv-eyebrow'>Partners · Operator</p>
				<h1 className='text-2xl font-semibold tracking-tight text-jpv-ink'>Partner clicks</h1>
				<p className='text-sm text-jpv-muted'>
					Showing {recentClicks.length} most recent click{recentClicks.length !== 1 ? 's' : ''}.
				</p>
			</section>

			<section className='grid gap-6 md:grid-cols-2'>
				<div className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-5 sm:p-6'>
					<h2 className='font-semibold text-jpv-ink'>Clicks by partner</h2>
					{partnerTotals.length > 0 ? (
						<ul className='mt-4 divide-y divide-jpv-border text-sm'>
							{partnerTotals.map((item) => (
								<li key={item.partner_slug} className='flex justify-between py-2'>
									<span className='text-jpv-ink'>{item.partner_slug}</span>
									<span className='font-semibold tabular-nums text-jpv-ink'>{item.count}</span>
								</li>
							))}
						</ul>
					) : (
						<p className='mt-3 text-sm text-jpv-muted'>No data.</p>
					)}
				</div>

				<div className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-5 sm:p-6'>
					<h2 className='font-semibold text-jpv-ink'>Clicks by category</h2>
					{categoryTotals.length > 0 ? (
						<ul className='mt-4 divide-y divide-jpv-border text-sm'>
							{categoryTotals.map((item) => (
								<li key={item.category_slug} className='flex justify-between py-2'>
									<span className='text-jpv-ink'>
										{categoryNameBySlug.get(item.category_slug) ?? item.category_slug}
									</span>
									<span className='font-semibold tabular-nums text-jpv-ink'>{item.count}</span>
								</li>
							))}
						</ul>
					) : (
						<p className='mt-3 text-sm text-jpv-muted'>No data.</p>
					)}
				</div>
			</section>

			<section>
				<h2 className='font-semibold text-jpv-ink'>Recent clicks</h2>
				<div className='mt-4 rounded-jpv-panel border border-jpv-border bg-jpv-canvas'>
					<ResponsiveDataTable label='Recent partner clicks'>
						<table className='w-full text-sm'>
						<thead className='bg-jpv-surface text-left'>
							<tr>
								<th className='px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-jpv-muted'>Time</th>
								<th className='px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-jpv-muted'>Account</th>
								<th className='px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-jpv-muted'>Partner</th>
								<th className='px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-jpv-muted'>Category</th>
								<th className='px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-jpv-muted'>Ref path</th>
							</tr>
						</thead>
						<tbody>
							{recentClicks.length > 0 ? (
								recentClicks.map((click) => (
									<tr key={click.id} className='border-t border-jpv-border'>
										<td className='px-4 py-2.5 font-mono text-xs text-jpv-muted'>{click.createdAt.toISOString()}</td>
										<td className='px-4 py-2.5 tabular-nums text-jpv-ink'>{click.accountId}</td>
										<td className='px-4 py-2.5 text-jpv-ink'>{click.partnerSlug}</td>
										<td className='px-4 py-2.5 text-jpv-ink'>{click.categorySlug}</td>
										<td className='max-w-[14rem] truncate px-4 py-2.5 text-jpv-muted'>{click.refPath ?? '—'}</td>
									</tr>
								))
							) : (
								<tr>
									<td className='px-4 py-6 text-center text-sm text-jpv-muted' colSpan={5}>No recent clicks.</td>
								</tr>
							)}
						</tbody>
						</table>
					</ResponsiveDataTable>
				</div>
			</section>
		</main>
	)
}
