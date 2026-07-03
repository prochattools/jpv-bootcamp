import Link from 'next/link'

import { requirePortalMember } from '@/lib/auth/requirePortalMember'
import { getAffiliateSummary } from '@/lib/payloadCourse/affiliateReporting'
import { listActivePartners, listMemberApplications } from '@/lib/payloadCourse/partnerApplications'

export const dynamic = 'force-dynamic'

export default async function PortalPartnersPage(): Promise<JSX.Element> {
  const { memberId, payload } = await requirePortalMember('/portal/partners')
  const [partners, applications] = await Promise.all([
    listActivePartners(payload as never),
    listMemberApplications(payload as never, memberId),
  ])
  let affiliateSummary = null as Awaited<ReturnType<typeof getAffiliateSummary>> | null
  try {
    affiliateSummary = await getAffiliateSummary(payload as never, memberId)
  } catch {
    affiliateSummary = null
  }

  return (
    <div className='space-y-8'>
      <section className='space-y-3'>
        <p className='text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500'>Partners</p>
        <h1 className='text-3xl font-semibold tracking-tight'>Partner applications</h1>
        <p className='max-w-3xl text-sm leading-6 text-neutral-600'>
          Active partners are shown here with member-safe details. Applications are created and tracked server-side.
        </p>
      </section>

      <section className='rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm'>
        <h2 className='text-xl font-semibold text-neutral-950'>Affiliate summary</h2>
        {affiliateSummary ? (
          <dl className='mt-4 grid gap-4 sm:grid-cols-3'>
            <div>
              <dt className='text-sm text-neutral-500'>Referrals</dt>
              <dd className='mt-1 text-2xl font-semibold text-neutral-950'>{affiliateSummary.referralCount}</dd>
            </div>
            <div>
              <dt className='text-sm text-neutral-500'>Pending commissions</dt>
              <dd className='mt-1 text-2xl font-semibold text-neutral-950'>
                {affiliateSummary.pendingCommissionTotalMinor}
              </dd>
            </div>
            <div>
              <dt className='text-sm text-neutral-500'>Approved commissions</dt>
              <dd className='mt-1 text-2xl font-semibold text-neutral-950'>
                {affiliateSummary.approvedCommissionTotalMinor}
              </dd>
            </div>
          </dl>
        ) : (
          <p className='mt-2 text-sm text-neutral-600'>
            No active affiliate summary is available for your account.
          </p>
        )}
      </section>

      <section className='grid gap-4 md:grid-cols-2'>
        {partners.length > 0 ? (
          partners.map((partner) => (
            <article key={partner.id} className='rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm'>
              <div className='flex items-start justify-between gap-4'>
                <div>
                  <h2 className='text-lg font-semibold text-neutral-950'>{partner.name}</h2>
                  <p className='mt-1 text-sm text-neutral-500'>{partner.category}</p>
                </div>
                <span className='rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700'>
                  {partner.applicationMode}
                </span>
              </div>
              <p className='mt-3 text-sm leading-6 text-neutral-700'>{partner.summary ?? 'Details available after sign-in.'}</p>
              {partner.privacyNotice ? (
                <p className='mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900'>
                  {partner.privacyNotice}
                </p>
              ) : null}
              <div className='mt-4'>
                <Link className='text-sm font-semibold text-neutral-950 underline' href={`/portal/partners/${partner.slug}`}>
                  Review and apply
                </Link>
              </div>
            </article>
          ))
        ) : (
          <p className='text-sm text-neutral-600'>No active partners are currently available.</p>
        )}
      </section>

      <section className='rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm'>
        <h2 className='text-xl font-semibold text-neutral-950'>Your history</h2>
        <p className='mt-2 text-sm text-neutral-600'>Only your own applications are shown. Delivery destinations and private notes stay server-side.</p>
        <div className='mt-5 space-y-3'>
          {applications.length > 0 ? (
            applications.map((application) => (
              <div key={application.id} className='rounded-xl border border-neutral-200 px-4 py-3'>
                <div className='flex flex-wrap items-center justify-between gap-3'>
                  <div>
                    <p className='font-semibold text-neutral-950'>{application.partnerName}</p>
                    <p className='text-xs text-neutral-500'>Submitted: {application.submittedAt ?? application.createdAt ?? 'pending'}</p>
                  </div>
                  <span className='text-xs font-semibold uppercase tracking-wide text-neutral-600'>
                    {application.status}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p className='text-sm text-neutral-600'>You have not submitted any partner applications yet.</p>
          )}
        </div>
      </section>
    </div>
  )
}
