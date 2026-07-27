import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getReviewSectionBySlug, getAdminReviewExportRows } from '@/lib/admin/adminReviewModel'
import { requireCurrentPayloadAdmin } from '@/lib/admin/currentAdmin'

type AdminReviewDetailPageProps = {
  params: Promise<{ sectionSlug: string }>
}

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

export default async function AdminReviewDetailPage({ params }: AdminReviewDetailPageProps) {
  await requireCurrentPayloadAdmin()

  const { sectionSlug } = await params
  const section = getReviewSectionBySlug(sectionSlug)

  if (!section) notFound()

  const status = statusBadge(section.status)
  const exportRows = getAdminReviewExportRows()
  const exportRow = exportRows.find((r) => r.section === section.title)

  return (
    <main className="bg-neutral-50">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <Link
          className="inline-flex text-sm font-semibold text-neutral-700 underline-offset-4 hover:text-neutral-950 hover:underline"
          href="/admin/review"
        >
          ← Back to review dashboard
        </Link>

        <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">
                Review section
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight">{section.title}</h1>
              <p className="mt-4 text-sm leading-6 text-neutral-600">{section.description}</p>
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}>
              {status.label}
            </span>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-4">
            <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3 text-center">
              <p className="text-lg font-bold text-neutral-950">{section.blockerCount}</p>
              <p className="text-xs text-neutral-500">Blockers</p>
            </div>
            <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3 text-center">
              <p className="text-lg font-bold text-neutral-950">{section.actionCount}</p>
              <p className="text-xs text-neutral-500">Actions</p>
            </div>
            <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3 text-center">
              <p className="text-lg font-bold text-neutral-950">{section.ownerLabel}</p>
              <p className="text-xs text-neutral-500">Owner</p>
            </div>
            <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3 text-center">
              <p className="text-lg font-bold text-neutral-950">{section.summary}</p>
              <p className="text-xs text-neutral-500">Summary</p>
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-amber-100 bg-amber-50/50 px-4 py-3 text-sm text-amber-800">
            Preview only — no live DB queue is loaded. No migrations have been applied.
            {section.status === 'manual_review' || section.status === 'ready_for_testing'
              ? ' Manual review is still required before live operation.'
              : null}
          </div>

          {section.notes ? (
            <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
              <span className="font-semibold text-neutral-900">Notes:</span> {section.notes}
            </div>
          ) : null}
        </section>

        <section className="mt-6 flex flex-wrap gap-3">
          <Link
            href={section.href}
            className="inline-flex min-h-11 items-center rounded-lg bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800"
          >
            View implementation
          </Link>
          <Link
            href="/admin/review"
            className="inline-flex min-h-11 items-center rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            All review sections
          </Link>
        </section>

        {exportRow ? (
          <section className="mt-10 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-neutral-950">Export row preview</h2>
            <p className="mt-2 text-sm text-neutral-600">
              Static export row entry for operator review preparation. No file is written.
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
                  <tr className="border-b border-neutral-100">
                    <td className="px-3 py-2 font-medium text-neutral-950">{exportRow.section}</td>
                    <td className="px-3 py-2 capitalize text-neutral-700">{exportRow.status}</td>
                    <td className="px-3 py-2 text-neutral-600">{exportRow.owner}</td>
                    <td className="px-3 py-2 text-right text-neutral-700">{exportRow.blockers}</td>
                    <td className="px-3 py-2 text-right text-neutral-700">{exportRow.actions}</td>
                    <td className="px-3 py-2 text-neutral-500">{exportRow.notes}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  )
}
