import { redirect } from 'next/navigation'

import { getCurrentPayloadMember } from '@/lib/members/currentMember'
import { getMemberAccountOverview } from '@/lib/payloadCourse/memberPortal'

import { PasswordChangeForm } from '../PasswordChangeForm'
import { ProfileForm } from '../ProfileForm'
import { PortalShell, StatusPill } from '../PortalShell'

export const metadata = {
  title: 'My Account | JPV Bootcamp',
  description: 'Manage your JPV Bootcamp profile, access, and account security.',
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? ''
}

function titleCase(value: string | null | undefined): string {
  if (!value) return 'None'
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

function formatDate(value: string | null): string {
  if (!value) return 'Not set'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not set'
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
  }).format(date)
}

function statusTone(status: string | null | undefined): 'good' | 'warn' | 'neutral' {
  return status === 'active' || status === 'trialing' ? 'good' : status ? 'warn' : 'neutral'
}

export default async function LearnAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { member, payload } = await getCurrentPayloadMember()
  if (!member) {
    redirect('/learn/login?next=/learn/account')
  }

  const params = await searchParams
  const updated = firstParam(params.updated) === '1'
  const overview = await getMemberAccountOverview(payload, member.id)
  const email = typeof member.email === 'string' ? member.email : null
  const accountStatus = typeof member.accountStatus === 'string' ? member.accountStatus : 'pending'
  const fallbackDisplayName = email?.split('@')[0] || 'Member'

  return (
    <PortalShell memberEmail={email}>
      <main className='mx-auto max-w-7xl px-6 py-10 lg:px-10 lg:py-14'>
        <section className='grid gap-6 lg:grid-cols-[0.85fr_1.15fr]'>
          <aside className='rounded-[24px] border border-[#153f2e]/10 bg-white p-7 shadow-[0_16px_45px_rgba(31,52,43,0.08)]'>
            <p className='text-xs font-bold uppercase tracking-[0.2em] text-[#8a7450]'>
              Member account
            </p>
            <h1 className='mt-3 text-3xl font-bold tracking-tight text-[#153f2e]'>Account overview</h1>
            <p className='mt-3 text-sm leading-6 text-[#68766f]'>
              Manage your profile, access, subscriptions, and account details for JPV Bootcamp.
            </p>

            <div className='mt-6 space-y-4'>
              <div className='rounded-2xl border border-[#153f2e]/10 bg-[#f4f1e9] p-4'>
                <p className='text-xs font-bold uppercase tracking-[0.14em] text-[#8a7450]'>Email</p>
                <p className='mt-2 break-words text-sm font-semibold text-[#153f2e]'>{email ?? 'Missing email'}</p>
              </div>
              <div className='rounded-2xl border border-[#153f2e]/10 bg-[#f4f1e9] p-4'>
                <p className='text-xs font-bold uppercase tracking-[0.14em] text-[#8a7450]'>Account status</p>
                <div className='mt-3'>
                  <StatusPill tone={statusTone(accountStatus)}>{titleCase(accountStatus)}</StatusPill>
                </div>
              </div>
              <div className='rounded-2xl border border-[#153f2e]/10 bg-[#f4f1e9] p-4'>
                <p className='text-xs font-bold uppercase tracking-[0.14em] text-[#8a7450]'>Email verified</p>
                <p className='mt-2 text-sm font-semibold text-[#153f2e]'>
                  {member.emailVerifiedAt ? formatDate(String(member.emailVerifiedAt)) : 'Not verified'}
                </p>
              </div>
            </div>
          </aside>

          <section className='rounded-[24px] border border-[#153f2e]/10 bg-white p-7 shadow-[0_16px_45px_rgba(31,52,43,0.08)]'>
            <div className='flex flex-col justify-between gap-3 sm:flex-row sm:items-start'>
              <div>
                <p className='text-xs font-bold uppercase tracking-[0.2em] text-[#8a7450]'>Profile</p>
                <h2 className='mt-3 text-2xl font-bold text-[#153f2e]'>Member profile</h2>
              </div>
              {updated && (
                <p className='rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-emerald-800'>
                  Saved
                </p>
              )}
            </div>
            <div className='mt-6'>
              <ProfileForm fallbackDisplayName={fallbackDisplayName} profile={overview.profile} />
            </div>
          </section>
        </section>

        <section className='mt-8 rounded-[24px] border border-[#153f2e]/10 bg-white p-7 shadow-[0_16px_45px_rgba(31,52,43,0.08)]'>
          <p className='text-xs font-bold uppercase tracking-[0.2em] text-[#8a7450]'>Security</p>
          <h2 className='mt-3 text-2xl font-bold text-[#153f2e]'>Change password</h2>
          <p className='mt-2 text-sm leading-6 text-[#68766f]'>
            Confirm your current password before choosing a new one.
          </p>
          <div className='mt-6'>
            <PasswordChangeForm />
          </div>
        </section>

        <section className='mt-8 grid gap-6 lg:grid-cols-3'>
          <article className='rounded-[24px] border border-[#153f2e]/10 bg-white p-7 shadow-[0_16px_45px_rgba(31,52,43,0.08)]'>
            <p className='text-xs font-bold uppercase tracking-[0.2em] text-[#8a7450]'>Billing</p>
            <h2 className='mt-3 text-2xl font-bold text-[#153f2e]'>Billing projection</h2>
            <div className='mt-5 space-y-3 text-sm text-[#68766f]'>
              <p>
                Status:{' '}
                <span className='font-semibold text-[#153f2e]'>
                  {titleCase(overview.billingAccount?.billingStatus)}
                </span>
              </p>
              <p>
                Stripe mode:{' '}
                <span className='font-semibold text-[#153f2e]'>
                  {titleCase(overview.billingAccount?.stripeMode)}
                </span>
              </p>
              <p>
                Updated:{' '}
                <span className='font-semibold text-[#153f2e]'>
                  {formatDate(overview.billingAccount?.updatedAt ?? null)}
                </span>
              </p>
            </div>
            <p className='mt-5 text-xs leading-5 text-[#7b8982]'>
              Billing changes still remain on the existing payment flow until Payload becomes authoritative.
            </p>
          </article>

          <article className='rounded-[24px] border border-[#153f2e]/10 bg-white p-7 shadow-[0_16px_45px_rgba(31,52,43,0.08)]'>
            <p className='text-xs font-bold uppercase tracking-[0.2em] text-[#8a7450]'>Subscriptions</p>
            <h2 className='mt-3 text-2xl font-bold text-[#153f2e]'>Access plans</h2>
            <div className='mt-5 space-y-3'>
              {overview.subscriptions.length > 0 ? (
                overview.subscriptions.map((subscription) => (
                  <div className='rounded-2xl border border-[#153f2e]/10 bg-[#f4f1e9] p-4' key={subscription.id}>
                    <div className='flex items-center justify-between gap-3'>
                      <p className='text-sm font-bold text-[#153f2e]'>{titleCase(subscription.plan)}</p>
                      <StatusPill tone={statusTone(subscription.status)}>{titleCase(subscription.status)}</StatusPill>
                    </div>
                    <p className='mt-2 text-xs text-[#68766f]'>
                      Renews/ends: {formatDate(subscription.currentPeriodEnd)}
                      {subscription.cancelAtPeriodEnd ? ' · canceling' : ''}
                    </p>
                  </div>
                ))
              ) : (
                <p className='text-sm leading-6 text-[#68766f]'>No Payload subscription projection exists yet.</p>
              )}
            </div>
          </article>

          <article className='rounded-[24px] border border-[#153f2e]/10 bg-white p-7 shadow-[0_16px_45px_rgba(31,52,43,0.08)]'>
            <p className='text-xs font-bold uppercase tracking-[0.2em] text-[#8a7450]'>Groups</p>
            <h2 className='mt-3 text-2xl font-bold text-[#153f2e]'>Access groups</h2>
            <div className='mt-5 flex flex-wrap gap-2'>
              {overview.groups.length > 0 ? (
                overview.groups.map((group) => (
                  <StatusPill key={group.id} tone='neutral'>
                    {group.name}
                  </StatusPill>
                ))
              ) : (
                <p className='text-sm leading-6 text-[#68766f]'>No active group memberships are projected yet.</p>
              )}
            </div>
          </article>
        </section>
      </main>
    </PortalShell>
  )
}
