import Link from 'next/link'
import { getAdminReviewSections, getAdminReviewSummary, getAdminReviewExportRows } from '@/lib/admin/adminReviewModel'

export const dynamic = 'force-dynamic'

function statusBadge(status: string): { label: string; className: string } {
  switch (status) {
    case 'ready_for_testing':
      return { label: 'Ready for testing', className: 'bg-emerald-50 text-emerald-700' }
    case 'preview':
      return { label: 'Preview', className: 'bg-blue-50 text-blue-700' }
    case 'manual_review':
      return { label: 'Manual review', className: 'bg-amber-50 text-amber-700' }
    case 'blocked':
      return { label: 'Blocked', className: 'bg-red-50 text-red-700' }
    default:
      return { label: status, className: 'bg-neutral-100 text-neutral-700' }
  }
}

export default function AdminReviewPage() {
  const sections = getAdminReviewSections()
  const summary = getAdminReviewSummary()
  const exportRows = getAdminReviewExportRows()

  return (
    <main className="bg-neutral-50">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">
            JPV Bootcamp — Admin
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">
            Review dashboard
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-neutral-600">
            Preview of operator review sections for implemented MVP flows. No live DB queue is
            loaded — all data is representative preview. Manual review and migration approval
            are still required before live operation.
          </p>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Read-only preview — no DB-backed review queues, no live application data, no
            migrations applied. Status reflects implementation completeness only.
          </div>
        </div>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-neutral-950">Summary</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-xl border border-neutral-200 bg-white p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-neutral-950">{summary.totalSections}</p>
              <p className="mt-1 text-xs text-neutral-500">Total sections</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-white p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-emerald-700">{summary.readyForTestingCount}</p>
              <p className="mt-1 text-xs text-emerald-600">Ready for testing</p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-white p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-blue-700">{summary.previewCount}</p>
              <p className="mt-1 text-xs text-blue-600">Preview</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-white p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-amber-700">{summary.manualReviewCount}</p>
              <p className="mt-1 text-xs text-amber-600">Manual review</p>
            </div>
            <div className="rounded-xl border border-red-200 bg-white p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-red-700">{summary.blockedCount}</p>
              <p className="mt-1 text-xs text-red-600">Blocked</p>
            </div>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-neutral-950">Review sections</h2>
          <div className="mt-4 grid gap-5 md:grid-cols-2">
            {sections.map((section) => {
              const status = statusBadge(section.status)

              return (
                <article
                  key={section.slug}
                  className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-neutral-950">{section.title}</h3>
                      <p className="mt-1 text-xs text-neutral-500">{section.ownerLabel}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}>
                      {status.label}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-neutral-600">{section.summary}</p>
                  <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold">
                    {section.blockerCount > 0 ? (
                      <span className="rounded-full bg-red-50 px-3 py-1 text-red-700">
                        {section.blockerCount} blocker{section.blockerCount === 1 ? '' : 's'}
                      </span>
                    ) : null}
                    {section.actionCount > 0 ? (
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">
                        {section.actionCount} action{section.actionCount === 1 ? '' : 's'}
                      </span>
                    ) : null}
                  </div>
                  <Link
                    href={section.href}
                    className="mt-5 inline-flex text-sm font-semibold text-neutral-950 underline-offset-4 hover:underline"
                  >
                    View section
                  </Link>
                </article>
              )
            })}
          </div>
        </section>

        <section className="mt-10 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-neutral-950">Export preview</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Static export rows for operator review preparation. No file is written — data is
            representative preview only.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  <th className="px-3 py-2">Section</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Owner</th>
                  <th className="px-3 py-2 text-right">Blockers</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                  <th className="px-3 py-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {exportRows.map((row) => (
                  <tr key={row.section} className="border-b border-neutral-100">
                    <td className="px-3 py-2 font-medium text-neutral-950">{row.section}</td>
                    <td className="px-3 py-2 capitalize text-neutral-700">{row.status}</td>
                    <td className="px-3 py-2 text-neutral-600">{row.owner}</td>
                    <td className="px-3 py-2 text-right text-neutral-700">{row.blockers}</td>
                    <td className="px-3 py-2 text-right text-neutral-700">{row.actions}</td>
                    <td className="px-3 py-2 text-neutral-500">{row.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-10 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-neutral-950">Quick links</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/partner-referral"
              className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              Partner referrals
            </Link>
            <Link
              href="/support"
              className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              Support & pay it forward
            </Link>
            <Link
              href="/programme"
              className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              Programme
            </Link>
            <Link
              href="/community"
              className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              Community preview
            </Link>
            <Link
              href="/dashboard"
              className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              Preview dashboard
            </Link>
            <Link
              href="/upgrade"
              className="rounded-lg bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800"
            >
              View Pro membership
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
