import { revalidatePath } from 'next/cache'
import { notFound, redirect } from 'next/navigation'

import { resolveMemberVerificationPublicBaseUrl } from '@/lib/auth/memberEmailVerificationApplication'
import { requirePortalMember } from '@/lib/auth/requirePortalMember'
import { updateMemberProfile } from '@/lib/members/updateMemberProfile'
import type { PayloadCourseWriteAPI } from '@/lib/payloadCourse/accessService'
import { getMemberAccountOverview } from '@/lib/payloadCourse/memberPortal'
import { BillingPortalButton } from '@/components/portal/BillingPortalButton'
import { MemberCheckoutButtons } from '@/components/portal/MemberCheckoutButtons'
import { getBillingStatus } from '@/lib/billing/billingStatusHelper'

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
  searchParams?: Promise<{ updated?: string; error?: string }>
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
    const [account, query] = await Promise.all([
      getMemberAccountOverview(payload, memberId),
      searchParams ?? Promise.resolve<{ updated?: string; error?: string }>({}),
    ])

    return (
      <div className='space-y-8'>
        <section>
          <p className='text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500'>Profile</p>
          <h1 className='mt-3 text-3xl font-semibold tracking-tight'>Account</h1>
          <p className='mt-3 max-w-2xl text-sm leading-6 text-neutral-600'>
            Review and update the profile details associated with your member account.
          </p>
        </section>

        <section className='rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm'>
          <dl className='grid gap-6 sm:grid-cols-2'>
            <div>
              <dt className='text-sm font-medium text-neutral-500'>Display name</dt>
              <dd className='mt-2 text-base font-semibold text-neutral-950'>
                {displayValue(account.profile?.displayName ?? null)}
              </dd>
            </div>
            <div>
              <dt className='text-sm font-medium text-neutral-500'>Company</dt>
              <dd className='mt-2 text-base font-semibold text-neutral-950'>
                {displayValue(account.profile?.company ?? null)}
              </dd>
            </div>
            <div>
              <dt className='text-sm font-medium text-neutral-500'>Phone</dt>
              <dd className='mt-2 text-base font-semibold text-neutral-950'>
                {displayValue(account.profile?.phone ?? null)}
              </dd>
            </div>
            <div>
              <dt className='text-sm font-medium text-neutral-500'>Timezone</dt>
              <dd className='mt-2 text-base font-semibold text-neutral-950'>
                {displayValue(account.profile?.timezone ?? null)}
              </dd>
            </div>
          </dl>

          {!account.profile ? (
            <p className='mt-6 border-t border-neutral-200 pt-6 text-sm text-neutral-600'>
              No member profile has been completed yet.
            </p>
          ) : null}
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
                defaultValue={account.profile?.displayName ?? ''}
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
    const billingStatus = await getBillingStatus(memberEmail)

    return (
      <div className='space-y-8'>
        <section>
          <p className='text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500'>Membership</p>
          <h1 className='mt-3 text-3xl font-semibold tracking-tight'>Billing</h1>
          <p className='mt-3 max-w-2xl text-sm leading-6 text-neutral-600'>
            Manage your subscription, invoices, and payment methods through our secure billing portal.
          </p>
        </section>

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

        {billingStatus.hasActiveSubscription ? (
          <>
            <section className='rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm'>
              <h2 className='text-lg font-semibold text-neutral-950'>Subscription status</h2>
              <dl className='mt-6 grid gap-6 sm:grid-cols-2'>
                {billingStatus.planLabel && (
                  <div>
                    <dt className='text-sm font-medium text-neutral-500'>Current plan</dt>
                    <dd className='mt-2 text-base font-semibold text-neutral-950'>
                      {billingStatus.planLabel}
                    </dd>
                  </div>
                )}
                {billingStatus.subscriptionStatus && (
                  <div>
                    <dt className='text-sm font-medium text-neutral-500'>Status</dt>
                    <dd className='mt-2 text-base font-semibold text-neutral-950'>
                      {billingStatus.subscriptionStatus.charAt(0).toUpperCase() +
                        billingStatus.subscriptionStatus.slice(1)}
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
                {billingStatus.periodEndDate && (
                  <div>
                    <dt className='text-sm font-medium text-neutral-500'>
                      {billingStatus.cancelAtPeriodEnd ? 'Cancels on' : 'Renews on'}
                    </dt>
                    <dd className='mt-2 text-base font-semibold text-neutral-950'>
                      {new Intl.DateTimeFormat('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      }).format(billingStatus.periodEndDate)}
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
              <p className='mt-2 text-sm text-neutral-600'>
                Update payment methods, view invoices, and adjust your subscription settings.
              </p>
              <div className='mt-6'>
                <BillingPortalButton />
              </div>
            </section>
          </>
        ) : (
          <div className='space-y-6'>
            <section className='rounded-2xl border border-dashed border-neutral-300 bg-white p-8'>
              <h2 className='text-lg font-semibold text-neutral-950'>Choose a membership</h2>
              <p className='mt-2 text-sm text-neutral-600'>
                Start a secure Stripe checkout for the membership that fits you.
              </p>
              <div className='mt-6'>
                <MemberCheckoutButtons />
              </div>
            </section>
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
