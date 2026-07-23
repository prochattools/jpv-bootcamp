import Link from 'next/link'
import { notFound } from 'next/navigation'

import { StatusPill } from '@/components/portal/StatusPill'
import { requirePortalMember } from '@/lib/auth/requirePortalMember'
import { getMemberCommunitySpaceDetail } from '@/lib/payloadCourse/communityPortal'
import { submitCommunityPost } from '../actions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{
    spaceSlug: string
  }>
  searchParams: Promise<{
    submission?: string
  }>
}

function formatDate(value: string | null) {
  if (!value) return 'Date pending'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date pending'
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

export default async function PortalCommunitySpacePage({ params, searchParams }: PageProps) {
  const [{ spaceSlug }, query] = await Promise.all([params, searchParams])
  const encodedSpaceSlug = encodeURIComponent(spaceSlug)
  const { memberId, memberEmail, payload } = await requirePortalMember(`/portal/community/${encodedSpaceSlug}`)

  const detail = await getMemberCommunitySpaceDetail(payload, memberId, spaceSlug)
  if (!detail) notFound()

  return (
    <div className='mx-auto max-w-5xl space-y-10'>
      <Link className='text-sm font-bold text-[var(--jpv-sunshine-ink)] hover:text-[var(--jpv-brand-deep)]' href='/portal/community'>
        Back to community
      </Link>

      <section className='rounded-jpv-panel bg-[var(--jpv-brand-deep)] p-8 text-white shadow-jpv-card sm:p-10 lg:p-14'>
        <div className='flex flex-wrap gap-3'>
          <StatusPill tone={detail.allowed ? 'good' : 'warn'}>{detail.allowed ? 'Unlocked' : 'Locked'}</StatusPill>
          <StatusPill tone='neutral'>{detail.visibility}</StatusPill>
          {detail.membership?.role && <StatusPill tone='neutral'>{detail.membership.role}</StatusPill>}
        </div>

        <h1 className='mt-7 text-4xl font-bold leading-tight tracking-tight sm:text-5xl'>{detail.name}</h1>
        <p className='mt-5 max-w-2xl text-base leading-7 text-[var(--jpv-inverse-muted)] sm:text-lg'>
          {detail.description ?? 'Space description pending.'}
        </p>
        <p className='mt-4 text-sm text-[var(--jpv-inverse-muted)]'>{memberEmail}</p>
      </section>

      {query.submission === 'pending' && (
        <div className='rounded-jpv-card border border-[var(--jpv-brand)]/20 bg-[var(--jpv-surface-strong)] px-5 py-4 text-sm font-semibold text-[var(--jpv-brand-deep)]'>
          Your post has been submitted for review.
        </div>
      )}
      {query.submission === 'error' && (
        <div className='rounded-jpv-card border border-[var(--jpv-danger)]/20 bg-[var(--jpv-danger-surface)] px-5 py-4 text-sm font-semibold text-[var(--jpv-danger-ink)]'>
          Something went wrong. Please try again.
        </div>
      )}

      {detail.allowed ? (
        <>
          {detail.membership?.status === 'active' && (
            <section className='rounded-jpv-panel border border-[var(--jpv-brand-deep)]/10 bg-white p-7 shadow-jpv-card sm:p-8'>
              <h2 className='text-2xl font-bold text-[var(--jpv-brand-deep)]'>Start a discussion</h2>
              <form
                action={submitCommunityPost.bind(null, spaceSlug)}
                className='mt-5 space-y-4'
              >
                <div>
                  <label className='block text-sm font-bold text-[var(--jpv-brand-deep)]' htmlFor='post-title'>
                    Title
                  </label>
                  <input
                    className='mt-1.5 w-full rounded-jpv-input border border-[var(--jpv-brand-deep)]/20 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--jpv-brand)]'
                    id='post-title'
                    maxLength={160}
                    name='title'
                    placeholder='What would you like to discuss?'
                    required
                    type='text'
                  />
                </div>
                <div>
                  <label className='block text-sm font-bold text-[var(--jpv-brand-deep)]' htmlFor='post-body'>
                    Body
                  </label>
                  <textarea
                    className='mt-1.5 w-full rounded-jpv-input border border-[var(--jpv-brand-deep)]/20 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--jpv-brand)]'
                    id='post-body'
                    maxLength={10000}
                    name='body'
                    placeholder='Share your thoughts, questions, or insights…'
                    required
                    rows={5}
                  />
                </div>
                <button
                  className='rounded-full bg-[var(--jpv-brand-deep)] px-6 py-3 text-sm font-bold text-white transition hover:bg-[var(--jpv-brand-hover)]'
                  type='submit'
                >
                  Post discussion
                </button>
              </form>
            </section>
          )}

          <section>
            <div className='flex flex-col justify-between gap-4 sm:flex-row sm:items-end'>
              <div>
                <p className='text-xs font-bold uppercase tracking-[0.2em] text-[var(--jpv-sunshine-ink)]'>Discussions</p>
                <h2 className='mt-2 text-3xl font-bold tracking-tight text-[var(--jpv-brand-deep)]'>Visible posts</h2>
              </div>
              <p className='max-w-sm text-sm leading-6 text-[var(--jpv-muted)]'>
                Open a discussion to read its approved rich-text content and visible replies. Moderator submissions enter review first.
              </p>
            </div>

            <div className='mt-8 space-y-4'>
              {detail.posts.length > 0 ? (
                detail.posts.map((post) => (
                  <Link
                    className='block rounded-jpv-card border border-[var(--jpv-brand-deep)]/10 bg-white p-6 shadow-jpv-card transition hover:-translate-y-0.5 hover:border-[var(--jpv-sunshine-ink)]/40'
                    href={`/portal/community/${encodedSpaceSlug}/posts/${encodeURIComponent(post.id)}`}
                    key={post.id}
                  >
                    <article>
                      <div className='flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-[0.14em] text-[var(--jpv-sunshine-ink)]'>
                        {post.pinned && <span>Pinned</span>}
                        <span>{post.postType ?? 'discussion'}</span>
                        <span>{formatDate(post.createdAt)}</span>
                      </div>
                      <h3 className='mt-3 text-xl font-bold text-[var(--jpv-brand-deep)]'>{post.title}</h3>
                      <p className='mt-3 text-sm text-[var(--jpv-muted)]'>{post.commentCount} visible comments</p>
                    </article>
                  </Link>
                ))
              ) : (
                <div className='rounded-jpv-card border border-[var(--jpv-brand-deep)]/10 bg-white p-8 text-[var(--jpv-muted)]'>
                  No visible posts are published in this space yet.
                </div>
              )}
            </div>
          </section>
        </>
      ) : (
        <section className='rounded-jpv-panel border border-[var(--jpv-brand-deep)]/10 bg-white p-8 shadow-jpv-card'>
          <h2 className='text-2xl font-bold text-[var(--jpv-brand-deep)]'>This space is locked</h2>
          <p className='mt-3 max-w-2xl text-sm leading-6 text-[var(--jpv-muted)]'>{detail.lockReason}</p>
          {detail.canRequestAccess && (
            <p className='mt-5 text-xs font-bold uppercase tracking-[0.14em] text-[var(--jpv-sunshine-ink)]'>
              Request flow pending admin approval
            </p>
          )}
        </section>
      )}
    </div>
  )
}
