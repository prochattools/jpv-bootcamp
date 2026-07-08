import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import config from '@payload-config'
import { getPayload } from 'payload'

import { PARTNERS_SESSION_COOKIE, getPartnerSession, sanitizeSessionId } from '@/lib/partners-session'
import { isSponsoredSeatsAdmin } from '@/lib/sponsored-admin'
import { buildShadowValidationReport, createShadowValidationAdapter } from '@/lib/shadowValidationReport'

export const dynamic = 'force-dynamic'

function isAdminId(value: number): boolean {
  const raw = process.env.SPONSORED_SEATS_ADMIN_ACCOUNT_IDS ?? ''
  return raw.split(',').map((item) => Number(item.trim())).some((id) => Number.isInteger(id) && id === value)
}

export default async function ShadowValidationPage(): Promise<JSX.Element> {
  const sessionCookie = (await cookies()).get(PARTNERS_SESSION_COOKIE)?.value
  const sessionId = sanitizeSessionId(sessionCookie)
  if (!sessionId) notFound()
  const session = await getPartnerSession(sessionId)
  if (!session || (!isSponsoredSeatsAdmin(session.accountId) && !isAdminId(session.accountId))) notFound()

  const payload = await getPayload({ config })
  const report = await buildShadowValidationReport(process.env, {
    adapterResult: await createShadowValidationAdapter(payload as never).load(),
  })

  return (
    <main className='mx-auto max-w-6xl px-6 py-12 space-y-8'>
      <section className='space-y-2'>
        <p className='text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500'>Release</p>
        <h1 className='text-2xl font-semibold'>Cross-domain shadow validation</h1>
        <p className='text-sm text-neutral-600'>Read-only repository readiness and cutover evidence.</p>
      </section>
      <section className='grid gap-4 sm:grid-cols-4'>
        <div className='rounded-lg border border-neutral-200 bg-white p-4'>Repository ready: {String(report.repositoryReady)}</div>
        <div className='rounded-lg border border-neutral-200 bg-white p-4'>Configuration ready: {String(report.configurationReady)}</div>
        <div className='rounded-lg border border-neutral-200 bg-white p-4'>Snapshot generated: {report.evidence.generatedAt}</div>
        <div className='rounded-lg border border-neutral-200 bg-white p-4'>Cutover ready: {String(report.cutoverReady)}</div>
      </section>
      <section className='rounded-lg border border-neutral-200 bg-white p-5'>
        <h2 className='font-semibold'>Collection counts</h2>
        <div className='mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
          {Object.entries(report.evidence.collectionCounts).map(([name, count]) => (
            <article key={name} className='rounded-md border border-neutral-200 px-4 py-3'>
              <p className='text-sm font-medium'>{name}</p>
              <p className='text-sm text-neutral-600'>Count: {count}</p>
            </article>
          ))}
        </div>
        <p className='mt-3 text-sm text-neutral-600'>Truncated collections: {report.evidence.truncatedCollections.length}</p>
        <p className='text-sm text-neutral-600'>Read failures: {report.evidence.readFailures.length}</p>
      </section>
      <section className='rounded-lg border border-neutral-200 bg-white p-5'>
        <div className='flex items-center justify-between gap-4'>
          <h2 className='font-semibold'>Admin evidence</h2>
          <a className='text-sm underline' href='/api/admin/shadow-validation/evidence'>Download JSON</a>
        </div>
      </section>
      <section className='rounded-lg border border-neutral-200 bg-white p-5'>
        <h2 className='font-semibold'>Domain totals</h2>
        <div className='mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
          {Object.entries(report.domains).map(([domain, summary]) => (
            <article key={domain} className='rounded-md border border-neutral-200 px-4 py-3'>
              <p className='text-sm font-medium capitalize'>{domain}</p>
              <p className='text-sm text-neutral-600'>Ready: {String(summary.ready)}</p>
              <p className='text-sm text-neutral-600'>Issues: {summary.issueCount}</p>
            </article>
          ))}
        </div>
      </section>
      <section className='grid gap-4 md:grid-cols-2'>
        {report.journeys.map((journey) => (
          <article key={journey.key} className='rounded-lg border border-neutral-200 bg-white p-5'>
            <h2 className='font-semibold'>{journey.label}</h2>
            <p className='mt-2 text-sm text-neutral-600'>Implemented: {String(journey.implemented)}</p>
            <p className='text-sm text-neutral-600'>Focused test present: {String(journey.focusedTestPresent)}</p>
            <p className='text-sm text-neutral-600'>Live verification required: {String(journey.liveVerificationRequired)}</p>
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
      <section className='rounded-lg border border-neutral-200 bg-white p-5'>
        <h2 className='font-semibold'>Pending migrations</h2>
        <ul className='mt-3 list-disc pl-5 text-sm text-neutral-700'>
          {report.metadata.migrationOrder.map((migration) => <li key={migration}>{migration}</li>)}
        </ul>
      </section>
    </main>
  )
}
