import type { ReactNode } from 'react'

import { cn } from '@/helpers/utils'

export type EngagementReactionState = 'idle' | 'selected' | 'unavailable'

export type EngagementReactionCount = {
  label: string
  count: number
  reactionType?: 'helpful' | 'insightful' | 'celebrate'
}

export type EngagementReactionType = 'helpful' | 'insightful' | 'celebrate'

type EngagementReactionAction = (formData: FormData) => void | Promise<void>

type EngagementReactionSummaryProps = {
  counts?: readonly EngagementReactionCount[]
  totalCount?: number | null
  className?: string
}

function initials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'JP'
}

function ReactionIcon() {
  return (
    <svg aria-hidden='true' className='h-4 w-4' fill='none' viewBox='0 0 24 24'>
      <path d='M7 10v10H4V10h3Zm0 10h9.2a2 2 0 0 0 1.95-1.56l1.1-5A2 2 0 0 0 17.3 11H14l.7-3.52A2 2 0 0 0 12.74 5L7 10v10Z' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.7' />
    </svg>
  )
}

function CommentIcon() {
  return (
    <svg aria-hidden='true' className='h-4 w-4' fill='none' viewBox='0 0 24 24'>
      <path d='M5 6.5h14v9H9l-4 3v-12Z' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.75' />
    </svg>
  )
}

export function EngagementReactionSummary({
  counts = [],
  totalCount = null,
  className,
}: EngagementReactionSummaryProps) {
  const visibleCounts = counts.filter((entry) => Number.isFinite(entry.count) && entry.count > 0)
  const derivedTotal = visibleCounts.reduce((sum, entry) => sum + entry.count, 0)
  const resolvedTotal = totalCount ?? (visibleCounts.length > 0 ? derivedTotal : null)

  return (
    <div
      aria-label='Reaction summary'
      className={cn('flex min-h-11 flex-wrap items-center gap-2 text-sm text-jpv-muted', className)}
      data-engagement-component='reaction-summary'
    >
      <span className='inline-flex min-h-11 items-center gap-2 rounded-jpv-action border border-jpv-border bg-jpv-surface px-3 py-2'>
        <ReactionIcon />
        <span className='font-semibold text-jpv-ink'>
          {resolvedTotal === null ? 'Reactions pending' : `${resolvedTotal} ${resolvedTotal === 1 ? 'reaction' : 'reactions'}`}
        </span>
      </span>
      {visibleCounts.map((entry) => (
        <span className='rounded-jpv-pill bg-jpv-surface-strong px-3 py-1 text-xs font-semibold text-jpv-muted' key={entry.label}>
          {entry.label} {entry.count}
        </span>
      ))}
    </div>
  )
}

type EngagementReactionButtonProps = {
  label?: string
  state?: EngagementReactionState
  count?: number | null
  onPress?: () => void
  interactive?: boolean
  submit?: boolean
  name?: string
  value?: string
  className?: string
}

export function EngagementReactionButton({
  label = 'React',
  state = 'unavailable',
  count = null,
  onPress,
  interactive: interactiveOverride,
  submit = false,
  name,
  value,
  className,
}: EngagementReactionButtonProps) {
  const interactive = interactiveOverride ?? typeof onPress === 'function'
  const selected = state === 'selected'

  return (
    <button
      aria-disabled={!interactive}
      aria-label={interactive ? label : `${label} is not available yet`}
      aria-pressed={selected}
      className={cn(
        'inline-flex min-h-11 items-center gap-2 rounded-jpv-action border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jpv-focus focus-visible:ring-offset-2 focus-visible:ring-offset-jpv-canvas',
        selected
          ? 'border-jpv-brand bg-jpv-surface text-jpv-brand-deep'
          : 'border-jpv-border bg-jpv-canvas text-jpv-muted',
        !interactive && 'cursor-not-allowed opacity-70',
        className,
      )}
      data-engagement-component='reaction-button'
      data-reaction-state={state}
      disabled={!interactive}
      name={name}
      onClick={onPress}
      type={submit ? 'submit' : 'button'}
      value={value}
    >
      <ReactionIcon />
      <span>{interactive ? label : `${label} coming soon`}</span>
      {count !== null && Number.isFinite(count) ? <span className='tabular-nums'>{count}</span> : null}
    </button>
  )
}

type EngagementReactionBarProps = {
  counts?: readonly EngagementReactionCount[]
  totalCount?: number | null
  viewerReaction?: EngagementReactionType | null
  action?: EngagementReactionAction
  targetKind?: 'space_post' | 'space_comment' | 'lesson_comment'
  targetId?: string | number
  redirectPath?: string
  label?: string
  className?: string
}

