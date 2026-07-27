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
	if (!sessionId) notFound()

	const session = await getPartnerSession(sessionId)
	if (!session || !isSponsoredSeatsAdmin(session.accountId)) notFound()

	const [applications, counts] = await Promise.all([
		prisma.sponsoredApplication.findMany({
			where: { status: 'pending' },
			orderBy: { createdAt: 'desc' },
		}),
		getSponsoredSeatCounts(),
	])

	return (
		<main className='mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6'>
			<section className='space-y-2'>
				<p className='jpv-eyebrow'>Sponsored seats · Operator</p>
				<h1 className='text-2xl font-semibold tracking-tight text-jpv-ink'>Sponsored applications</h1>
				<p className='text-sm text-jpv-muted'>
					Available pay-it-forward-funded membership places:{' '}
					<strong className='text-jpv-ink'>{counts.available}</strong>
				</p>
			</section>

			<section className='space-y-5'>
				{applications.length === 0 ? (
					<div className='rounded-jpv-panel border border-dashed border-jpv-border bg-jpv-canvas p-6 text-sm text-jpv-muted sm:p-8'>
						No pending applications.
					</div>
				) : (
					applications.map((application) => (
						<article
							key={application.id}
							className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-5 sm:p-6'
						>
							<div className='flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between'>
								<div className='min-w-0 space-y-1'>
									<p className='text-base font-semibold text-jpv-ink'>{application.name}</p>
									<p className='text-xs text-jpv-muted'>Email: {application.email ?? 'unknown'}</p>
									<p className='text-xs text-jpv-muted'>Phone: {formatPhoneForDisplay(application.phone)}</p>
									<p className='text-xs text-jpv-muted'>Account ID: {application.accountId ?? 'N/A'}</p>
									<p className='text-xs text-jpv-muted'>Access: Pay-it-forward-funded JPV Bootcamp Membership</p>
									<p className='text-xs text-jpv-muted'>Submitted: {application.createdAt.toISOString()}</p>
									{application.message ? (
										<p className='jpv-notice mt-3 text-sm'>{application.message}</p>
									) : null}
								</div>

								<div className='flex shrink-0 flex-col gap-3'>
									<form
										action={`/api/admin/sponsored-applications/${application.id}/approve`}
										className='flex flex-col gap-2'
										method='post'
									>
										<input name='tier' type='hidden' value='pro' />
										<label htmlFor={`note-approve-${application.id}`} className='sr-only'>Decision note</label>
										<input
											id={`note-approve-${application.id}`}
											aria-label='Decision note (optional)'
											className='min-h-11 w-full rounded-jpv-control border border-jpv-border px-3 py-2 text-sm text-jpv-ink placeholder:text-jpv-muted'
											name='note'
											placeholder='Decision note (optional)'
											type='text'
										/>
										<button className='jpv-button-primary min-h-11' type='submit'>
											Approve
										</button>
									</form>
									<form
										action={`/api/admin/sponsored-applications/${application.id}/reject`}
										method='post'
									>
										<input name='note' type='hidden' value='Not approved' />
										<button
											className='min-h-11 w-full rounded-jpv-action border border-jpv-danger px-3 py-2 text-sm font-semibold text-jpv-danger hover:bg-jpv-danger-surface'
											type='submit'
										>
											Reject
										</button>
									</form>
								</div>
							</div>
						</article>
					))
				)}
			</section>
		</main>
	)
}
