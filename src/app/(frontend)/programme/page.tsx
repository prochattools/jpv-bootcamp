import Link from 'next/link'
import { getAllWeeks, getProgrammeSummary } from '@/lib/course/programmeCatalog'

export const dynamic = 'force-dynamic'

export default function ProgrammePage() {
  const weeks = getAllWeeks()
  const summary = getProgrammeSummary()

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold">JPV Bootcamp Programme</h1>
        <p className="text-muted-foreground">
          An 8-week course structure with weekly modules, mentorship sessions, and protected resources.
        </p>
        {summary.isPlaceholder ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Programme content is representative and subject to client approval. Final copy, resources, and access rules will replace these placeholders before launch.
          </div>
        ) : null}
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Weekly modules</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {weeks.map((week, index) => (
            <article
              key={week.id}
              className="rounded-lg border border-neutral-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-100 text-xs font-bold text-neutral-600">
                    {index + 1}
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Week {String(index + 1).padStart(2, '0')}
                  </span>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    week.access === 'free_and_pro'
                      ? 'bg-green-50 text-green-700'
                      : week.access === 'free'
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {week.access === 'free_and_pro'
                    ? 'Free + Pro'
                    : week.access === 'pro'
                      ? 'Pro'
                      : 'Free'}
                </span>
              </div>
              <h3 className="mt-3 font-semibold text-neutral-900">{week.title}</h3>
              <p className="mt-1 text-sm text-neutral-600">{week.summary}</p>
              {week.hasMentorship ? (
                <p className="mt-2 text-xs font-medium text-purple-600">
                  Includes mentorship session
                </p>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section className="mt-12 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-neutral-950">Membership</h2>
        <p className="mt-2 text-sm text-neutral-600">
          {summary.publicLabel} content is available through Pro membership. Some early modules are available to approved Free access members.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/upgrade"
            className="rounded-lg bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800"
          >
            View Pro membership
          </Link>
          <Link
            href={`mailto:${summary.supportEmail}?subject=JPV%20Bootcamp%20support`}
            className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            Contact support
          </Link>
        </div>
      </section>
    </main>
  )
}