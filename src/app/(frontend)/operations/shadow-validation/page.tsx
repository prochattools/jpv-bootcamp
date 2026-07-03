import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'

import { PARTNERS_SESSION_COOKIE, getPartnerSession, sanitizeSessionId } from '@/lib/partners-session'
import { isSponsoredSeatsAdmin } from '@/lib/sponsored-admin'
import { buildShadowValidationReport } from '@/lib/shadowValidationReport'

export const dynamic = 'force-dynamic'

function isAdminId(value: number): boolean {
  const raw = process.env.SPONSORED_SEATS_ADMIN_WP_USER_IDS ?? ''
  return raw
    .split(',')
    .map((item) => Number(item.trim()))
    .some((id) => Number.isInteger(id) && id === value)
}

export default async function ShadowValidationPage(): Promise<JSX.Element> {
  const sessionCookie = (await cookies()).get(PARTNERS_SESSION_COOKIE)?.value
  const sessionId = sanitizeSessionId(sessionCookie)
  if (!sessionId) notFound()

  const session = await getPartnerSession(sessionId)
  if (!session || (!isSponsoredSeatsAdmin(session.wpUserId) && !isAdminId(session.wpUserId))) {
    notFound()
  }

  const report = await buildShadowValidationReport(process.env)

  return (
    <main className='mx-auto max-w-6xl px-6 py-12 space-y-8'>
      <section className='space-y-2'>
        <p className='text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500'>Release</p>
        <h1 className='text-2xl font-semibold'>Cross-domain shadow validation</h1>
        <p className='text-sm text-neutral-600'>Read-only repository readiness and cutover evidence.</p>
      </section>

      <section className='grid gap-4 sm:grid-cols-3'>
        <div className='rounded-lg border border-neutral-200 bg-white p-4'>Repository ready: {String(report.repositoryReady)}</div>
        <div className='rounded-lg border border-neutral-200 bg-white p-4'>Configuration ready: {String(report.configurationReady)}</div>
        <div className='rounded-lg border border-neutral-200 bg-white p-4'>Cutover ready: {String(report.cutoverReady)}</div>
      </section>

      <section className='rounded-lg border border-neutral-200 bg-white p-5'>
        <h2 className='font-semibold'>Pending migrations</h2>
        <ul className='mt-3 list-disc pl-5 text-sm text-neutral-700'>
          {report.metadata.migrationOrder.map((migration) => (
            <li key={migration}>{migration}</li>
          ))}
        </ul>
      </section>

      <section className='grid gap-4 md:grid-cols-2'>
        {Object.entries(report.domains).map(([domain, summary]) => (
          <article key={domain} className='rounded-lg border border-neutral-200 bg-white p-5'>
            <h2 className='font-semibold capitalize'>{domain}</h2>
            <p className='mt-2 text-sm text-neutral-600'>Ready: {String(summary.ready)}</p>
            <p className='text-sm text-neutral-600'>Issues: {summary.issueCount}</p>
            {'pendingMigrations' in summary ? (
              <p className='text-xs text-neutral-500'>Pending migrations: {summary.pendingMigrations.length}</p>
            ) : null}
          </article>
        ))}
      </section>

      <section className='rounded-lg border border-neutral-200 bg-white p-5'>
        <h2 className='font-semibold'>Issues</h2>
        <div className='mt-3 space-y-3'>
          {report.issues.map((issue) => (
            <article key={`${issue.domain}:${issue.code}:${issue.detail}`} className='rounded-md border border-neutral-200 px-4 py-3'>
              <div className='flex flex-wrap items-center justify-between gap-3'>
                <p className='text-sm font-semibold'>{issue.code}</p>
                <p className='text-xs uppercase tracking-wide text-neutral-500'>{issue.domain} / {issue.severity}</p>
              </div>
              <p className='mt-1 text-sm text-neutral-700'>{issue.detail}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
