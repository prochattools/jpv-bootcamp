import Link from 'next/link'
import { notFound } from 'next/navigation'

import { StatusPill } from '@/components/portal/StatusPill'
import { requirePortalMember } from '@/lib/auth/requirePortalMember'
import { getMemberCommunitySpaceDetail } from '@/lib/payloadCourse/communityPortal'

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
      <Link className='text-sm font-bold text-[#6c5a36] hover:text-[#153f2e]' href='/portal/community'>
        Back to community
      </Link>

      <section className='rounded-[28px] bg-[#153f2e] p-8 text-white shadow-[0_24px_70px_rgba(20,55,40,0.18)] sm:p-10 lg:p-14'>
        <div className='flex flex-wrap gap-3'>
          <StatusPill tone={detail.allowed ? 'good' : 'warn'}>{detail.allowed ? 'Unlocked' : 'Locked'}</StatusPill>
          <StatusPill tone='neutral'>{detail.visibility}</StatusPill>
          {detail.membership?.role && <StatusPill tone='neutral'>{detail.membership.role}</StatusPill>}
        </div>

        <h1 className='mt-7 text-4xl font-bold leading-tight tracking-tight sm:text-5xl'>{detail.name}</h1>
        <p className='mt-5 max-w-2xl text-base leading-7 text-[#d5e0da] sm:text-lg'>
          {detail.description ?? 'Space description pending.'}
        </p>
        <p className='mt-4 text-sm text-[#d5e0da]'>{memberEmail}</p>
      </section>

      {query.submission === 'pending' && (
        <div className='rounded-[18px] border border-[#2f7355]/20 bg-[#eaf4ee] px-5 py-4 text-sm font-semibold text-[#24543f]'>
          Community posting is not enabled in this launch preview.
        </div>
      )}
      {query.submission === 'error' && (
        <div className='rounded-[18px] border border-[#9c5c4f]/20 bg-[#f8ece8] px-5 py-4 text-sm font-semibold text-[#78463d]'>
          Community posting is not enabled in this launch preview.
        </div>
      )}

      {detail.allowed ? (
        <>
          <section className='rounded-[24px] border border-[#153f2e]/10 bg-white p-7 shadow-[0_14px_35px_rgba(31,52,43,0.07)] sm:p-8'>
            <p className='text-xs font-bold uppercase tracking-[0.2em] text-[#8a7450]'>Launch preview</p>
            <h2 className='mt-2 text-2xl font-bold text-[#153f2e]'>Read-only member view</h2>
            <p className='mt-3 max-w-2xl text-sm leading-6 text-[#68766f]'>
              Visible spaces and approved discussions are shown from persisted Payload data. Member posting,
              replies, uploads, and moderation actions remain deferred outside this launch preview.
            </p>
          </section>

          <section>
            <div className='flex flex-col justify-between gap-4 sm:flex-row sm:items-end'>
              <div>
                <p className='text-xs font-bold uppercase tracking-[0.2em] text-[#8a7450]'>Discussions</p>
                <h2 className='mt-2 text-3xl font-bold tracking-tight text-[#153f2e]'>Visible posts</h2>
              </div>
              <p className='max-w-sm text-sm leading-6 text-[#68766f]'>
                Open a discussion to read its approved rich-text content and visible replies. Moderator submissions enter review first.
              </p>
            </div>

            <div className='mt-8 space-y-4'>
              {detail.posts.length > 0 ? (
                detail.posts.map((post) => (
                  <Link
                    className='block rounded-[22px] border border-[#153f2e]/10 bg-white p-6 shadow-[0_14px_35px_rgba(31,52,43,0.07)] transition hover:-translate-y-0.5 hover:border-[#8a7450]/40'
                    href={`/portal/community/${encodedSpaceSlug}/posts/${encodeURIComponent(post.id)}`}
                    key={post.id}
                  >
                    <article>
                      <div className='flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-[0.14em] text-[#8a7450]'>
                        {post.pinned && <span>Pinned</span>}
                        <span>{post.postType ?? 'discussion'}</span>
                        <span>{formatDate(post.createdAt)}</span>
                      </div>
                      <h3 className='mt-3 text-xl font-bold text-[#153f2e]'>{post.title}</h3>
                      <p className='mt-3 text-sm text-[#68766f]'>{post.commentCount} visible comments</p>
                    </article>
                  </Link>
                ))
              ) : (
                <div className='rounded-[22px] border border-[#153f2e]/10 bg-white p-8 text-[#68766f]'>
                  No visible posts are published in this space yet.
                </div>
              )}
            </div>
          </section>
        </>
      ) : (
        <section className='rounded-[24px] border border-[#153f2e]/10 bg-white p-8 shadow-[0_14px_35px_rgba(31,52,43,0.07)]'>
          <h2 className='text-2xl font-bold text-[#153f2e]'>This space is locked</h2>
          <p className='mt-3 max-w-2xl text-sm leading-6 text-[#68766f]'>{detail.lockReason}</p>
          {detail.canRequestAccess && (
            <p className='mt-5 text-xs font-bold uppercase tracking-[0.14em] text-[#8a7450]'>
              Request flow pending admin approval
            </p>
          )}
        </section>
      )}
    </div>
  )
}
