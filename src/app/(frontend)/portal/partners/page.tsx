import Link from 'next/link'

import { requirePortalAccess } from '@/lib/auth/requirePortalAccess'
import { getAffiliateSummary } from '@/lib/payloadCourse/affiliateReporting'
import { listActivePartners, listMemberApplications } from '@/lib/payloadCourse/partnerApplications'

export const dynamic = 'force-dynamic'

function formatCommission(amountMinor: number, currency: string | null): string {
  if (!currency) return amountMinor === 0 ? 'None recorded' : `${amountMinor} minor units`
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amountMinor / 100)
  } catch {
    return `${amountMinor} ${currency.toUpperCase()}`
  }
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Pending'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Pending'
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(date)
}

export default async function PortalPartnersPage(): Promise<JSX.Element> {
  const { actor, payload } = await requirePortalAccess('/portal/partners')

  if (actor.kind === 'admin') {
    return (
      <div className='space-y-6'>
        <section>
          <p className='jpv-eyebrow'>Administration</p>
          <h1 className='mt-3 text-2xl font-semibold tracking-tight text-jpv-ink'>Partners</h1>
          <p className='mt-2 max-w-2xl text-sm leading-6 text-jpv-muted'>
            Partner management is scoped to billing and referral operations outside the portal admin scope.
          </p>
        </section>
        <div className='rounded-jpv-panel border border-dashed border-jpv-border bg-jpv-canvas p-8 text-center text-sm text-jpv-muted'>
          Partner and affiliate data is member-specific. Navigate to community or courses to manage content.
        </div>
      </div>
    )
  }

  const memberId = actor.memberId
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
    <div className='space-y-6'>
      <header className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8'>
        <p className='jpv-eyebrow'>Partners</p>
        <h1 className='mt-2 text-3xl font-semibold tracking-tight text-jpv-ink'>Partner applications</h1>
        <p className='mt-3 max-w-3xl text-sm leading-6 text-jpv-muted'>
          Review approved partner opportunities and track applications submitted through your member account.
        </p>
      </header>

      <section className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-5 shadow-jpv-card sm:p-6'>
        <div className='flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between'>
          <div>
            <p className='jpv-eyebrow'>Affiliate activity</p>
            <h2 className='mt-2 text-xl font-semibold text-jpv-ink'>Your summary</h2>
          </div>
          <p className='text-sm text-jpv-muted'>Only activity linked to your member account is shown.</p>
        </div>
        {affiliateSummary ? (
          <dl className='mt-5 grid gap-4 sm:grid-cols-3'>
            <div className='rounded-jpv-card border border-jpv-border bg-jpv-surface p-4'>
              <dt className='text-sm text-jpv-muted'>Referrals</dt>
              <dd className='mt-1 text-2xl font-semibold text-jpv-ink'>{affiliateSummary.referralCount}</dd>
            </div>
            <div className='rounded-jpv-card border border-jpv-border bg-jpv-surface p-4'>
              <dt className='text-sm text-jpv-muted'>Pending commissions</dt>
              <dd className='mt-1 text-2xl font-semibold text-jpv-ink'>
                {formatCommission(affiliateSummary.pendingCommissionTotalMinor, affiliateSummary.currency)}
              </dd>
            </div>
            <div className='rounded-jpv-card border border-jpv-border bg-jpv-surface p-4'>
              <dt className='text-sm text-jpv-muted'>Approved commissions</dt>
              <dd className='mt-1 text-2xl font-semibold text-jpv-ink'>
                {formatCommission(affiliateSummary.approvedCommissionTotalMinor, affiliateSummary.currency)}
              </dd>
            </div>
          </dl>
        ) : (
          <p className='mt-4 text-sm text-jpv-muted'>No active affiliate summary is available for your account.</p>
        )}
      </section>

      <section aria-labelledby='partner-opportunities-heading'>
        <div className='flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between'>
          <div>
            <p className='jpv-eyebrow'>Opportunities</p>
            <h2 className='mt-2 text-2xl font-semibold text-jpv-ink' id='partner-opportunities-heading'>
              Available partners
            </h2>
          </div>
          <p className='text-sm text-jpv-muted'>{partners.length} available</p>
        </div>

        <div className='mt-5 grid gap-4 md:grid-cols-2'>
          {partners.length > 0 ? (
            partners.map((partner) => (
              <article className='rounded-jpv-card border border-jpv-border bg-jpv-canvas p-5 shadow-jpv-card sm:p-6' key={partner.id}>
                <div className='flex items-start justify-between gap-4'>
                  <div className='min-w-0'>
                    <h3 className='text-lg font-semibold text-jpv-ink'>{partner.name}</h3>
                    <p className='mt-1 text-sm text-jpv-muted'>{partner.category}</p>
                  </div>
                  <span className='shrink-0 rounded-jpv-pill bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700'>
                    {partner.applicationMode}
                  </span>
                </div>
                <p className='mt-3 text-sm leading-6 text-jpv-ink'>{partner.summary ?? 'Member-safe details are available on the application page.'}</p>
                {partner.privacyNotice ? <p className='jpv-notice mt-4'>{partner.privacyNotice}</p> : null}
                <Link className='jpv-button-primary mt-5 min-h-11' href={`/portal/partners/${partner.slug}`}>
                  Review and apply
                </Link>
              </article>
            ))
          ) : (
            <div className='rounded-jpv-card border border-dashed border-jpv-border bg-jpv-canvas p-6 text-sm text-jpv-muted md:col-span-2'>
              No active partners are currently available.
            </div>
          )}
        </div>
      </section>

      <section className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-5 shadow-jpv-card sm:p-6'>
        <p className='jpv-eyebrow'>Applications</p>
        <h2 className='mt-2 text-xl font-semibold text-jpv-ink'>Your history</h2>
        <p className='mt-2 text-sm leading-6 text-jpv-muted'>
          Only your applications are shown. Delivery destinations and private notes remain server-side.
        </p>
        <div className='mt-5 space-y-3'>
          {applications.length > 0 ? (
            applications.map((application) => (
              <div className='rounded-jpv-card border border-jpv-border bg-jpv-surface p-4' key={application.id}>
                <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                  <div>
                    <p className='font-semibold text-jpv-ink'>{application.partnerName}</p>
                    <p className='text-xs text-jpv-muted'>Submitted {formatDate(application.submittedAt ?? application.createdAt)}</p>
                  </div>
                  <span className='rounded-jpv-pill bg-jpv-surface-strong px-3 py-1 text-xs font-semibold text-jpv-ink'>
                    {application.status}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p className='text-sm text-jpv-muted'>You have not submitted any partner applications yet.</p>
          )}
        </div>
      </section>
    </div>
  )
}
