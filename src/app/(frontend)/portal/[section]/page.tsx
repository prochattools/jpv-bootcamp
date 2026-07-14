import { revalidatePath } from 'next/cache'
import { notFound, redirect } from 'next/navigation'

import { resolveMemberVerificationPublicBaseUrl } from '@/lib/auth/memberEmailVerificationApplication'
import { requirePortalMember } from '@/lib/auth/requirePortalMember'
import { updateMemberProfile } from '@/lib/members/updateMemberProfile'
import type { PayloadCourseWriteAPI } from '@/lib/payloadCourse/accessService'
import {
  getMemberAccountOverview,
  getMemberBillingOverview,
} from '@/lib/payloadCourse/memberPortal'
import { BillingPortalButton } from '@/components/portal/BillingPortalButton'
import { MemberCheckoutButtons } from '@/components/portal/MemberCheckoutButtons'
import { getBillingStatus } from '@/lib/billing/billingStatusHelper'
import { requestMembershipCancellation } from '@/lib/actions/requestMembershipCancellation'
import { resolvePortalBillingPresentation } from '@/lib/portal/portalBillingPresentation'

import { EmailChangeForm } from '@/components/member/EmailChangeForm'
import { PasswordChangeForm } from '@/components/member/PasswordChangeForm'

const sectionContent = {
  community: {
    eyebrow: 'Connect',
    title: 'Community',
    description: 'Community spaces and announcements will appear here as they become available to your account.',
  },
  billing: {
    eyebrow: 'Membership',
    title: 'Billing',
    description: 'Subscription status, invoices, and billing self-service will be available here.',
  },
} as const

type PortalSection = 'community' | 'groups' | 'account' | 'billing'

type PortalSectionPageProps = {
  params: Promise<{ section: string }>
  searchParams?: Promise<{
    updated?: string
    error?: string
    checkout?: string
    cancellation_requested?: string
    cancellation_effective_at?: string
    cancellation_error?: string
  }>
}

function isPortalSection(value: string): value is PortalSection {
  return value === 'community' || value === 'groups' || value === 'account' || value === 'billing'
}

function displayValue(value: string | null): string {
  return value?.trim() || 'Not provided'
}

function formText(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value : ''
}

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? ''
}

function titleCase(value: string | null | undefined): string {
  if (!value) return 'Not available'
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

function formatDate(value: string | Date | null): string {
  if (!value) return 'Not available'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'long',
  }).format(date)
}

function accountStatusTone(status: string | null | undefined): 'good' | 'warn' | 'neutral' {
  return status === 'active' || status === 'trialing' ? 'good' : status ? 'warn' : 'neutral'
}

function currentTier(overview: Awaited<ReturnType<typeof getMemberAccountOverview>>): string {
  const subscription = overview.subscriptions.find((item) => item.status === 'active' || item.status === 'trialing')
  const plan = typeof subscription?.plan === 'string' ? subscription.plan : null
  if (plan === 'pro' || plan === 'free') {
    return plan.slice(0, 1).toUpperCase() + plan.slice(1)
  }
  return 'Free'
}

function billingNotice(query: {
  checkout?: string
  cancellation_requested?: string
  cancellation_effective_at?: string
  cancellation_error?: string
}): { tone: 'neutral' | 'success' | 'error'; message: string } | null {
  const checkout = firstParam(query.checkout)
  const cancellationRequested = firstParam(query.cancellation_requested)
  const cancellationEffectiveAt = firstParam(query.cancellation_effective_at)
  const cancellationError = firstParam(query.cancellation_error)

  if (checkout === 'success') {
    return {
      tone: 'success',
      message: 'Checkout completed. Billing updates can take a moment to appear in your account.',
    }
  }
  if (checkout === 'cancelled') {
    return {
      tone: 'neutral',
      message: 'Checkout was cancelled before any subscription change was confirmed.',
    }
  }
  if (cancellationRequested === '1') {
    const effectiveLabel = formatDate(cancellationEffectiveAt || null)
    return {
      tone: 'success',
      message:
        effectiveLabel === 'Not available'
          ? 'Your end-of-term cancellation request has been recorded.'
          : `Your end-of-term cancellation request has been recorded. Effective date: ${effectiveLabel}.`,
    }
  }
  if (cancellationError === 'billing_record_missing' || cancellationError === 'effective_date_missing') {
    return {
      tone: 'error',
      message: 'Unable to record your cancellation request right now. Try again from this page.',
    }
  }
  if (cancellationError === 'invalid_email') {
    return {
      tone: 'error',
      message: 'Unable to confirm your billing identity right now. Sign in again and retry.',
    }
  }
  return null
}

