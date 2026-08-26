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

function formatRelativeDate(value: string | null): string {
  if (!value) return 'Date pending'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date pending'

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000))
  if (elapsedSeconds < 60) return 'Just now'
  if (elapsedSeconds < 60 * 60) {
    const minutes = Math.floor(elapsedSeconds / 60)
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`
  }
  if (elapsedSeconds < 24 * 60 * 60) {
    const hours = Math.floor(elapsedSeconds / (60 * 60))
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  }
  if (elapsedSeconds < 7 * 24 * 60 * 60) {
    const days = Math.floor(elapsedSeconds / (24 * 60 * 60))
    return `${days} ${days === 1 ? 'day' : 'days'} ago`
  }

  return formatDate(value)
}

function postTypeLabel(value: string | null): string {
  const normalized = value?.trim().toLowerCase()
  if (!normalized) return 'Discussion'
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

export function CommunityPostCard({ href, post }: CommunityPostCardProps) {
  const authorName = post.authorName ?? 'Community member'
  const timestampLabel = formatRelativeDate(post.createdAt)

  return (
    <Link
      aria-label={`Read discussion: ${post.title}`}
      className='group block min-w-0 rounded-jpv-card border border-jpv-border bg-jpv-canvas shadow-jpv-card transition hover:-translate-y-0.5 hover:border-jpv-sunshine-ink/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jpv-green'
      href={href}
    >
      <article className='min-w-0 p-4'>
        <header>
          <div className='flex min-w-0 flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.14em]'>
            <span className='rounded-full bg-jpv-surface-strong px-2.5 py-1 text-jpv-muted'>
              {postTypeLabel(post.postType)}
            </span>
            {post.pinned ? <span className='rounded-full bg-jpv-brand/10 px-2.5 py-1 text-jpv-brand-deep'>Pinned</span> : null}
            {post.moderationStatus === 'hidden' ? <span className='rounded-full bg-red-100 px-2.5 py-1 text-red-700'>Hidden</span> : null}
            {post.moderationStatus === 'pending' ? <span className='rounded-full bg-yellow-100 px-2.5 py-1 text-yellow-800'>Pending review</span> : null}
          </div>

          <EngagementAuthorIdentity
            className='mt-4'
            name={authorName}
            subtitle='Community discussion'
            timestampLabel={timestampLabel}
            timestampValue={post.createdAt ?? undefined}
          />
        </header>

        <h3 className='mt-5 text-xl font-bold leading-snug text-jpv-brand-deep group-hover:text-jpv-brand'>{post.title}</h3>
        {post.excerpt ? (
          <p className='mt-3 line-clamp-2 text-sm leading-6 text-jpv-muted'>{post.excerpt.slice(0, 140).trimEnd()}{post.excerpt.length > 140 ? '…' : ''}</p>
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
