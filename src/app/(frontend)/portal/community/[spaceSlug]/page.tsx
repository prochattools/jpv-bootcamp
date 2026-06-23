import Link from 'next/link'
import { notFound } from 'next/navigation'

import { requirePortalMember } from '@/lib/auth/requirePortalMember'
import { getMemberCommunitySpaceDetail } from '@/lib/payloadCourse/communityPortal'

type CommunitySpacePageProps = {
  params: Promise<{ spaceSlug: string }>
}

function formatDate(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
  }).format(date)
}

export default async function PortalCommunitySpacePage({ params }: CommunitySpacePageProps) {
  const { spaceSlug } = await params
  const requestedPath = `/portal/community/${spaceSlug}`
  const { memberId, payload } = await requirePortalMember(requestedPath)
  const space = await getMemberCommunitySpaceDetail(payload, memberId, spaceSlug)

  if (!space) notFound()

  return (
    <div className='space-y-8'>
      <Link
        className='inline-flex text-sm font-semibold text-neutral-700 underline-offset-4 hover:text-neutral-950 hover:underline'
        href='/portal/community'
      >
        ← Back to community
      </Link>

      <section className='rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm'>
        <div className='flex flex-col gap-5 md:flex-row md:items-start md:justify-between'>
          <div className='max-w-3xl'>
            <p className='text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500'>
              {space.spaceType ?? 'Community space'}
            </p>
            <h1 className='mt-3 text-3xl font-semibold tracking-tight'>{space.name}</h1>
            {space.description ? (
              <p className='mt-4 text-sm leading-6 text-neutral-600'>{space.description}</p>
            ) : null}
          </div>

          <div className='flex flex-wrap gap-2 text-xs font-semibold'>
            <span
              className={`rounded-full px-3 py-1 ${
                space.allowed
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-neutral-100 text-neutral-600'
              }`}
            >
              {space.allowed ? 'Available' : 'Locked'}
            </span>
            {space.membership?.status ? (
              <span className='rounded-full bg-neutral-100 px-3 py-1 capitalize text-neutral-700'>
                {space.membership.status.replaceAll('_', ' ')}
              </span>
            ) : null}
          </div>
        </div>
      </section>

      {!space.allowed ? (
        <section className='rounded-2xl border border-amber-200 bg-amber-50 p-6'>
          <h2 className='font-semibold text-amber-950'>This community space is currently locked</h2>
          <p className='mt-2 text-sm text-amber-900'>
            {space.lockReason ?? 'Your account does not currently include access to this space.'}
          </p>
        </section>
      ) : space.posts.length > 0 ? (
        <section className='space-y-4'>
          <div>
            <h2 className='text-2xl font-semibold'>Posts</h2>
            <p className='mt-2 text-sm text-neutral-600'>Recent content available in this community space.</p>
          </div>

          <div className='space-y-4'>
            {space.posts.map((post) => {
              const createdAt = formatDate(post.createdAt)

              return (
                <article className='rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm' key={post.id}>
                  <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                    <div>
                      <div className='flex flex-wrap items-center gap-2'>
                        {post.pinned ? (
                          <span className='rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700'>
                            Pinned
                          </span>
                        ) : null}
                        {post.postType ? (
                          <span className='rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold capitalize text-neutral-700'>
                            {post.postType.replaceAll('_', ' ')}
                          </span>
                        ) : null}
                      </div>
                      <h3 className='mt-3 text-lg font-semibold text-neutral-950'>{post.title}</h3>
                    </div>

                    <div className='text-sm text-neutral-500 sm:text-right'>
                      {createdAt ? <p>{createdAt}</p> : null}
                      <p className='mt-1'>
                        {post.commentCount} comment{post.commentCount === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      ) : (
        <section className='rounded-2xl border border-dashed border-neutral-300 bg-white p-8'>
          <p className='text-sm text-neutral-600'>No posts are currently available in this space.</p>
        </section>
      )}
    </div>
  )
}
