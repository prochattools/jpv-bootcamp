import { redirect } from 'next/navigation'

import { getCurrentPayloadMember } from '@/lib/members/currentMember'
import { getMemberBillingOverview } from '@/lib/payloadCourse/memberPortal'

import { PortalShell, StatusPill } from '../PortalShell'

export const metadata = {
  title: 'Billing | JPV Bootcamp',
  description: 'Review your current JPV Bootcamp plan and billing status.',
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function titleCase(value: string | null | undefined): string {
  if (!value) return 'Not available'
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

function formatDate(value: string | null): string {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return new Intl.DateTimeFormat('en', { dateStyle: 'long' }).format(date)
}

function statusTone(status: string | null): 'good' | 'warn' | 'neutral' {
  if (status === 'active' || status === 'trialing') return 'good'
  if (status === 'past_due' || status === 'unpaid' || status === 'canceled' || status === 'billing_hold') {
    return 'warn'
  }
  return 'neutral'
}

export default async function LearnBillingPage() {
  const { member, payload } = await getCurrentPayloadMember()
  if (!member) {
    redirect('/learn/login?next=/learn/billing')
  }

  const overview = await getMemberBillingOverview(payload, member.id)
  const email = typeof member.email === 'string' ? member.email : null
  const effectiveStatus = overview.subscriptionStatus ?? overview.billingStatus
  const accessEnds =
    overview.cancelAtPeriodEnd ||
    overview.subscriptionStatus === 'canceled' ||
    overview.subscriptionStatus === 'unpaid'
  const periodLabel = accessEnds ? 'Access until' : 'Renews on'

  return (
    <PortalShell memberEmail={email}>
      <main className='mx-auto max-w-7xl px-6 py-10 lg:px-10 lg:py-14'>
        <section className='rounded-[28px] border border-[#153f2e]/10 bg-white p-7 shadow-[0_18px_55px_rgba(31,52,43,0.08)] lg:p-10'>
          <div className='max-w-3xl'>
            <p className='text-xs font-bold uppercase tracking-[0.2em] text-[#8a7450]'>
              Member billing
            </p>
            <h1 className='mt-3 text-3xl font-bold tracking-tight text-[#153f2e] sm:text-4xl'>
              Plan and billing overview
            </h1>
            <p className='mt-4 text-sm leading-6 text-[#68766f] sm:text-base'>
              This page reflects the latest billing state synchronized securely from the payment provider.
            </p>
          </div>

          {overview.hasPaidSubscription ? (
            <div className='mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4'>
              <div className='rounded-2xl border border-[#153f2e]/10 bg-[#f4f1e9] p-5'>
                <p className='text-xs font-bold uppercase tracking-[0.14em] text-[#8a7450]'>Current plan</p>
                <p className='mt-3 text-2xl font-bold text-[#153f2e]'>{titleCase(overview.plan)}</p>
              </div>

              <div className='rounded-2xl border border-[#153f2e]/10 bg-[#f4f1e9] p-5'>
                <p className='text-xs font-bold uppercase tracking-[0.14em] text-[#8a7450]'>Billing status</p>
                <div className='mt-3'>
                  <StatusPill tone={statusTone(overview.billingStatus)}>
                    {titleCase(overview.billingStatus)}
                  </StatusPill>
                </div>
              </div>

              <div className='rounded-2xl border border-[#153f2e]/10 bg-[#f4f1e9] p-5'>
                <p className='text-xs font-bold uppercase tracking-[0.14em] text-[#8a7450]'>Subscription status</p>
                <div className='mt-3'>
                  <StatusPill tone={statusTone(overview.subscriptionStatus)}>
                    {titleCase(overview.subscriptionStatus)}
                  </StatusPill>
                </div>
              </div>

              <div className='rounded-2xl border border-[#153f2e]/10 bg-[#f4f1e9] p-5'>
                <p className='text-xs font-bold uppercase tracking-[0.14em] text-[#8a7450]'>{periodLabel}</p>
                <p className='mt-3 text-lg font-bold text-[#153f2e]'>{formatDate(overview.currentPeriodEnd)}</p>
              </div>
            </div>
          ) : (
            <div className='mt-8 rounded-2xl border border-dashed border-[#153f2e]/20 bg-[#f4f1e9] p-7'>
              <StatusPill tone='neutral'>Free access</StatusPill>
              <h2 className='mt-4 text-2xl font-bold text-[#153f2e]'>No paid subscription found</h2>
              <p className='mt-3 max-w-2xl text-sm leading-6 text-[#68766f]'>
                Your account does not currently have a paid JPV Bootcamp subscription in the billing mirror.
                Any course access already assigned to your member account remains visible in the learning portal.
              </p>
            </div>
          )}

          {overview.cancelAtPeriodEnd ? (
            <div className='mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900'>
              <p className='font-bold'>Cancellation scheduled</p>
              <p className='mt-2 text-sm leading-6'>
                Your subscription will not renew. Access is currently scheduled to continue through{' '}
                {formatDate(overview.currentPeriodEnd)}.
              </p>
            </div>
          ) : null}

          {overview.hasPaidSubscription && effectiveStatus && effectiveStatus !== 'active' && effectiveStatus !== 'trialing' ? (
            <div className='mt-6 rounded-2xl border border-[#153f2e]/10 bg-white p-5'>
              <p className='text-sm font-bold text-[#153f2e]'>Billing attention may be required</p>
              <p className='mt-2 text-sm leading-6 text-[#68766f]'>
                The current synchronized status is {titleCase(effectiveStatus)}. Secure billing-management actions
                will be added in a later Phase 6 slice.
              </p>
            </div>
          ) : null}
        </section>
      </main>
    </PortalShell>
  )
}
