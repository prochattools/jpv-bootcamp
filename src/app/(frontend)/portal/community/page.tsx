import Link from 'next/link'

import { requirePortalMember } from '@/lib/auth/requirePortalMember'
import { getMemberCommunityDashboard } from '@/lib/payloadCourse/communityPortal'

function formatMembershipStatus(status: string | null): string | null {
  if (!status) return null
  return status.replaceAll('_', ' ')
}

export default async function PortalCommunityPage() {
  const { memberId, payload } = await requirePortalMember('/portal/community')
  const dashboard = await getMemberCommunityDashboard(payload, memberId)

  return (
    <div className='space-y-8'>
      <section>
        <p className='text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500'>Connect</p>
        <h1 className='mt-3 text-3xl font-semibold tracking-tight'>Community</h1>
        <p className='mt-3 max-w-2xl text-sm leading-6 text-neutral-600'>
          Browse the community spaces currently visible to your member account.
        </p>
      </section>

      {dashboard.spaces.length > 0 ? (
        <div className='grid gap-5 md:grid-cols-2'>
          {dashboard.spaces.map((space) => {
            const membershipStatus = formatMembershipStatus(space.membership?.status ?? null)

            return (
              <article className='rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm' key={space.id}>
                <div className='flex items-start justify-between gap-4'>
                  <div>
                    <p className='text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500'>
                      {space.spaceType ?? 'Community space'}
                    </p>
                    <h2 className='mt-2 text-xl font-semibold text-neutral-950'>{space.name}</h2>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      space.allowed
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-neutral-100 text-neutral-600'
                    }`}
                  >
                    {space.allowed ? 'Available' : 'Locked'}
                  </span>
                </div>

                {space.description ? (
                  <p className='mt-4 text-sm leading-6 text-neutral-600'>{space.description}</p>
                ) : null}

                <dl className='mt-5 grid grid-cols-2 gap-4 text-sm'>
                  <div>
                    <dt className='text-neutral-500'>Posts</dt>
                    <dd className='mt-1 font-semibold text-neutral-950'>{space.postCount ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className='text-neutral-500'>Membership</dt>
                    <dd className='mt-1 font-semibold capitalize text-neutral-950'>
                      {membershipStatus ?? (space.allowed ? 'Available' : 'Not assigned')}
                    </dd>
                  </div>
                </dl>

                {space.allowed && space.slug ? (
                  <Link
                    className='mt-6 inline-flex rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white'
                    href={`/portal/community/${space.slug}`}
                  >
                    Open space
                  </Link>
                ) : (
                  <p className='mt-6 text-sm text-neutral-500'>
                    {space.lockReason ?? 'This space is not currently available to your account.'}
                  </p>
                )}
              </article>
            )
          })}
        </div>
      ) : (
        <section className='rounded-2xl border border-dashed border-neutral-300 bg-white p-8'>
          <p className='text-sm text-neutral-600'>No community spaces are currently available.</p>
        </section>
      )}
    </div>
  )
}
