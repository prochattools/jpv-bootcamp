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
  if (subscription?.plan === 'jpv_bootcamp_membership') return 'JPV Bootcamp Membership'
  return 'No active membership'
}

const portalFieldClass =
  'mt-2 w-full rounded-jpv-control border border-jpv-border bg-jpv-canvas px-4 py-3 text-sm text-jpv-ink outline-none transition focus:border-jpv-green-deep focus:ring-2 focus:ring-jpv-green/25'

const portalCardClass = 'rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-5 shadow-jpv-card sm:p-6'

function PortalSectionNavigation({
  label,
  links,
}: {
  label: string
  links: ReadonlyArray<{ href: string; title: string }>
}) {
  return (
    <nav aria-label={label} className='flex gap-2 overflow-x-auto border-b border-jpv-border pb-3'>
      {links.map((link) => (
        <a
          className='jpv-button-secondary min-h-11 shrink-0 px-4'
          href={link.href}
          key={link.href}
        >
          {link.title}
        </a>
      ))}
    </nav>
  )
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

  let errorParam = 'unexpected'
  try {
    const { memberId, payload } = await requirePortalMember('/portal/account')
    const result = await updateMemberProfile(payload as unknown as PayloadCourseWriteAPI, memberId, {
      displayName: formText(formData.get('displayName')),
      company: formText(formData.get('company')),
      phone: formText(formData.get('phone')),
      timezone: formText(formData.get('timezone')),
      baseUrl: resolveMemberVerificationPublicBaseUrl(),
    })

    if (!result.ok) {
      const failedResult = result as { ok: false; error: string }
      errorParam = failedResult.error === 'display_name_required' ? 'display-name' : 'ineligible'
      redirect(`/portal/account?error=${errorParam}`)
    }

    revalidatePath('/portal/account')
    redirect('/portal/account?updated=1')
  } catch (thrown) {
    if (thrown && typeof thrown === 'object' && 'digest' in thrown) throw thrown
    console.error('[updatePortalMemberProfileAction] error:', thrown instanceof Error ? thrown.message : String(thrown))
    redirect(`/portal/account?error=${errorParam}`)
  }
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
      <div className='space-y-6'>
        <section className='grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end'>
          <div>
            <p className='jpv-eyebrow'>Profile</p>
            <h1 className='mt-2 text-3xl font-semibold tracking-tight text-jpv-ink'>Account</h1>
            <p className='mt-2 max-w-2xl text-sm leading-6 text-jpv-muted'>
              Manage your profile, sign-in email, password, and account security.
            </p>
          </div>
          <div className='rounded-jpv-card border border-jpv-border bg-jpv-surface px-4 py-3 text-sm'>
            <span className='text-jpv-muted'>Membership</span>
            <strong className='ml-2 text-jpv-ink'>{currentTier(account)}</strong>
          </div>
        </section>

        <PortalSectionNavigation
          label='Account sections'
          links={[
            { href: '#profile', title: 'Profile' },
            { href: '#password', title: 'Password' },
            { href: '#email', title: 'Email' },
          ]}
        />

        <section className={portalCardClass} id='profile'>
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
                      ? 'bg-emerald-50 text-emerald-700'
                      : accountStatusTone(accountStatus) === 'warn'
                        ? 'bg-jpv-sunshine/20 text-jpv-sunshine-ink'
                        : 'bg-jpv-surface text-jpv-ink'
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

        <section className={portalCardClass}>
          <div>
            <h2 className='text-xl font-semibold text-jpv-ink'>Edit profile</h2>
            <p className='mt-2 text-sm leading-6 text-neutral-600'>
              These details are used in your member experience. Internal notes and access settings cannot be changed here.
            </p>
          </div>

          <div className='mt-5' aria-live='polite'>
            {query.updated === '1' ? (
              <p className='jpv-notice'>
                Your profile has been updated.
              </p>
            ) : null}
            {query.error === 'display-name' ? (
              <p className='jpv-notice jpv-notice-danger'>
                Enter a display name before saving your profile.
              </p>
            ) : query.error === 'ineligible' ? (
              <p className='jpv-notice jpv-notice-danger'>
                Your account is not eligible to update profile settings right now. Contact support if this persists.
              </p>
            ) : query.error === 'unexpected' ? (
              <p className='jpv-notice jpv-notice-danger'>
                An unexpected error occurred while saving your profile. Please try again.
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
                className={portalFieldClass}
              />
            </label>
            <label className='text-sm font-medium text-neutral-800'>
              Company
              <input
                name='company'
                type='text'
                maxLength={100}
                defaultValue={account.profile?.company ?? ''}
                className={portalFieldClass}
              />
            </label>
            <label className='text-sm font-medium text-neutral-800'>
              Phone
              <input
                name='phone'
                type='tel'
                maxLength={40}
                defaultValue={account.profile?.phone ?? ''}
                className={portalFieldClass}
              />
            </label>
            <label className='text-sm font-medium text-neutral-800'>
              Timezone
              <input
                name='timezone'
                type='text'
                maxLength={80}
                defaultValue={account.profile?.timezone ?? ''}
                className={portalFieldClass}
              />
            </label>
            <div className='sm:col-span-2'>
              <button
                type='submit'
                className='jpv-button-primary min-h-11'
              >
                Save profile
              </button>
            </div>
          </form>
        </section>

        <section className='grid gap-6 lg:grid-cols-2'>
          <article className={portalCardClass} id='password'>
            <div>
              <p className='jpv-eyebrow'>Security</p>
              <h2 className='mt-2 text-2xl font-semibold text-jpv-ink'>Change password</h2>
              <p className='mt-2 text-sm leading-6 text-neutral-600'>
                Confirm your current password before choosing a new one.
              </p>
            </div>
            <div className='mt-6'>
              <PasswordChangeForm />
            </div>
          </article>

          <article className={portalCardClass} id='email'>
            <div>
              <p className='jpv-eyebrow'>Sign-in email</p>
              <h2 className='mt-2 text-2xl font-semibold text-jpv-ink'>Change email address</h2>
              <p className='mt-2 text-sm leading-6 text-neutral-600'>
                Confirm a new address before it replaces your current sign-in email.
              </p>
            </div>
            <div className='mt-6'>
              <EmailChangeForm />
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
      <div className='space-y-6'>
        <section className='grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end'>
          <div>
            <p className='jpv-eyebrow'>Membership</p>
            <h1 className='mt-2 text-3xl font-semibold tracking-tight text-jpv-ink'>Billing</h1>
            <p className='mt-2 max-w-2xl text-sm leading-6 text-jpv-muted'>
              Review your membership, renewal status, invoices, and secure payment settings.
            </p>
          </div>
          <div className='rounded-jpv-card border border-jpv-border bg-jpv-surface px-4 py-3 text-sm'>
            <span className='text-jpv-muted'>Current membership</span>
            <strong className='ml-2 text-jpv-ink'>{presentation.displayPlanLabel ?? 'JPV Bootcamp Membership'}</strong>
          </div>
        </section>

        <PortalSectionNavigation
          label='Billing sections'
          links={[
            { href: '#status', title: 'Status' },
            { href: '#manage', title: 'Manage' },
            { href: '#projection', title: 'Details' },
          ]}
        />

        {notice ? (
          <section aria-live='polite'>
            <p
              className={notice.tone === 'error' ? 'jpv-notice jpv-notice-danger' : 'jpv-notice'}
            >
              {notice.message}
            </p>
          </section>
        ) : null}

        {billingStatus.showPaymentWarning && (
          <section
            role='alert'
            className='jpv-notice jpv-notice-danger p-5'
          >
            <h2 className='text-lg font-semibold'>Payment needs attention</h2>
            <p className='mt-2 text-sm leading-6'>
              We could not process a recent membership payment. Review your billing details in the secure billing portal.
            </p>
            {billingStatus.paymentFailedAt && (
              <p className='mt-2 text-xs text-jpv-danger-ink'>
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
          <section className='jpv-notice p-5'>
            <h2 className='text-lg font-semibold'>Refund recorded</h2>
            <p className='mt-2 text-sm leading-6'>
              A recent membership payment was refunded. This does not change access by itself; subscription status remains authoritative.
            </p>
          </section>
        )}

        {billingStatus.showDisputeNotice && (
          <section role='alert' className='jpv-notice jpv-notice-danger p-5'>
            <h2 className='text-lg font-semibold'>Payment under review</h2>
            <p className='mt-2 text-sm leading-6'>
              A recent membership payment is under dispute review. This does not change access by itself.
            </p>
          </section>
        )}

        {presentation.projectionSyncState === 'status_missing' ? (
          <section className='jpv-notice p-5'>
            <h2 className='text-lg font-semibold'>Billing status is syncing</h2>
            <p className='mt-2 text-sm leading-6'>
              Your member billing mirror shows subscription history, but the operational billing projection is not yet available.
              Checkout remains disabled until the authoritative billing status is ready.
            </p>
          </section>
        ) : null}

        {presentation.projectionSyncState === 'projection_missing' ? (
          <section className='jpv-notice p-5'>
            <h2 className='text-lg font-semibold'>Billing projection pending</h2>
            <p className='mt-2 text-sm leading-6 text-neutral-700'>
              Your operational billing status is available. The member billing mirror is still catching up and may not show the latest subscription summary yet.
            </p>
          </section>
        ) : null}

        {billingStatus.hasActiveSubscription ? (
          <>
            <section className={portalCardClass} id='status'>
              <h2 className='text-lg font-semibold text-jpv-ink'>Subscription status</h2>
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

            <section className={portalCardClass} id='manage'>
              <h2 className='text-lg font-semibold text-jpv-ink'>Manage subscription</h2>
              {billingStatus.restrictedPortalRequired ? (
                <p className='mt-2 text-sm leading-6 text-neutral-600'>
                  Your JPV Bootcamp Membership is within its initial 12-month commitment. You can
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
                        className='jpv-button-secondary min-h-11'
                      >
                        Request end-of-term cancellation
                      </button>
                    </form>
                  )}
              </div>
              {billingStatus.commitmentStatus === 'cancellation_requested' && (
                <p className='jpv-notice mt-4'>
                  Your cancellation request is recorded. Billing and access continue while payments
                  remain current, and cancellation takes effect on the date shown above.
                </p>
              )}
            </section>

            <section className={portalCardClass} id='projection'>
              <h2 className='text-lg font-semibold text-jpv-ink'>Billing details</h2>
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
            <section className={portalCardClass} id='projection'>
              <h2 className='text-lg font-semibold text-jpv-ink'>Billing details</h2>
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
