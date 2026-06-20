import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import prisma from '@/libs/prisma'
import {
	getPartnerSession,
	sanitizeSessionId,
} from '@/lib/partners-session'
import { isSponsoredSeatsAdmin } from '@/lib/sponsored-admin'
import {
	getSponsoredSeatCounts,
	getSponsoredPriceId,
} from '@/lib/sponsored-seats'
import { formatPhoneForDisplay } from '@/lib/normalize-phone'

export const dynamic = 'force-dynamic'

export default async function SponsoredApplicationsAdminPage() {
	const sessionCookie = (await cookies()).get('partners_session')?.value
	const sessionId = sanitizeSessionId(sessionCookie)
	if (!sessionId) {
		notFound()
	}

	const session = await getPartnerSession(sessionId)
	if (!session || !isSponsoredSeatsAdmin(session.wpUserId)) {
		notFound()
	}

	const [applications, counts] = await Promise.all([
		prisma.sponsoredApplication.findMany({
			where: { status: 'pending' },
			orderBy: { createdAt: 'desc' },
		}),
		getSponsoredSeatCounts(),
	])

	const hasVip = Boolean(getSponsoredPriceId('vip'))

	return (
		<main className="mx-auto max-w-5xl px-6 py-12">
			<h1 className="text-2xl font-semibold">Sponsored Applications</h1>
			<p className="mt-2 text-sm text-muted-foreground">
				Available seats: {counts.pro} Pro / {counts.vip} VIP
			</p>

			<div className="mt-8 space-y-6">
				{applications.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						No pending applications.
					</p>
				) : (
					applications.map((application) => (
						<div
							key={application.id}
							className="rounded-lg border border-neutral-200 p-4"
						>
							<div className="flex flex-wrap items-start justify-between gap-4">
								<div>
									<div className="text-lg font-semibold">{application.name}</div>
									<p className="text-xs text-muted-foreground">
										Email: {application.email ?? 'unknown'}
									</p>
									<p className="text-xs text-muted-foreground">
										Phone: {formatPhoneForDisplay(application.phone)}
									</p>
									<p className="text-xs text-muted-foreground">
										WP User ID: {application.wpUserId ?? 'N/A'}
									</p>
									<p className="text-xs text-muted-foreground">
										Requested tier: {application.tier}
									</p>
									<p className="text-xs text-muted-foreground">
										Submitted: {application.createdAt.toISOString()}
									</p>
									{application.message ? (
										<p className="mt-2 text-sm text-neutral-700">
											{application.message}
										</p>
									) : null}
								</div>
								<div className="flex flex-col gap-2">
									<form
										action={`/api/admin/sponsored-applications/${application.id}/approve`}
										method="post"
										className="flex flex-col gap-2"
									>
										{hasVip ? (
											<select
												name="tier"
												className="rounded border border-neutral-300 px-2 py-1 text-sm"
												defaultValue="pro"
											>
												<option value="pro">Approve Pro</option>
												<option value="vip">Approve VIP</option>
											</select>
										) : (
											<input type="hidden" name="tier" value="pro" />
										)}
										<input
											type="text"
											name="note"
											placeholder="Decision note (optional)"
											className="rounded border border-neutral-300 px-2 py-1 text-sm"
										/>
										<button
											type="submit"
											className="rounded bg-neutral-900 px-3 py-2 text-sm font-semibold text-white"
										>
											Approve
										</button>
									</form>
									<form
										action={`/api/admin/sponsored-applications/${application.id}/reject`}
										method="post"
									>
										<input type="hidden" name="note" value="Not approved" />
										<button
											type="submit"
											className="rounded border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-700"
										>
											Reject
										</button>
									</form>
								</div>
							</div>
						</div>
					))
				)}
			</div>
		</main>
	)
}
