import Link from 'next/link'

import type { MemberCommunityPost } from '@/lib/payloadCourse/communityPortal'

type CommunityPostCardProps = {
  href: string
  post: MemberCommunityPost
}

function formatDate(value: string | null): string {
  if (!value) return 'Date pending'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date pending'
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function initials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'JP'
}

function CommentIcon() {
  return (
    <svg aria-hidden='true' className='h-4 w-4' fill='none' viewBox='0 0 24 24'>
      <path d='M5 6.5h14v9H9l-4 3v-12Z' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.75' />
    </svg>
  )
}

export function CommunityPostCard({ href, post }: CommunityPostCardProps) {
  const authorName = post.authorName ?? 'Community member'

  return (
    <Link
      aria-label={`Read discussion: ${post.title}`}
      className='group block rounded-jpv-card border border-jpv-border bg-jpv-canvas shadow-jpv-card transition hover:-translate-y-0.5 hover:border-jpv-sunshine-ink/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jpv-green'
      href={href}
    >
      <article className='p-5 sm:p-6'>
        <div className='flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-jpv-sunshine-ink'>
          {post.pinned ? <span className='rounded-full bg-jpv-surface-strong px-2.5 py-1'>Pinned</span> : null}
          <span>{post.postType ?? 'discussion'}</span>
          <span aria-hidden='true'>·</span>
          <time dateTime={post.createdAt ?? undefined}>{formatDate(post.createdAt)}</time>
        </div>

        <div className='mt-5 flex items-start gap-3'>
          <span aria-hidden='true' className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-jpv-brand-deep text-xs font-bold text-jpv-canvas'>
            {initials(authorName)}
          </span>
          <div className='min-w-0'>
            <p className='text-sm font-semibold text-jpv-ink'>{authorName}</p>
            <p className='mt-0.5 text-xs text-jpv-muted'>Community discussion</p>
          </div>
        </div>

        <h3 className='mt-5 text-xl font-bold leading-snug text-jpv-brand-deep group-hover:text-jpv-brand'>{post.title}</h3>
        {post.excerpt ? (
          <p className='mt-3 line-clamp-3 text-sm leading-6 text-jpv-muted'>{post.excerpt}</p>
        ) : (
          <p className='mt-3 text-sm leading-6 text-jpv-muted'>Open the discussion to read the full post.</p>
        )}

        <div className='mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-jpv-border pt-4 text-sm'>
          <span className='inline-flex min-h-10 items-center gap-2 font-semibold text-jpv-muted'>
            <CommentIcon />
            {post.commentCount} {post.commentCount === 1 ? 'comment' : 'comments'}
          </span>
          <span className='font-semibold text-jpv-brand-deep'>Read discussion <span aria-hidden='true'>→</span></span>
        </div>
      </article>
    </Link>
  )
}
