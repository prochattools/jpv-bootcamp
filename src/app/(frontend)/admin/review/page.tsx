import Link from 'next/link'
import { getAdminReviewSections, getAdminReviewSummary, getAdminReviewExportRows } from '@/lib/admin/adminReviewModel'
import { requireCurrentPayloadAdmin } from '@/lib/admin/currentAdmin'

export const dynamic = 'force-dynamic'

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

export default async function AdminReviewPage() {
  await requireCurrentPayloadAdmin()

  const sections = getAdminReviewSections()
  const summary = getAdminReviewSummary()
  const exportRows = getAdminReviewExportRows()

  return (
    <main className='bg-jpv-surface'>
      <div className='mx-auto max-w-6xl space-y-10 px-4 py-10 sm:px-6'>
        <div className='space-y-3'>
          <p className='jpv-eyebrow'>JPV Bootcamp — Admin</p>
          <h1 className='text-3xl font-semibold tracking-tight text-jpv-ink'>Review dashboard</h1>
          <div className='jpv-notice'>
            Read-only preview — no DB-backed review queues, no live application data, no
            migrations applied. Status reflects implementation completeness only.
          </div>
        </div>

        <section>
          <h2 className='text-xl font-semibold text-jpv-ink'>Summary</h2>
          <div className='mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5'>
            <div className='rounded-jpv-card border border-jpv-border bg-jpv-canvas p-4 text-center'>
              <p className='text-2xl font-bold text-jpv-ink'>{summary.totalSections}</p>
              <p className='mt-1 text-xs text-jpv-muted'>Total sections</p>
            </div>
            <div className='rounded-jpv-card border border-jpv-green/30 bg-jpv-canvas p-4 text-center'>
              <p className='text-2xl font-bold text-jpv-green'>{summary.readyForTestingCount}</p>
              <p className='mt-1 text-xs text-jpv-green'>Ready for testing</p>
            </div>
            <div className='rounded-jpv-card border border-jpv-border bg-jpv-canvas p-4 text-center'>
              <p className='text-2xl font-bold text-jpv-brand-deep'>{summary.previewCount}</p>
              <p className='mt-1 text-xs text-jpv-muted'>Preview</p>
            </div>
            <div className='rounded-jpv-card border border-jpv-sunshine/40 bg-jpv-canvas p-4 text-center'>
              <p className='text-2xl font-bold text-jpv-sunshine-ink'>{summary.manualReviewCount}</p>
              <p className='mt-1 text-xs text-jpv-sunshine-ink'>Manual review</p>
            </div>
            <div className='rounded-jpv-card border border-jpv-danger/30 bg-jpv-canvas p-4 text-center'>
              <p className='text-2xl font-bold text-jpv-danger'>{summary.blockedCount}</p>
              <p className='mt-1 text-xs text-jpv-danger'>Blocked</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className='text-xl font-semibold text-jpv-ink'>Review sections</h2>
          <div className='mt-4 grid gap-5 md:grid-cols-2'>
            {sections.map((section) => {
              const status = statusBadge(section.status)

              return (
                <article
                  key={section.slug}
                  className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6'
                >
                  <div className='flex items-start justify-between gap-4'>
                    <div className='min-w-0'>
                      <h3 className='text-base font-semibold text-jpv-ink'>{section.title}</h3>
                      <p className='mt-0.5 text-xs text-jpv-muted'>{section.ownerLabel}</p>
                    </div>
                    <span className={`shrink-0 rounded-jpv-pill px-3 py-1 text-xs font-semibold ${status.className}`}>
                      {status.label}
                    </span>
                  </div>
                  <p className='mt-3 text-sm leading-6 text-jpv-muted'>{section.summary}</p>
                  <div className='mt-4 flex flex-wrap gap-2 text-xs font-semibold'>
                    {section.blockerCount > 0 ? (
                      <span className='rounded-jpv-pill bg-jpv-danger-surface px-3 py-1 text-jpv-danger-ink'>
                        {section.blockerCount} blocker{section.blockerCount === 1 ? '' : 's'}
                      </span>
                    ) : null}
                    {section.actionCount > 0 ? (
                      <span className='rounded-jpv-pill bg-jpv-surface px-3 py-1 text-jpv-brand-deep'>
                        {section.actionCount} action{section.actionCount === 1 ? '' : 's'}
                      </span>
                    ) : null}
                  </div>
                  <div className='mt-5 flex flex-wrap gap-3'>
                    <Link
                      href={`/admin/review/${section.slug}`}
                      className='jpv-button-primary min-h-11 px-4 text-sm'
                    >
                      View details
                    </Link>
                    <Link
                      href={section.href}
                      className='inline-flex min-h-11 items-center text-sm font-semibold text-jpv-muted underline-offset-4 hover:text-jpv-ink hover:underline'
                    >
                      Implementation
                    </Link>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <section className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-5 sm:p-6'>
          <h2 className='text-lg font-semibold text-jpv-ink'>Export preview</h2>
          <p className='mt-2 text-sm text-jpv-muted'>
            Export checklist for operator preparation.
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
                {exportRows.map((row) => (
                  <tr key={row.section} className='border-b border-jpv-border/50'>
                    <td className='px-3 py-2.5 font-medium text-jpv-ink'>{row.section}</td>
                    <td className='px-3 py-2.5 capitalize text-jpv-ink'>{row.status}</td>
                    <td className='px-3 py-2.5 text-jpv-muted'>{row.owner}</td>
                    <td className='px-3 py-2.5 text-right tabular-nums text-jpv-ink'>{row.blockers}</td>
                    <td className='px-3 py-2.5 text-right tabular-nums text-jpv-ink'>{row.actions}</td>
                    <td className='px-3 py-2.5 text-jpv-muted'>{row.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-5 sm:p-6'>
          <h2 className='text-lg font-semibold text-jpv-ink'>Quick links</h2>
          <div className='mt-4 flex flex-wrap gap-3'>
            <Link href='/partner-referral' className='jpv-button-secondary min-h-11 px-4 text-sm'>
              Partner referrals
            </Link>
            <Link href='/support' className='jpv-button-secondary min-h-11 px-4 text-sm'>
              Support &amp; pay it forward
            </Link>
            <Link href='/programme' className='jpv-button-secondary min-h-11 px-4 text-sm'>
              Programme
            </Link>
            <Link href='/community' className='jpv-button-secondary min-h-11 px-4 text-sm'>
              Community preview
            </Link>
            <Link href='/upgrade' className='jpv-button-primary min-h-11 px-4 text-sm'>
              View JPV Bootcamp Membership
            </Link>
            <Link href='/portal' className='jpv-button-secondary min-h-11 px-4 text-sm'>
              Member portal
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
