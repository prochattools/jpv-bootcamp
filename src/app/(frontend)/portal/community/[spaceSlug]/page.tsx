import Link from 'next/link'
import { notFound } from 'next/navigation'

import { StatusPill } from '@/components/portal/StatusPill'
import { CommunityPostCard } from '@/components/community/CommunityPostCard'
import { ComposerToolbar } from '@/components/community/ComposerToolbar'
import { requirePortalAccess } from '@/lib/auth/requirePortalAccess'
import { getMemberCommunitySpaceDetail, withQueryDedup, type MemberCommunityPost } from '@/lib/payloadCourse/communityPortal'
import { listSpaceLiveCalls } from '@/lib/liveSessions/memberSessions'
import { submitCommunityPost } from '../actions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{
    spaceSlug: string
  }>
  searchParams: Promise<{
    submission?: string
    reason?: string
  }>
}

export default async function PortalCommunitySpacePage({ params, searchParams }: PageProps) {
  const [{ spaceSlug }, query] = await Promise.all([params, searchParams])
  const encodedSpaceSlug = encodeURIComponent(spaceSlug)
  const { actor, payload } = await requirePortalAccess(`/portal/community/${encodedSpaceSlug}`)
  const isAdmin = actor.kind === 'admin'
  const memberId = actor.kind === 'member' ? actor.memberId : ''
  const memberEmail = actor.kind === 'member' ? actor.email : ''

  let detail = await getMemberCommunitySpaceDetail(withQueryDedup(payload), memberId, spaceSlug)
  if (!detail) notFound()

  // Admin override: bypass space membership gate and fetch posts directly with real data
  if (isAdmin && !detail.allowed) {
    const adminPostsResult = await payload.find({
      collection: 'payload_space_posts',
      where: {
        space: { equals: detail.id },
      },
      sort: '-createdAt',
      limit: 50,
      depth: 0,
      overrideAccess: true,
    })

    const postIds = adminPostsResult.docs.map((p) => String(p.id))

    // Collect unique author IDs from posts to batch-fetch names
    const resolveDocId = (val: unknown): string | null => {
      if (typeof val === 'string') return val
      if (val && typeof val === 'object' && 'id' in val) return String((val as { id: unknown }).id)
      return null
    }

    const authorIds = new Set<string>()
    for (const p of adminPostsResult.docs) {
      const aid = resolveDocId(p.author)
      if (aid) authorIds.add(aid)
    }

    // Batch-fetch member display names
    const authorMap = new Map<string, string>()
    if (authorIds.size > 0) {
      const members = await payload.find({
        collection: 'payload_members',
        where: { id: { in: Array.from(authorIds) } },
        limit: authorIds.size + 10,
        depth: 0,
        overrideAccess: true,
      })
      for (const m of members.docs) {
        const display = m.displayName ?? m.fullName ?? m.name
        const name =
          typeof display === 'string' && display.trim()
            ? display.trim().slice(0, 120)
            : [
                typeof m.firstName === 'string' ? m.firstName : '',
                typeof m.lastName === 'string' ? m.lastName : '',
              ]
                .filter(Boolean)
                .join(' ')
                .trim() || 'Community member'
        authorMap.set(String(m.id), name)
      }
    }

    // Fetch comment counts per post in a single batch query
    const commentCountMap = new Map<string, number>()
    if (postIds.length > 0) {
      const commentsResult = await payload.find({
        collection: 'payload_space_comments',
        where: { post: { in: postIds } },
        limit: 2000,
        depth: 0,
        overrideAccess: true,
      })
      for (const c of commentsResult.docs) {
        const pid = resolveDocId(c.post)
        if (pid) {
          commentCountMap.set(pid, (commentCountMap.get(pid) ?? 0) + 1)
        }
      }
    }

    detail = {
      ...detail,
      allowed: true,
      // Admin has no membership in the space — they bypass access control, not join it.
      membership: null,
      posts: adminPostsResult.docs.map((p): MemberCommunityPost => {
        const aid = resolveDocId(p.author)
        return {
          id: String(p.id),
          title: String(p.title ?? ''),
          postType: typeof p.postType === 'string' ? p.postType : null,
          pinned: Boolean(p.pinned),
          createdAt: p.createdAt ? String(p.createdAt) : null,
          commentCount: commentCountMap.get(String(p.id)) ?? 0,
          authorName: aid ? (authorMap.get(aid) ?? 'Community member') : 'Community member',
          excerpt: null,
          moderationStatus: typeof p.moderationStatus === 'string' ? p.moderationStatus : null,
        }
      }),
    }
  }

  const liveCalls = detail.allowed
    ? await listSpaceLiveCalls(payload, detail.id)
    : []
  const activeCalls = liveCalls.filter((c) => c.status === 'live' || c.status === 'scheduled')

  // Legacy design contract: <div className='space-y-8'>
  return (
    <div className='mx-auto w-full max-w-6xl space-y-8'>
      <nav aria-label='Community path' className='flex min-h-11 flex-wrap items-center gap-2 text-sm'>
        <Link className='font-bold text-jpv-sunshine-ink underline-offset-4 hover:text-jpv-brand-deep hover:underline' href='/portal/community'>
          Back to community
        </Link>
        {detail.linkedCourseSlug ? (
          <>
            <span aria-hidden='true' className='text-jpv-muted'>/</span>
            <Link className='font-semibold text-jpv-muted underline-offset-4 hover:text-jpv-brand-deep hover:underline' href={`/portal/courses/${detail.linkedCourseSlug}`}>
              Related course
            </Link>
          </>
        ) : null}
        <span aria-hidden='true' className='text-jpv-muted'>/</span>
        <span className='text-jpv-muted'>{detail.name}</span>
      </nav>

      <section aria-labelledby='community-space-heading' className='rounded-jpv-panel bg-jpv-brand-deep p-6 text-jpv-canvas shadow-jpv-card sm:p-10 lg:p-12'>
        <div className='flex flex-wrap gap-3'>
          <StatusPill tone={detail.allowed ? 'good' : 'warn'}>{detail.allowed ? 'Unlocked' : 'Locked'}</StatusPill>
          <StatusPill tone='neutral'>{detail.visibility}</StatusPill>
          {detail.membership?.role && <StatusPill tone='neutral'>{detail.membership.role}</StatusPill>}
        </div>

        <h1 className='mt-7 text-4xl font-bold leading-tight tracking-tight sm:text-5xl' id='community-space-heading'>{detail.name}</h1>
        <p className='mt-5 max-w-2xl text-base leading-7 text-jpv-inverse-muted sm:text-lg'>
          {detail.description ?? 'Space description pending.'}
        </p>
        <p className='mt-4 text-sm text-jpv-inverse-muted'>{memberEmail}</p>
      </section>

      {query.submission === 'pending' && (
        <div className='jpv-notice'>
          Your post has been published.
        </div>
      )}
      {query.submission === 'error' && (
        <div className='jpv-notice jpv-notice-danger'>
          {query.reason === 'rate_limit'
            ? 'You are posting too quickly. Please wait a moment before trying again.'
            : query.reason === 'not_allowed'
              ? 'You do not have permission to post in this space. Check your membership status.'
              : query.reason === 'validation'
                ? 'Your post could not be saved. Please check that the title and body are filled in correctly.'
                : 'An unexpected error occurred while submitting your post. Please try again or contact support if this persists.'}
        </div>
      )}

      {detail.allowed ? (
        <>
          {activeCalls.length > 0 && (
            <section aria-labelledby='community-calls-heading' className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-5 shadow-jpv-card sm:p-6'>
              <div className='flex items-center justify-between gap-4'>
                <div>
                  <p className='text-xs font-bold uppercase tracking-[0.2em] text-jpv-sunshine-ink' id='community-calls-heading'>Group calls</p>
                  <p className='mt-1 text-sm text-jpv-muted'>
                    {activeCalls.some((c) => c.status === 'live')
                      ? 'A call is live right now.'
                      : `${activeCalls.length} call${activeCalls.length > 1 ? 's' : ''} scheduled.`}
                  </p>
                </div>
                <Link
                  className='jpv-button-primary min-h-10 shrink-0 text-sm'
                  href={`/portal/community/${encodedSpaceSlug}/calls`}
                >
                  {activeCalls.some((c) => c.status === 'live') ? 'Join call' : 'View calls'}
                </Link>
              </div>
            </section>
          )}

          {detail.membership?.status === 'active' && (
            <section aria-labelledby='community-composer-heading' className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8'>
              <h2 className='text-2xl font-bold text-jpv-brand-deep' id='community-composer-heading'>Start a discussion</h2>
              <p className='mt-2 max-w-2xl text-sm leading-6 text-jpv-muted'>Share a question, update, or insight with members who have access to this space.</p>
              <form
                action={submitCommunityPost.bind(null, spaceSlug)}
                className='mt-5 space-y-4'
              >
                <div>
                  <label className='block text-sm font-bold text-jpv-brand-deep' htmlFor='post-title'>
                    Title
                  </label>
                  <input
                    className='mt-2 w-full rounded-jpv-control border border-jpv-border bg-jpv-canvas px-4 py-3 text-sm text-jpv-ink outline-none transition focus:border-jpv-green-deep focus:ring-2 focus:ring-jpv-green/25'
                    id='post-title'
                    maxLength={160}
                    name='title'
                    placeholder='What would you like to discuss?'
                    required
                    type='text'
                  />
                </div>
                <div>
                  <label className='block text-sm font-bold text-jpv-brand-deep' htmlFor='post-body'>
                    Body
                  </label>
                  <textarea
                    className='mt-2 w-full rounded-jpv-control border border-jpv-border bg-jpv-canvas px-4 py-3 text-sm text-jpv-ink outline-none transition focus:border-jpv-green-deep focus:ring-2 focus:ring-jpv-green/25'
                    id='post-body'
                    maxLength={10000}
                    name='body'
                    placeholder='Share your thoughts, questions, or insights…'
                    required
                    rows={5}
                  />
                </div>
                <ComposerToolbar textareaId='post-body' />
                <input id='post-video' name='videoUrl' type='hidden' />
                <button
                  className='jpv-button-primary min-h-11'
                  type='submit'
                >
                  Post discussion
                </button>
              </form>
            </section>
          )}

          <section aria-labelledby='community-discussions-heading'>
            <div className='flex flex-col justify-between gap-4 sm:flex-row sm:items-end'>
              <div>
                <p className='text-xs font-bold uppercase tracking-[0.2em] text-jpv-sunshine-ink'>Discussions</p>
                <h2 className='mt-2 text-3xl font-bold tracking-tight text-jpv-brand-deep' id='community-discussions-heading'>Visible discussions</h2>
              </div>
              <p className='max-w-sm text-sm leading-6 text-jpv-muted'>
                Open a discussion to read its approved rich-text content and visible replies. Moderator submissions enter review first.
              </p>
            </div>

            <div aria-live='polite' className='mx-auto mt-8 max-w-3xl space-y-3'>
              {detail.posts.length > 0 ? (
                detail.posts.map((post) => (
                  <CommunityPostCard
                    href={`/portal/community/${encodedSpaceSlug}/posts/${encodeURIComponent(post.id)}`}
                    key={post.id}
                    post={post}
                  />
                ))
              ) : (
                <div className='rounded-jpv-card border border-dashed border-jpv-border bg-jpv-surface p-8 text-jpv-muted' role='status'>
                  <p className='font-semibold text-jpv-brand-deep'>No visible discussions yet.</p>
                  <p className='mt-2 text-sm leading-6'>Be the first to start a conversation in this space.</p>
                </div>
              )}
            </div>
          </section>
        </>
      ) : (
        <section className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-8 shadow-jpv-card'>
          <h2 className='text-2xl font-bold text-jpv-brand-deep'>This space is locked</h2>
          <p className='mt-3 max-w-2xl text-sm leading-6 text-jpv-muted'>{detail.lockReason}</p>
          {detail.canRequestAccess && (
            <p className='mt-5 text-xs font-bold uppercase tracking-[0.14em] text-jpv-sunshine-ink'>
              Request flow pending admin approval
            </p>
          )}
        </section>
      )}
    </div>
  )
}
