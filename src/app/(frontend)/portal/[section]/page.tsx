import { notFound } from 'next/navigation'

import { requirePortalMember } from '@/lib/auth/requirePortalMember'
import { getMemberAccountOverview } from '@/lib/payloadCourse/memberPortal'

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
}

function isPortalSection(value: string): value is PortalSection {
  return value === 'community' || value === 'groups' || value === 'account' || value === 'billing'
}

function displayValue(value: string | null): string {
  return value?.trim() || 'Not provided'
}

export default async function PortalSectionPage({ params }: PortalSectionPageProps) {
  const { section } = await params
  if (!isPortalSection(section)) notFound()

  const { memberId, payload } = await requirePortalMember(`/portal/${section}`)

  if (section === 'account') {
    const account = await getMemberAccountOverview(payload, memberId)

    return (
      <div className='space-y-8'>
        <section>
          <p className='text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500'>Profile</p>
          <h1 className='mt-3 text-3xl font-semibold tracking-tight'>Account</h1>
          <p className='mt-3 max-w-2xl text-sm leading-6 text-neutral-600'>
            Review the profile details currently associated with your member account.
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
