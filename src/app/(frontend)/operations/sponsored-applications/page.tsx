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
	if (!session || !isSponsoredSeatsAdmin(session.accountId)) {
		notFound()
	}

	const [applications, counts] = await Promise.all([
		prisma.sponsoredApplication.findMany({
			where: { status: 'pending' },
			orderBy: { createdAt: 'desc' },
		}),
		getSponsoredSeatCounts(),
	])

	return (
		<main className="mx-auto max-w-5xl px-6 py-12">
			<h1 className="text-2xl font-semibold">Sponsored Applications</h1>
			<p className="mt-2 text-sm text-muted-foreground">
				Available pay-it-forward-funded membership places: {counts.available}
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
										Linked account ID: {application.accountId ?? 'N/A'}
									</p>
									<p className="text-xs text-muted-foreground">
										Requested access: Pay-it-forward-funded JPV Bootcamp Membership
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
										<input type="hidden" name="tier" value="pro" />
										<input
											type="text"
											name="note"
											placeholder="Decision note (optional)"
											className="rounded border border-neutral-300 px-2 py-1 text-sm"
										/>
										<button
											type="submit"
											className="min-h-11 rounded bg-neutral-900 px-3 py-2 text-sm font-semibold text-white"
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
											className="min-h-11 rounded border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-700"
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
