import 'server-only'

import Link from 'next/link'
import { getAllWeeks, getProgrammeSummary, type WeekEntry } from '@/lib/course/programmeCatalog'
import { requirePortalMember } from '@/lib/auth/requirePortalMember'

export const dynamic = 'force-dynamic'

const WEEK_NUMBERS: Record<string, number> = {
  'week-01': 1, 'week-02': 2, 'week-03': 3, 'week-04': 4,
  'week-05': 5, 'week-06': 6, 'week-07': 7, 'week-08': 8,
}

function accessBadge(access: WeekEntry['access']): { label: string; className: string } {
  switch (access) {
    case 'free_and_pro':
      return { label: 'Free + Pro', className: 'bg-blue-50 text-blue-700' }
    case 'pro':
      return { label: 'Pro', className: 'bg-amber-50 text-amber-700' }
    case 'free':
      return { label: 'Free', className: 'bg-green-50 text-green-700' }
  }
}

function WeekCard({ week, index }: { week: WeekEntry; index: number }) {
  const weekNumber = WEEK_NUMBERS[week.id] ?? index + 1
  const access = accessBadge(week.access)

  return (
    <article className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
          Week {weekNumber}
        </p>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${access.className}`}>
          {access.label}
        </span>
      </div>
      <h3 className="mt-2 text-xl font-semibold text-neutral-950">{week.title}</h3>
      <p className="mt-3 text-sm leading-6 text-neutral-600">{week.summary}</p>
      {week.hasMentorship ? (
        <p className="mt-4 text-xs font-semibold text-neutral-500">Includes mentorship session</p>
      ) : null}
    </article>
  )
}

export default async function PortalProgrammePage() {
  await requirePortalMember('/portal/programme')

  const weeks = getAllWeeks()
  const summary = getProgrammeSummary()

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">
          JPV Bootcamp
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">8-Week Programme</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600">
          Weekly modules covering strategy, analysis, funding, deals, and portfolio growth.
          Content is representative and does not reflect final client-approved copy.
        </p>
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Preview only — programme content is placeholder until a complete approved content package
          passes repository validation, acceptance, and approval evidence review. Full access
          requires an active JPV Bootcamp Membership, including voucher-funded or pay-it-forward-funded membership. Client input due 15 July 2026.
        </div>
      </section>

      <section>
        <div className="grid gap-5 md:grid-cols-2">
          {weeks.map((week, index) => (
            <WeekCard key={week.id} week={week} index={index} />
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-neutral-950">Membership</h2>
        <p className="mt-2 text-sm text-neutral-600">
          Full programme access including mentorship and community requires an active JPV Bootcamp Membership.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/portal/billing"
            className="rounded-lg bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800"
          >
            View JPV Bootcamp Membership
          </Link>
          <Link
            href="/portal"
            className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            Dashboard
          </Link>
        </div>
      </section>
    </div>
  )
}
