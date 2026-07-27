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

function ReadinessCell({ label, value }: { label: string; value: boolean }) {
  return (
    <div className='rounded-jpv-card border border-jpv-border bg-jpv-canvas p-4'>
      <p className='text-xs font-semibold uppercase tracking-[0.14em] text-jpv-muted'>{label}</p>
      <p className={`mt-1 text-lg font-bold ${value ? 'text-jpv-green' : 'text-jpv-danger'}`}>
        {value ? 'Yes' : 'No'}
      </p>
    </div>
  )
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
    <main className='mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6'>
      <section className='space-y-2'>
        <p className='jpv-eyebrow'>Release · Operator</p>
        <h1 className='text-2xl font-semibold tracking-tight text-jpv-ink'>Cross-domain shadow validation</h1>
        <p className='max-w-2xl text-sm leading-6 text-jpv-muted'>Read-only repository readiness and cutover evidence.</p>
      </section>

      <section className='grid gap-4 sm:grid-cols-4'>
        <ReadinessCell label='Repository ready' value={report.repositoryReady} />
        <ReadinessCell label='Configuration ready' value={report.configurationReady} />
        <ReadinessCell label='Cutover ready' value={report.cutoverReady} />
        <div className='rounded-jpv-card border border-jpv-border bg-jpv-canvas p-4'>
          <p className='text-xs font-semibold uppercase tracking-[0.14em] text-jpv-muted'>Snapshot</p>
          <p className='mt-1 text-sm font-medium text-jpv-ink'>{report.evidence.generatedAt}</p>
        </div>
      </section>

      <section className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-5 sm:p-6'>
        <h2 className='font-semibold text-jpv-ink'>Collection counts</h2>
        <div className='mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
          {Object.entries(report.evidence.collectionCounts).map(([name, count]) => (
            <article key={name} className='rounded-jpv-card border border-jpv-border px-4 py-3'>
              <p className='text-sm font-medium text-jpv-ink'>{name}</p>
              <p className='mt-0.5 text-sm text-jpv-muted'>Count: {count}</p>
            </article>
          ))}
        </div>
        <div className='mt-4 flex flex-wrap gap-6 text-sm text-jpv-muted'>
          <span>Truncated: <strong className='text-jpv-ink'>{report.evidence.truncatedCollections.length}</strong></span>
          <span>Read failures: <strong className='text-jpv-ink'>{report.evidence.readFailures.length}</strong></span>
        </div>
      </section>

      <section className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-5 sm:p-6'>
        <div className='flex flex-wrap items-center justify-between gap-4'>
          <h2 className='font-semibold text-jpv-ink'>Admin evidence</h2>
          <a className='jpv-button-secondary min-h-11 px-4 text-sm' href='/api/admin/shadow-validation/evidence'>
            Download JSON
          </a>
        </div>
      </section>

      <section className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-5 sm:p-6'>
        <h2 className='font-semibold text-jpv-ink'>Domain totals</h2>
        <div className='mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
          {Object.entries(report.domains).map(([domain, summary]) => (
            <article key={domain} className='rounded-jpv-card border border-jpv-border px-4 py-3'>
              <p className='text-sm font-semibold capitalize text-jpv-ink'>{domain}</p>
              <p className={`mt-0.5 text-sm font-medium ${summary.ready ? 'text-jpv-green' : 'text-jpv-danger'}`}>
                Ready: {String(summary.ready)}
              </p>
              <p className='text-sm text-jpv-muted'>Issues: {summary.issueCount}</p>
            </article>
          ))}
        </div>
      </section>

      <section className='grid gap-4 md:grid-cols-2'>
        {report.journeys.map((journey) => (
          <article key={journey.key} className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-5'>
            <h2 className='font-semibold text-jpv-ink'>{journey.label}</h2>
            <dl className='mt-3 space-y-1 text-sm'>
              <div className='flex gap-2'>
                <dt className='text-jpv-muted'>Implemented:</dt>
                <dd className={journey.implemented ? 'font-semibold text-jpv-green' : 'text-jpv-danger'}>{String(journey.implemented)}</dd>
              </div>
              <div className='flex gap-2'>
                <dt className='text-jpv-muted'>Focused test:</dt>
                <dd className={journey.focusedTestPresent ? 'font-semibold text-jpv-green' : 'text-jpv-muted'}>{String(journey.focusedTestPresent)}</dd>
              </div>
              <div className='flex gap-2'>
                <dt className='text-jpv-muted'>Live verification:</dt>
                <dd className='text-jpv-ink'>{String(journey.liveVerificationRequired)}</dd>
              </div>
            </dl>
          </article>
        ))}
      </section>

      <section className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-5 sm:p-6'>
        <h2 className='font-semibold text-jpv-ink'>Issues</h2>
        {report.issues.length > 0 ? (
          <div className='mt-4 space-y-3'>
            {report.issues.map((issue) => (
              <article
                key={`${issue.domain}:${issue.code}:${issue.detail}`}
                className='rounded-jpv-card border border-jpv-danger/30 bg-jpv-danger-surface px-4 py-3'
              >
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <p className='text-sm font-semibold text-jpv-danger-ink'>{issue.code}</p>
                  <p className='text-xs uppercase tracking-wide text-jpv-muted'>{issue.domain} / {issue.severity}</p>
                </div>
                <p className='mt-1 text-sm text-jpv-ink'>{issue.detail}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className='mt-2 text-sm text-jpv-muted'>No issues recorded.</p>
        )}
      </section>

      <section className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-5 sm:p-6'>
        <h2 className='font-semibold text-jpv-ink'>Pending migrations</h2>
        {report.metadata.migrationOrder.length > 0 ? (
          <ul className='mt-3 list-disc pl-5 text-sm text-jpv-ink'>
            {report.metadata.migrationOrder.map((migration) => (
              <li key={migration}>{migration}</li>
            ))}
          </ul>
        ) : (
          <p className='mt-2 text-sm text-jpv-muted'>No pending migrations.</p>
        )}
      </section>
    </main>
  )
}
