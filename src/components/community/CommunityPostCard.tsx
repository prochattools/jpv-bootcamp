import Link from 'next/link'

import {
  EngagementAuthorIdentity,
  EngagementCommentActionBar,
} from '@/components/community/EngagementPresentation'
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

export function CommunityPostCard({ href, post }: CommunityPostCardProps) {
  const authorName = post.authorName ?? 'Community member'

  return (
    <Link
      aria-label={`Read discussion: ${post.title}`}
      className='group block min-w-0 rounded-jpv-card border border-jpv-border bg-jpv-canvas shadow-jpv-card transition hover:-translate-y-0.5 hover:border-jpv-sunshine-ink/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jpv-green'
      href={href}
    >
      <article className='min-w-0 p-5 sm:p-6'>
        <div className='flex min-w-0 flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-jpv-sunshine-ink'>
          {post.pinned ? <span className='rounded-full bg-jpv-surface-strong px-2.5 py-1'>Pinned</span> : null}
          <span>{post.postType ?? 'discussion'}</span>
          <span aria-hidden='true'>·</span>
          <time className='min-w-0 break-words' dateTime={post.createdAt ?? undefined}>{formatDate(post.createdAt)}</time>
        </div>

        <div className='mt-5 flex items-start gap-3'>
          <EngagementAuthorIdentity name={authorName} subtitle='Community discussion' />
        </div>

        <h3 className='mt-5 text-xl font-bold leading-snug text-jpv-brand-deep group-hover:text-jpv-brand'>{post.title}</h3>
        {post.excerpt ? (
          <p className='mt-3 line-clamp-3 text-sm leading-6 text-jpv-muted'>{post.excerpt}</p>
        ) : (
          <p className='mt-3 text-sm leading-6 text-jpv-muted'>Open the discussion to read the full post.</p>
        )}

        <EngagementCommentActionBar
          className='mt-5'
          commentCount={post.commentCount}
          replyLabel='Open discussion to reply'
        />
        <p className='mt-3 text-right text-sm font-semibold text-jpv-brand-deep'>
          Read discussion <span aria-hidden='true'>→</span>
        </p>
      </article>
    </Link>
  )
}