async function updatePortalMemberProfileAction(formData: FormData) {
  'use server'

  const { memberId, payload } = await requirePortalMember('/portal/account')
  const result = await updateMemberProfile(payload as unknown as PayloadCourseWriteAPI, memberId, {
    displayName: formText(formData.get('displayName')),
    company: formText(formData.get('company')),
    phone: formText(formData.get('phone')),
    timezone: formText(formData.get('timezone')),
    baseUrl: resolveMemberVerificationPublicBaseUrl(),
  })

  if (!result.ok) redirect('/portal/account?error=display-name')

  revalidatePath('/portal/account')
  redirect('/portal/account?updated=1')
}

export default async function PortalSectionPage({ params, searchParams }: PortalSectionPageProps) {
  const { section } = await params
  if (!isPortalSection(section)) notFound()

  const { memberId, memberEmail, payload } = await requirePortalMember(`/portal/${section}`)

  if (section === 'account') {
    const [account, memberRecord, query] = await Promise.all([
      getMemberAccountOverview(payload, memberId),
      payload.findByID({
        collection: 'payload_members',
        id: memberId,
        depth: 0,
        overrideAccess: true,
      }),
      searchParams ?? Promise.resolve<{ updated?: string; error?: string }>({}),
    ])
    const accountStatus =
      typeof memberRecord.accountStatus === 'string' ? memberRecord.accountStatus : 'pending'
    const emailVerifiedAt =
      typeof memberRecord.emailVerifiedAt === 'string' || memberRecord.emailVerifiedAt instanceof Date
        ? String(memberRecord.emailVerifiedAt)
        : null
    const fallbackDisplayName = memberEmail.split('@')[0] || 'Member'

    return (
      <div className='space-y-8'>
        <section>
          <p className='text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500'>Profile</p>
          <h1 className='mt-3 text-3xl font-semibold tracking-tight'>Account</h1>
          <p className='mt-3 max-w-2xl text-sm leading-6 text-neutral-600'>
            Manage your member profile, access, subscriptions, and account security.
          </p>
        </section>

        <section className='rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm'>
          <dl className='grid gap-6 sm:grid-cols-2 xl:grid-cols-4'>
            <div>
              <dt className='text-sm font-medium text-neutral-500'>Email</dt>
              <dd className='mt-2 text-base font-semibold text-neutral-950'>
                {memberEmail}
              </dd>
            </div>
            <div>
              <dt className='text-sm font-medium text-neutral-500'>Account status</dt>
              <dd className='mt-2 text-base font-semibold text-neutral-950'>
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-sm ${
                    accountStatusTone(accountStatus) === 'good'
                      ? 'bg-emerald-100 text-emerald-900'
                      : accountStatusTone(accountStatus) === 'warn'
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-neutral-100 text-neutral-800'
                  }`}
                >
                  {titleCase(accountStatus)}
                </span>
              </dd>
            </div>
            <div>
              <dt className='text-sm font-medium text-neutral-500'>Member tier</dt>
              <dd className='mt-2 text-base font-semibold text-neutral-950'>
                {currentTier(account)}
              </dd>
            </div>
            <div>
              <dt className='text-sm font-medium text-neutral-500'>Email verified</dt>
              <dd className='mt-2 text-base font-semibold text-neutral-950'>
                {emailVerifiedAt ? formatDate(emailVerifiedAt) : 'Not verified'}
              </dd>
            </div>
          </dl>
        </section>

        <section className='rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm'>
          <div>
            <h2 className='text-xl font-semibold text-neutral-950'>Edit profile</h2>
            <p className='mt-2 text-sm leading-6 text-neutral-600'>
              These details are used in your member experience. Internal notes and access settings cannot be changed here.
            </p>
          </div>

          <div className='mt-5' aria-live='polite'>
            {query.updated === '1' ? (
              <p className='rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800'>
                Your profile has been updated.
              </p>
            ) : null}
            {query.error === 'display-name' ? (
              <p className='rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800'>
                Enter a display name before saving your profile.
              </p>
            ) : null}
          </div>

          <form action={updatePortalMemberProfileAction} className='mt-6 grid gap-5 sm:grid-cols-2'>
            <label className='text-sm font-medium text-neutral-800'>
              Display name
              <input
                name='displayName'
                type='text'
                required
                maxLength={80}
                defaultValue={account.profile?.displayName ?? fallbackDisplayName}
                className='mt-2 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-950'
              />
            </label>
            <label className='text-sm font-medium text-neutral-800'>
              Company
              <input
                name='company'
                type='text'
                maxLength={100}
                defaultValue={account.profile?.company ?? ''}
                className='mt-2 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-950'
              />
            </label>
            <label className='text-sm font-medium text-neutral-800'>
              Phone
              <input
                name='phone'
                type='tel'
                maxLength={40}
                defaultValue={account.profile?.phone ?? ''}
                className='mt-2 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-950'
              />
            </label>
            <label className='text-sm font-medium text-neutral-800'>
              Timezone
              <input
                name='timezone'
                type='text'
                maxLength={80}
                defaultValue={account.profile?.timezone ?? ''}
                className='mt-2 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-950'
              />
            </label>
            <div className='sm:col-span-2'>
              <button
                type='submit'
                className='rounded-lg bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800'
              >
                Save profile
              </button>
            </div>
          </form>
        </section>

        <section className='grid gap-6 lg:grid-cols-2'>
          <article className='rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm'>
            <div>
              <p className='text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500'>Security</p>
              <h2 className='mt-3 text-2xl font-semibold text-neutral-950'>Change password</h2>
              <p className='mt-2 text-sm leading-6 text-neutral-600'>
                Confirm your current password before choosing a new one.
              </p>
            </div>
            <div className='mt-6'>
              <PasswordChangeForm />
            </div>
          </article>

          <article className='rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm'>
            <div>
              <p className='text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500'>Sign-in email</p>
              <h2 className='mt-3 text-2xl font-semibold text-neutral-950'>Change email address</h2>
              <p className='mt-2 text-sm leading-6 text-neutral-600'>
                Confirm a new address before it replaces your current sign-in email.
              </p>
            </div>
            <div className='mt-6'>
              <EmailChangeForm />
            </div>
          </article>
        </section>

        <section className='grid gap-6 lg:grid-cols-3'>
          <article className='rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm'>
            <p className='text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500'>Billing</p>
            <h2 className='mt-3 text-2xl font-semibold text-neutral-950'>Billing projection</h2>
            <div className='mt-5 space-y-3 text-sm text-neutral-600'>
              <p>
                Status:{' '}
                <span className='font-semibold text-neutral-950'>
                  {titleCase(account.billingAccount?.billingStatus)}
                </span>
              </p>
              <p>
                Stripe mode:{' '}
                <span className='font-semibold text-neutral-950'>
                  {titleCase(account.billingAccount?.stripeMode)}
                </span>
              </p>
              <p>
                Updated:{' '}
                <span className='font-semibold text-neutral-950'>
                  {formatDate(account.billingAccount?.updatedAt ?? null)}
                </span>
              </p>
            </div>
            <p className='mt-5 text-xs leading-5 text-neutral-500'>
              This is the member billing mirror used to project access and subscription state.
            </p>
          </article>

          <article className='rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm'>
            <p className='text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500'>Subscriptions</p>
            <h2 className='mt-3 text-2xl font-semibold text-neutral-950'>Access plans</h2>
            <div className='mt-5 space-y-3'>
              {account.subscriptions.length > 0 ? (
                account.subscriptions.map((subscription) => (
                  <div className='rounded-2xl border border-neutral-200 bg-neutral-50 p-4' key={subscription.id}>
                    <div className='flex items-center justify-between gap-3'>
                      <p className='text-sm font-semibold text-neutral-950'>{titleCase(subscription.plan)}</p>
                      <span className='rounded-full bg-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-800'>
                        {titleCase(subscription.status)}
                      </span>
                    </div>
                    <p className='mt-2 text-xs text-neutral-600'>
                      Renews/ends: {formatDate(subscription.currentPeriodEnd)}
                      {subscription.cancelAtPeriodEnd ? ' · canceling' : ''}
                    </p>
                  </div>
                ))
              ) : (
                <p className='text-sm leading-6 text-neutral-600'>No billing projection exists yet for this account.</p>
              )}
            </div>
          </article>

          <article className='rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm'>
            <p className='text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500'>Groups</p>
            <h2 className='mt-3 text-2xl font-semibold text-neutral-950'>Access groups</h2>
            <div className='mt-5 flex flex-wrap gap-2'>
              {account.groups.length > 0 ? (
                account.groups.map((group) => (
                  <span
                    className='rounded-full bg-neutral-100 px-3 py-1 text-sm font-medium text-neutral-800'
                    key={group.id}
                  >
                    {group.name}
                  </span>
                ))
              ) : (
                <p className='text-sm leading-6 text-neutral-600'>No active group memberships are projected yet.</p>
              )}
            </div>
          </article>
        </section>
      </div>
    )
  }

  if (section === 'groups') {
    const account = await getMemberAccountOverview(payload, memberId)

    return (
      <div className='space-y-8'>
        <section>
          <p className='text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500'>Access</p>
          <h1 className='mt-3 text-3xl font-semibold tracking-tight'>Groups</h1>
          <p className='mt-3 max-w-2xl text-sm leading-6 text-neutral-600'>
            Groups and cohorts currently available to your member account.
          </p>
        </section>

        {account.groups.length > 0 ? (
          <div className='grid gap-4 sm:grid-cols-2'>
            {account.groups.map((group) => (
              <article className='rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm' key={group.id}>
                <h2 className='text-lg font-semibold text-neutral-950'>{group.name}</h2>
                <p className='mt-2 text-sm text-neutral-600'>Active member group</p>
              </article>
            ))}
          </div>
        ) : (
          <section className='rounded-2xl border border-dashed border-neutral-300 bg-white p-8'>
            <p className='text-sm text-neutral-600'>No groups are currently assigned to this account.</p>
          </section>
        )}
      </div>
    )
  }

  if (section === 'billing') {
    const [query, billingStatus, billingOverview] = await Promise.all([
      searchParams ?? Promise.resolve<{
        checkout?: string
        cancellation_requested?: string
        cancellation_effective_at?: string
        cancellation_error?: string
      }>({}),
      getBillingStatus(memberEmail),
      getMemberBillingOverview(payload, memberId),
    ])
    const presentation = resolvePortalBillingPresentation(billingStatus, billingOverview)
    const notice = billingNotice(query)

    return (
      <div className='space-y-8'>
        <section>
          <p className='text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500'>Membership</p>
          <h1 className='mt-3 text-3xl font-semibold tracking-tight'>Billing</h1>
          <p className='mt-3 max-w-2xl text-sm leading-6 text-neutral-600'>
            Manage your subscription, invoices, and payment methods through our secure billing portal.
          </p>
        </section>

        {notice ? (
          <section aria-live='polite'>
            <p
              className={`rounded-2xl px-4 py-3 text-sm ${
                notice.tone === 'success'
                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-900'
                  : notice.tone === 'error'
                    ? 'border border-red-200 bg-red-50 text-red-900'
                    : 'border border-neutral-200 bg-neutral-50 text-neutral-800'
              }`}
            >
              {notice.message}
            </p>
          </section>
        ) : null}

        {billingStatus.showPaymentWarning && (
          <section
            role='alert'
            className='rounded-2xl border border-amber-300 bg-amber-50 p-6 text-amber-950'
          >
            <h2 className='text-lg font-semibold'>Payment needs attention</h2>
            <p className='mt-2 text-sm leading-6'>
              We could not process a recent membership payment. Review your billing details in the secure billing portal.
            </p>
            {billingStatus.paymentFailedAt && (
              <p className='mt-2 text-xs text-amber-800'>
                Last detected on{' '}
                {new Intl.DateTimeFormat('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                }).format(billingStatus.paymentFailedAt)}.
              </p>
            )}
          </section>
        )}

        {billingStatus.showRefundNotice && (
          <section className='rounded-2xl border border-sky-200 bg-sky-50 p-6 text-sky-950'>
            <h2 className='text-lg font-semibold'>Refund recorded</h2>
            <p className='mt-2 text-sm leading-6'>
              A recent membership payment was refunded. This does not change access by itself; subscription status remains authoritative.
            </p>
          </section>
        )}

        {billingStatus.showDisputeNotice && (
          <section role='alert' className='rounded-2xl border border-orange-300 bg-orange-50 p-6 text-orange-950'>
            <h2 className='text-lg font-semibold'>Payment under review</h2>
            <p className='mt-2 text-sm leading-6'>
              A recent membership payment is under dispute review. This does not change access by itself.
            </p>
          </section>
        )}

        {presentation.projectionSyncState === 'status_missing' ? (
          <section className='rounded-2xl border border-sky-200 bg-sky-50 p-6 text-sky-950'>
            <h2 className='text-lg font-semibold'>Billing status is syncing</h2>
            <p className='mt-2 text-sm leading-6'>
              Your member billing mirror shows subscription history, but the operational billing projection is not yet available.
              Checkout remains disabled until the authoritative billing status is ready.
            </p>
          </section>
        ) : null}

        {presentation.projectionSyncState === 'projection_missing' ? (
          <section className='rounded-2xl border border-neutral-200 bg-neutral-50 p-6 text-neutral-900'>
            <h2 className='text-lg font-semibold'>Billing projection pending</h2>
            <p className='mt-2 text-sm leading-6 text-neutral-700'>
              Your operational billing status is available. The member billing mirror is still catching up and may not show the latest subscription summary yet.
            </p>
          </section>
        ) : null}

        {billingStatus.hasActiveSubscription ? (
          <>
            <section className='rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm'>
              <h2 className='text-lg font-semibold text-neutral-950'>Subscription status</h2>
              <dl className='mt-6 grid gap-6 sm:grid-cols-2'>
                {presentation.displayPlanLabel && (
                  <div>
                    <dt className='text-sm font-medium text-neutral-500'>Current plan</dt>
                    <dd className='mt-2 text-base font-semibold text-neutral-950'>
                      {presentation.displayPlanLabel}
                    </dd>
                  </div>
                )}
                {presentation.displaySubscriptionStatus && (
                  <div>
                    <dt className='text-sm font-medium text-neutral-500'>Status</dt>
                    <dd className='mt-2 text-base font-semibold text-neutral-950'>
                      {titleCase(presentation.displaySubscriptionStatus)}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className='text-sm font-medium text-neutral-500'>Membership access</dt>
                  <dd className='mt-2 text-base font-semibold text-neutral-950'>
                    {billingStatus.billingAccessState === 'available'
                      ? 'Available'
                      : billingStatus.billingAccessState === 'billing_hold'
                        ? 'On billing hold'
                        : billingStatus.billingAccessState === 'inactive'
                          ? 'Inactive'
                          : 'Pending billing status'}
                  </dd>
                </div>
                {presentation.displayPeriodEndDate && (
                  <div>
                    <dt className='text-sm font-medium text-neutral-500'>
                      {billingStatus.cancelAtPeriodEnd ? 'Cancels on' : 'Renews on'}
                    </dt>
                    <dd className='mt-2 text-base font-semibold text-neutral-950'>
                      {formatDate(presentation.displayPeriodEndDate)}
                    </dd>
                  </div>
                )}
                {presentation.billingCadenceLabel && (
                  <div>
                    <dt className='text-sm font-medium text-neutral-500'>Billing cadence</dt>
                    <dd className='mt-2 text-base font-semibold text-neutral-950'>
                      {presentation.billingCadenceLabel}
                    </dd>
                  </div>
                )}
                {presentation.commitmentStatusLabel && (
                  <div>
                    <dt className='text-sm font-medium text-neutral-500'>Commitment state</dt>
                    <dd className='mt-2 text-base font-semibold text-neutral-950'>
                      {presentation.commitmentStatusLabel}
                    </dd>
                  </div>
                )}
                {billingStatus.commitmentStartAt && (
                  <div>
                    <dt className='text-sm font-medium text-neutral-500'>Commitment started</dt>
                    <dd className='mt-2 text-base font-semibold text-neutral-950'>
                      {new Intl.DateTimeFormat('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      }).format(billingStatus.commitmentStartAt)}
                    </dd>
                  </div>
                )}
                {billingStatus.commitmentEndAt && (
                  <div>
                    <dt className='text-sm font-medium text-neutral-500'>Initial commitment ends</dt>
                    <dd className='mt-2 text-base font-semibold text-neutral-950'>
                      {new Intl.DateTimeFormat('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      }).format(billingStatus.commitmentEndAt)}
                    </dd>
                  </div>
                )}
                {billingStatus.cancellationEffectiveAt && (
                  <div>
                    <dt className='text-sm font-medium text-neutral-500'>Cancellation effective</dt>
                    <dd className='mt-2 text-base font-semibold text-neutral-950'>
                      {new Intl.DateTimeFormat('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      }).format(billingStatus.cancellationEffectiveAt)}
                    </dd>
                  </div>
                )}
              </dl>
              {billingStatus.cancelAtPeriodEnd && (
                <p className='mt-6 border-t border-neutral-200 pt-6 text-sm text-neutral-600'>
                  Your subscription is scheduled to cancel at the end of the current billing period.
                </p>
              )}
            </section>

            <section className='rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm'>
              <h2 className='text-lg font-semibold text-neutral-950'>Manage subscription</h2>
              {billingStatus.restrictedPortalRequired ? (
                <p className='mt-2 text-sm leading-6 text-neutral-600'>
                  Your Pro Monthly membership is within its initial 12-month commitment. You can
                  update payment details and view invoices in the secure billing portal. Plan changes
                  require support review, and an ordinary cancellation request takes effect at the
                  commitment end date shown above.
                </p>
              ) : (
                <p className='mt-2 text-sm text-neutral-600'>
                  Update payment methods, view invoices, and manage period-end cancellation.
                </p>
              )}
              <div className='mt-6 flex flex-wrap gap-3'>
                <BillingPortalButton />
                {billingStatus.restrictedPortalRequired &&
                  billingStatus.commitmentStatus !== 'cancellation_requested' && (
                    <form action={requestMembershipCancellation}>
                      <button
                        type='submit'
                        className='rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50'
                      >
                        Request end-of-term cancellation
                      </button>
                    </form>
                  )}
              </div>
              {billingStatus.commitmentStatus === 'cancellation_requested' && (
                <p className='mt-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900'>
                  Your cancellation request is recorded. Billing and access continue while payments
                  remain current, and cancellation takes effect on the date shown above.
                </p>
              )}
            </section>

            <section className='rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm'>
              <h2 className='text-lg font-semibold text-neutral-950'>Billing projection summary</h2>
              <p className='mt-2 text-sm leading-6 text-neutral-600'>
                Operational billing controls use the current billing status. This section shows the member billing mirror used for entitlement projection and account summaries.
              </p>
              <dl className='mt-6 grid gap-6 sm:grid-cols-2'>
                <div>
                  <dt className='text-sm font-medium text-neutral-500'>Projected plan</dt>
                  <dd className='mt-2 text-base font-semibold text-neutral-950'>
                    {presentation.overviewPlanLabel}
                  </dd>
                </div>
                <div>
                  <dt className='text-sm font-medium text-neutral-500'>Projected billing status</dt>
                  <dd className='mt-2 text-base font-semibold text-neutral-950'>
                    {titleCase(billingOverview.billingStatus)}
                  </dd>
                </div>
                <div>
                  <dt className='text-sm font-medium text-neutral-500'>Projected subscription status</dt>
                  <dd className='mt-2 text-base font-semibold text-neutral-950'>
                    {titleCase(presentation.overviewSubscriptionStatus)}
                  </dd>
                </div>
                <div>
                  <dt className='text-sm font-medium text-neutral-500'>Projected renewal/end date</dt>
                  <dd className='mt-2 text-base font-semibold text-neutral-950'>
                    {formatDate(presentation.overviewPeriodEndDate)}
                  </dd>
                </div>
              </dl>
            </section>
          </>
        ) : (
          <div className='space-y-6'>
            <section className='rounded-2xl border border-dashed border-neutral-300 bg-white p-8'>
              <h2 className='text-lg font-semibold text-neutral-950'>No paid subscription found</h2>
              <p className='mt-2 max-w-2xl text-sm leading-6 text-neutral-600'>
                Your account does not currently have a paid JPV Bootcamp subscription in the billing mirror.
                Any course access already assigned to your member account remains visible in the portal.
              </p>
            </section>
            {presentation.allowCheckout ? (
              <section className='rounded-2xl border border-dashed border-neutral-300 bg-white p-8'>
                <h2 className='text-lg font-semibold text-neutral-950'>Choose a membership</h2>
                <p className='mt-2 text-sm text-neutral-600'>
                  Start a secure Stripe checkout for the membership that fits you.
                </p>
                <div className='mt-6'>
                  <MemberCheckoutButtons />
                </div>
              </section>
            ) : null}
            {billingStatus.hasBillingAccount && (
              <section className='rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm'>
                <h2 className='text-lg font-semibold text-neutral-950'>Existing billing account</h2>
                <p className='mt-2 text-sm text-neutral-600'>
                  Review payment methods or previous invoices in the secure billing portal.
                </p>
                <div className='mt-6'>
                  <BillingPortalButton />
                </div>
              </section>
            )}
            <section className='rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm'>
              <h2 className='text-lg font-semibold text-neutral-950'>Billing projection summary</h2>
              {presentation.hasProjectionData ? (
                <dl className='mt-6 grid gap-6 sm:grid-cols-2'>
                  <div>
                    <dt className='text-sm font-medium text-neutral-500'>Projected plan</dt>
                    <dd className='mt-2 text-base font-semibold text-neutral-950'>
                      {presentation.overviewPlanLabel}
                    </dd>
                  </div>
                  <div>
                    <dt className='text-sm font-medium text-neutral-500'>Projected billing status</dt>
                    <dd className='mt-2 text-base font-semibold text-neutral-950'>
                      {titleCase(billingOverview.billingStatus)}
                    </dd>
                  </div>
                  <div>
                    <dt className='text-sm font-medium text-neutral-500'>Projected subscription status</dt>
                    <dd className='mt-2 text-base font-semibold text-neutral-950'>
                      {titleCase(presentation.overviewSubscriptionStatus)}
                    </dd>
                  </div>
                  <div>
                    <dt className='text-sm font-medium text-neutral-500'>Projected renewal/end date</dt>
                    <dd className='mt-2 text-base font-semibold text-neutral-950'>
                      {formatDate(presentation.overviewPeriodEndDate)}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className='mt-2 text-sm text-neutral-600'>
                  No member billing projection exists yet for this account.
                </p>
              )}
            </section>
          </div>
        )}
      </div>
    )
  }

  const content = sectionContent[section]

  return (
    <div className='space-y-8'>
      <section>
        <p className='text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500'>{content.eyebrow}</p>
        <h1 className='mt-3 text-3xl font-semibold tracking-tight'>{content.title}</h1>
        <p className='mt-3 max-w-2xl text-sm leading-6 text-neutral-600'>{content.description}</p>
      </section>

      <section className='rounded-2xl border border-dashed border-neutral-300 bg-white p-8'>
        <p className='text-sm font-medium text-neutral-700'>This protected member section is ready for its next implementation phase.</p>
      </section>
    </div>
  )
}
