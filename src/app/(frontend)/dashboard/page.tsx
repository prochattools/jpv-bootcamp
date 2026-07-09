import Link from 'next/link'
import { getDashboardModel } from '@/lib/portal/memberDashboardModel'

export const dynamic = 'force-dynamic'

export default function DashboardPage() {
  const model = getDashboardModel()

  return (
    <main className="bg-neutral-50">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">
            JPV Bootcamp
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">
            Preview dashboard
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-neutral-600">
            Overview of available platform features. Content is representative and does not reflect final client-approved copy or live access state.
          </p>
          {model.accessSummary.isPlaceholder ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Preview — no live account, payment, or subscription data is loaded. Dashboard cards link to feature pages for testing.
            </div>
          ) : null}
        </div>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-neutral-950">Platform features</h2>
          <div className="mt-4 grid gap-5 md:grid-cols-2">
            {model.cards.map((card) => (
              <article
                key={card.id}
                className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-lg font-semibold text-neutral-950">{card.title}</h3>
                  {card.badge === 'pro' ? (
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                      Pro
                    </span>
                  ) : card.badge === 'support' ? (
                    <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">
                      Support
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm leading-6 text-neutral-600">{card.summary}</p>
                <Link
                  href={card.href}
                  className="mt-5 inline-flex text-sm font-semibold text-neutral-950 underline-offset-4 hover:underline"
                >
                  {card.ctaLabel}
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-neutral-950">Access</h2>
          <div className="mt-4 space-y-4 text-sm leading-6 text-neutral-600">
            <div className="rounded-lg border border-amber-100 bg-amber-50/50 px-4 py-3">
              <span className="font-semibold text-amber-800">Pro:</span>{' '}
              {model.accessSummary.proDescription}
            </div>
            <div className="rounded-lg border border-blue-100 bg-blue-50/50 px-4 py-3">
              <span className="font-semibold text-blue-800">Free:</span>{' '}
              {model.accessSummary.freeDescription}
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/upgrade"
              className="rounded-lg bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800"
            >
              View Pro membership
            </Link>
            <Link
              href="/portal"
              className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              Member portal
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}