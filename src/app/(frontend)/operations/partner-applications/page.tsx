import Link from 'next/link'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import config from '@payload-config'
import { getPayload } from 'payload'

import { PARTNERS_SESSION_COOKIE, getPartnerSession, sanitizeSessionId } from '@/lib/partners-session'
import { buildPartnerAdminReport } from '@/lib/partnerAffiliateReporting'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams?: Promise<{
    partner_id?: string
    status?: string
    mode?: string
  }>
}

function isAdminId(value: number): boolean {
  const raw = process.env.PARTNERS_ADMIN_ACCOUNT_IDS ?? ''
  return raw
    .split(',')
    .map((item) => Number(item.trim()))
    .some((id) => Number.isInteger(id) && id === value)
}

export default async function PartnerApplicationsAdminPage({ searchParams }: PageProps): Promise<JSX.Element> {
  const cookieStore = await cookies()
  const sessionId = sanitizeSessionId(cookieStore.get(PARTNERS_SESSION_COOKIE)?.value)
  if (!sessionId) notFound()
  const session = await getPartnerSession(sessionId)
  if (!session || !isAdminId(session.accountId)) notFound()

  const payload = await getPayload({ config })
  const filters = await (searchParams ?? Promise.resolve({ partner_id: undefined, status: undefined, mode: undefined }))
  const report = await buildPartnerAdminReport(payload as never, {
    partnerId: filters.partner_id ?? null,
    status: filters.status ?? null,
    mode: filters.mode ?? null,
  })

  return (
    <main className='mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6'>
      <section className='space-y-2'>
        <p className='jpv-eyebrow'>Partners · Operator</p>
        <h1 className='text-2xl font-semibold tracking-tight text-jpv-ink'>Partner applications</h1>
        <p className='text-sm text-jpv-muted'>Admin-only reporting for submissions and delivery state.</p>
      </section>

      <section className='grid gap-4 sm:grid-cols-4'>
        <div className='rounded-jpv-card border border-jpv-border bg-jpv-canvas p-4'>
          <p className='text-xs font-semibold uppercase tracking-[0.14em] text-jpv-muted'>Views</p>
          <p className='mt-1 text-2xl font-bold tabular-nums text-jpv-ink'>{report.totals.views}</p>
        </div>
        <div className='rounded-jpv-card border border-jpv-border bg-jpv-canvas p-4'>
          <p className='text-xs font-semibold uppercase tracking-[0.14em] text-jpv-muted'>Clicks</p>
          <p className='mt-1 text-2xl font-bold tabular-nums text-jpv-ink'>{report.totals.clicks}</p>
        </div>
        <div className='rounded-jpv-card border border-jpv-border bg-jpv-canvas p-4'>
          <p className='text-xs font-semibold uppercase tracking-[0.14em] text-jpv-muted'>Submissions</p>
          <p className='mt-1 text-2xl font-bold tabular-nums text-jpv-ink'>{report.totals.submissions}</p>
        </div>
        <div className='rounded-jpv-card border border-jpv-border bg-jpv-canvas p-4'>
          <p className='text-xs font-semibold uppercase tracking-[0.14em] text-jpv-muted'>Delivered</p>
          <p className='mt-1 text-2xl font-bold tabular-nums text-jpv-ink'>{report.totals.delivered}</p>
        </div>
      </section>

      <section>
        <Link className='jpv-button-secondary min-h-11 px-4 text-sm' href='/api/admin/partner-applications/export'>
          Export CSV
        </Link>
      </section>

      <section className='overflow-x-auto rounded-jpv-panel border border-jpv-border bg-jpv-canvas'>
        <table className='w-full text-sm'>
          <thead className='bg-jpv-surface text-left'>
            <tr>
              <th className='px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-jpv-muted'>Partner</th>
              <th className='px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-jpv-muted'>Member</th>
              <th className='px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-jpv-muted'>Status</th>
              <th className='px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-jpv-muted'>Mode</th>
              <th className='px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-jpv-muted'>Action</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.length > 0 ? (
              report.rows.map((row) => (
                <tr key={row.application} className='border-t border-jpv-border'>
                  <td className='px-4 py-3 text-jpv-ink'>{row.partner}</td>
                  <td className='px-4 py-3 text-jpv-ink'>{row.member}</td>
                  <td className='px-4 py-3 text-jpv-ink'>{row.status}</td>
                  <td className='px-4 py-3 text-jpv-ink'>{row.deliveryMethod}</td>
                  <td className='px-4 py-3'>
                    <form action={`/api/admin/partner-applications/${row.application}/retry`} method='post'>
                      <button className='jpv-button-secondary min-h-11 px-3 text-xs' type='submit'>
                        Retry
                      </button>
                    </form>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className='px-4 py-6 text-center text-sm text-jpv-muted' colSpan={5}>No applications.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  )
}
