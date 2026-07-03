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
  const raw = process.env.PARTNERS_ADMIN_WP_USER_IDS ?? ''
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
  if (!session || !isAdminId(session.wpUserId)) notFound()

  const payload = await getPayload({ config })
  const filters = await (searchParams ?? Promise.resolve({ partner_id: undefined, status: undefined, mode: undefined }))
  const report = await buildPartnerAdminReport(payload as never, {
    partnerId: filters.partner_id ?? null,
    status: filters.status ?? null,
    mode: filters.mode ?? null,
  })

  return (
    <main className='mx-auto max-w-6xl px-6 py-12 space-y-8'>
      <section className='space-y-2'>
        <p className='text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500'>Partners</p>
        <h1 className='text-2xl font-semibold'>Partner applications</h1>
        <p className='text-sm text-neutral-600'>Admin-only reporting for submissions and delivery state.</p>
      </section>

      <section className='grid gap-4 sm:grid-cols-4'>
        <div className='rounded-lg border border-neutral-200 bg-white p-4'>Views: {report.totals.views}</div>
        <div className='rounded-lg border border-neutral-200 bg-white p-4'>Clicks: {report.totals.clicks}</div>
        <div className='rounded-lg border border-neutral-200 bg-white p-4'>Submissions: {report.totals.submissions}</div>
        <div className='rounded-lg border border-neutral-200 bg-white p-4'>Delivered: {report.totals.delivered}</div>
      </section>

      <section className='flex gap-3'>
        <Link className='rounded border border-neutral-300 px-3 py-2 text-sm' href='/api/admin/partner-applications/export'>
          Export CSV
        </Link>
      </section>

      <section className='overflow-x-auto rounded-lg border border-neutral-200 bg-white'>
        <table className='w-full text-sm'>
          <thead className='bg-neutral-50 text-left'>
            <tr>
              <th className='px-3 py-2'>Partner</th>
              <th className='px-3 py-2'>Member</th>
              <th className='px-3 py-2'>Status</th>
              <th className='px-3 py-2'>Mode</th>
              <th className='px-3 py-2'>Action</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => (
              <tr key={row.application} className='border-t'>
                <td className='px-3 py-2'>{row.partner}</td>
                <td className='px-3 py-2'>{row.member}</td>
                <td className='px-3 py-2'>{row.status}</td>
                <td className='px-3 py-2'>{row.deliveryMethod}</td>
                <td className='px-3 py-2'>
                  <form action={`/api/admin/partner-applications/${row.application}/retry`} method='post'>
                    <button className='underline' type='submit'>
                      Retry
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  )
}
