import 'server-only'

import Link from 'next/link'
import { getAllWeeks, getProgrammeSummary, type WeekEntry } from '@/lib/course/programmeCatalog'
import { requirePortalAccess } from '@/lib/auth/requirePortalAccess'

export const dynamic = 'force-dynamic'

const WEEK_NUMBERS: Record<string, number> = {
  'week-01': 1, 'week-02': 2, 'week-03': 3, 'week-04': 4,
  'week-05': 5, 'week-06': 6, 'week-07': 7, 'week-08': 8,
}

function accessBadge(access: WeekEntry['access']): { label: string; className: string } {
  switch (access) {
    case 'free_and_pro':
      return { label: 'Free + Pro', className: 'border-jpv-brand/20 bg-emerald-50 text-emerald-700' }
    case 'pro':
      return { label: 'Pro', className: 'border-jpv-sunshine bg-jpv-surface text-jpv-sunshine-ink' }
    case 'free':
      return { label: 'Free', className: 'border-jpv-border bg-jpv-canvas text-jpv-muted' }
  }
}

function WeekCard({ week, index }: { week: WeekEntry; index: number }) {
  const weekNumber = WEEK_NUMBERS[week.id] ?? index + 1
  const access = accessBadge(week.access)

  return (
    <article className='rounded-jpv-card border border-jpv-border bg-jpv-canvas p-5 shadow-jpv-card sm:p-6'>
      <div className='flex items-start justify-between gap-4'>
        <p className='jpv-eyebrow'>Week {weekNumber}</p>
        <span className={`rounded-jpv-pill border px-3 py-1 text-xs font-semibold ${access.className}`}>
          {access.label}
        </span>
      </div>
      <h3 className='mt-2 text-xl font-semibold text-jpv-ink'>{week.title}</h3>
      <p className='mt-3 text-sm leading-6 text-jpv-muted'>{week.summary}</p>
      {week.hasMentorship ? (
        <p className='mt-4 text-xs font-semibold text-jpv-muted'>Includes mentorship session</p>
      ) : null}
    </article>
  )
}

export default async function PortalProgrammePage() {
  await requirePortalAccess('/portal/programme')

  const weeks = getAllWeeks()
  const summary = getProgrammeSummary()

  return (
    <div className='space-y-6'>
      <header className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8'>
        <p className='jpv-eyebrow'>JPV Bootcamp</p>
        <h1 className='mt-2 text-3xl font-semibold tracking-tight text-jpv-ink'>8-Week Programme</h1>
        <p className='mt-3 max-w-2xl text-sm leading-6 text-jpv-muted'>
          Weekly modules covering strategy, analysis, funding, deals, and portfolio growth for active JPV Bootcamp Membership holders. Content is representative and does not reflect final client-approved copy.
        </p>
        <p className='jpv-notice mt-4'>
          Preview only — programme content is placeholder until a complete approved content package passes repository validation, acceptance, and approval evidence review. Full access requires an active JPV Bootcamp Membership, including voucher-funded or pay-it-forward-funded membership. Client input due 15 July 2026.
        </p>
      </header>

      <section aria-label={`${summary.totalWeeks} programme weeks`}>
        <div className='grid gap-5 md:grid-cols-2'>
          {weeks.map((week, index) => (
            <WeekCard key={week.id} week={week} index={index} />
          ))}
        </div>
      </section>

      <section className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-5 shadow-jpv-card sm:p-6'>
        <h2 className='text-xl font-semibold text-jpv-ink'>Membership</h2>
        <p className='mt-2 text-sm leading-6 text-jpv-muted'>
          Full programme access including mentorship and community requires an active JPV Bootcamp Membership.
        </p>
        <div className='mt-4 flex flex-wrap gap-3'>
          <Link className='jpv-button-primary min-h-11' href='/portal/billing'>
            View JPV Bootcamp Membership
          </Link>
          <Link className='jpv-button-secondary min-h-11' href='/portal'>
            Dashboard
          </Link>
        </div>
      </section>
    </div>
  )
}