export function EngagementReactionBar({
  counts,
  totalCount,
  viewerReaction = null,
  action,
  targetKind,
  targetId,
  redirectPath,
  label = 'Engagement',
  className,
}: EngagementReactionBarProps) {
  const activeCounts = new Map(
    (counts ?? []).map((entry) => [entry.reactionType ?? entry.label.toLowerCase(), entry.count]),
  )
  const reactionOptions: readonly { type: EngagementReactionType; label: string }[] = [
    { type: 'helpful', label: 'Helpful' },
    { type: 'insightful', label: 'Insightful' },
    { type: 'celebrate', label: 'Celebrate' },
  ]

  const buttons = reactionOptions.map((option) => (
    <EngagementReactionButton
      count={activeCounts.get(option.type) ?? 0}
      interactive={Boolean(action && targetKind && targetId !== undefined && redirectPath)}
      key={option.type}
      label={option.label}
      name='reactionType'
      state={viewerReaction === option.type ? 'selected' : 'idle'}
      submit={Boolean(action && targetKind && targetId !== undefined && redirectPath)}
      value={option.type}
    />
  ))

  return (
    <section
      aria-label={label}
      className={cn('flex flex-col gap-3 border-t border-jpv-border pt-5 sm:flex-row sm:items-center sm:justify-between', className)}
      data-engagement-component='reaction-bar'
    >
      <EngagementReactionSummary counts={counts} totalCount={totalCount} />
      {action && targetKind && targetId !== undefined && redirectPath ? (
        <form action={action} className='flex flex-wrap items-center gap-3'>
          <input name='targetKind' type='hidden' value={targetKind} />
          <input name='targetId' type='hidden' value={String(targetId)} />
          <input name='redirectPath' type='hidden' value={redirectPath} />
          {buttons}
        </form>
      ) : (
        <div className='flex flex-wrap items-center gap-3'>
          <EngagementReactionButton />
          <span className='text-xs text-jpv-muted'>Read-only preview</span>
        </div>
      )}
    </section>
  )
}

type EngagementCommentActionBarProps = {
  commentCount: number
  replyLabel?: string
  className?: string
}

export function EngagementCommentActionBar({
  commentCount,
  replyLabel = 'Reply in the discussion composer below',
  className,
}: EngagementCommentActionBarProps) {
  return (
    <div
      aria-label='Discussion actions'
      className={cn('flex min-h-11 flex-wrap items-center justify-between gap-3 border-t border-jpv-border pt-4 text-sm', className)}
      data-engagement-component='comment-action-bar'
    >
      <span className='inline-flex items-center gap-2 font-semibold text-jpv-muted'>
        <CommentIcon />
        {commentCount} {commentCount === 1 ? 'comment' : 'comments'}
      </span>
      <span className='text-xs font-semibold text-jpv-muted'>{replyLabel}</span>
    </div>
  )
}

type EngagementAuthorIdentityProps = {
  name: string
  subtitle?: string
  timestampLabel?: string
  timestampValue?: string
  className?: string
}

export function EngagementAuthorIdentity({
  name,
  subtitle,
  timestampLabel,
  timestampValue,
  className,
}: EngagementAuthorIdentityProps) {
  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)} data-engagement-component='author-identity'>
      <span aria-hidden='true' className='flex h-9 w-9 shrink-0 items-center justify-center rounded-jpv-pill bg-jpv-brand-deep text-xs font-bold text-jpv-canvas'>
        {initials(name)}
      </span>
      <div className='min-w-0'>
        <p className='truncate font-semibold text-jpv-ink'>{name}</p>
        {subtitle ? <p className='truncate text-xs text-jpv-muted'>{subtitle}</p> : null}
        {timestampLabel ? (
          <time className='text-xs text-jpv-muted' dateTime={timestampValue}>
            {timestampLabel}
          </time>
        ) : null}
      </div>
    </div>
  )
}

type DiscussionHierarchyProps = {
  depth: number
  children: ReactNode
  className?: string
}

export function DiscussionHierarchy({ depth, children, className }: DiscussionHierarchyProps) {
  if (depth <= 0) return <div data-discussion-depth='0'>{children}</div>

  return (
    <div
      aria-label={`Reply level ${depth}`}
      className={cn('mt-4 space-y-4 border-l-2 border-jpv-border pl-4 sm:ml-2 sm:pl-5', className)}
      data-discussion-depth={depth}
    >
      {children}
    </div>
  )
}

export function EngagementFutureActions() {
  return (
    <div
      aria-label='Future engagement actions'
      className='flex flex-wrap items-center gap-2 text-xs text-jpv-muted'
      data-engagement-component='future-actions'
    >
      <span className='font-semibold'>Coming later:</span>
      <span className='rounded-jpv-pill bg-jpv-surface-strong px-3 py-1'>Bookmarks</span>
      <span className='rounded-jpv-pill bg-jpv-surface-strong px-3 py-1'>Sharing</span>
    </div>
  )
}
