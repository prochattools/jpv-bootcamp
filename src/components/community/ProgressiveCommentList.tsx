import { Children, type ReactNode } from 'react'

type ProgressiveCommentListProps = {
  children: ReactNode
  initialVisible?: number
  totalCount: number
}

/**
 * Keeps the first part of a discussion visible while allowing longer threads
 * to expand on demand. This is presentational only: all supplied comments
 * remain in the document and no service or moderation contract changes.
 */
export function ProgressiveCommentList({
  children,
  initialVisible = 3,
  totalCount,
}: ProgressiveCommentListProps) {
  const items = Children.toArray(children)
  const visibleCount = Math.max(1, Math.min(initialVisible, items.length))

  if (items.length <= visibleCount) {
    return <div className='space-y-5'>{items}</div>
  }

  const remainingCount = Math.max(0, totalCount - visibleCount)

  return (
    <div className='space-y-5'>
      {items.slice(0, visibleCount)}
      <details className='rounded-jpv-card border border-jpv-border bg-jpv-surface px-5 py-4'>
        <summary className='min-h-11 cursor-pointer list-none py-2 text-sm font-semibold text-jpv-brand-deep outline-none focus-visible:ring-2 focus-visible:ring-jpv-green'>
          Show {remainingCount} more {remainingCount === 1 ? 'comment' : 'comments'}
        </summary>
        <div className='mt-5 space-y-5 border-t border-jpv-border pt-5'>
          {items.slice(visibleCount)}
        </div>
      </details>
    </div>
  )
}
