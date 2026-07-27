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
      return { label: 'Preview', className: 'bg-jpv-surface text-jpv-brand-deep' }
    case 'manual_review':
      return { label: 'Manual review', className: 'bg-jpv-sunshine/20 text-jpv-sunshine-ink' }
    case 'blocked':
      return { label: 'Blocked', className: 'bg-jpv-danger-surface text-jpv-danger-ink' }
    default:
      return { label: status, className: 'bg-jpv-surface text-jpv-muted' }
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
    <main className='bg-jpv-surface'>
      <div className='mx-auto max-w-6xl space-y-6 px-4 py-10 sm:px-6'>
        <Link
          className='inline-flex min-h-11 items-center text-sm font-semibold text-jpv-muted underline-offset-4 hover:text-jpv-ink hover:underline'
          href='/admin/review'
        >
          ← Back to review dashboard
        </Link>

        <section className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 sm:p-8'>
          <div className='flex flex-col gap-5 md:flex-row md:items-start md:justify-between'>
            <div className='max-w-3xl'>
              <p className='jpv-eyebrow'>Review section</p>
              <h1 className='mt-3 text-2xl font-semibold tracking-tight text-jpv-ink'>{section.title}</h1>
              <p className='mt-3 text-sm leading-6 text-jpv-muted'>{section.description}</p>
            </div>
            <span className={`shrink-0 rounded-jpv-pill px-3 py-1 text-xs font-semibold ${status.className}`}>
              {status.label}
            </span>
          </div>

          <div className='mt-6 grid gap-3 sm:grid-cols-4'>
            <div className='rounded-jpv-card border border-jpv-border bg-jpv-surface p-3 text-center'>
              <p className='text-lg font-bold tabular-nums text-jpv-ink'>{section.blockerCount}</p>
              <p className='text-xs text-jpv-muted'>Blockers</p>
            </div>
            <div className='rounded-jpv-card border border-jpv-border bg-jpv-surface p-3 text-center'>
              <p className='text-lg font-bold tabular-nums text-jpv-ink'>{section.actionCount}</p>
              <p className='text-xs text-jpv-muted'>Actions</p>
            </div>
            <div className='rounded-jpv-card border border-jpv-border bg-jpv-surface p-3 text-center'>
              <p className='text-sm font-bold text-jpv-ink'>{section.ownerLabel}</p>
              <p className='text-xs text-jpv-muted'>Owner</p>
            </div>
            <div className='rounded-jpv-card border border-jpv-border bg-jpv-surface p-3 text-center'>
              <p className='text-sm font-bold text-jpv-ink'>{section.summary}</p>
              <p className='text-xs text-jpv-muted'>Summary</p>
            </div>
          </div>

          <div className='jpv-notice mt-5 text-sm'>
            Preview only — no live DB queue is loaded. No migrations have been applied.
            {section.status === 'manual_review' || section.status === 'ready_for_testing'
              ? ' Manual review is still required before live operation.'
              : null}
          </div>

          {section.notes ? (
            <div className='jpv-notice mt-3 text-sm'>
              <span className='font-semibold text-jpv-ink'>Notes:</span> {section.notes}
            </div>
          ) : null}
        </section>

        <section className='flex flex-wrap gap-3'>
          <Link href={section.href} className='jpv-button-primary min-h-11 px-4 text-sm'>
            View implementation
          </Link>
          <Link href='/admin/review' className='jpv-button-secondary min-h-11 px-4 text-sm'>
            All review sections
          </Link>
        </section>

        {exportRow ? (
          <section className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-5 sm:p-6'>
            <h2 className='text-lg font-semibold text-jpv-ink'>Export row preview</h2>
            <p className='mt-2 text-sm text-jpv-muted'>
              Static export row entry for operator review preparation. No file is written.
            </p>
            <div className='mt-4 overflow-x-auto'>
              <table className='w-full text-left text-sm'>
                <thead>
                  <tr className='border-b border-jpv-border text-xs font-semibold uppercase tracking-wide text-jpv-muted'>
                    <th className='px-3 py-2.5'>Section</th>
                    <th className='px-3 py-2.5'>Status</th>
                    <th className='px-3 py-2.5'>Owner</th>
                    <th className='px-3 py-2.5 text-right'>Blockers</th>
                    <th className='px-3 py-2.5 text-right'>Actions</th>
                    <th className='px-3 py-2.5'>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className='border-b border-jpv-border/50'>
                    <td className='px-3 py-2.5 font-medium text-jpv-ink'>{exportRow.section}</td>
                    <td className='px-3 py-2.5 capitalize text-jpv-ink'>{exportRow.status}</td>
                    <td className='px-3 py-2.5 text-jpv-muted'>{exportRow.owner}</td>
                    <td className='px-3 py-2.5 text-right tabular-nums text-jpv-ink'>{exportRow.blockers}</td>
                    <td className='px-3 py-2.5 text-right tabular-nums text-jpv-ink'>{exportRow.actions}</td>
                    <td className='px-3 py-2.5 text-jpv-muted'>{exportRow.notes}</td>
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
