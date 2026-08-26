'use client'

import { useState } from 'react'

import { cn } from '@/helpers/utils'

type ReactionType = 'helpful' | 'insightful' | 'celebrate'
type ReactionCount = { label: string; count: number; reactionType?: ReactionType }
type ReactionSummary = {
  counts?: ReactionCount[]
  totalCount?: number
  viewerReaction?: ReactionType | null
}

type ReactionBarClientProps = {
  counts: readonly ReactionCount[]
  totalCount: number | null
  viewerReaction: ReactionType | null
  targetKind: 'space_post' | 'space_comment' | 'lesson_comment'
  targetId: string | number
  errorMessage?: string | null
  label: string
  className?: string
}

const options: readonly { type: ReactionType; label: string }[] = [
  { type: 'helpful', label: 'Helpful' },
  { type: 'insightful', label: 'Insightful' },
  { type: 'celebrate', label: 'Celebrate' },
]

function ReactionIcon() {
  return (
    <svg aria-hidden='true' className='h-4 w-4' fill='none' viewBox='0 0 24 24'>
      <path d='M7 10v10H4V10h3Zm0 10h9.2a2 2 0 0 0 1.95-1.56l1.1-5A2 2 0 0 0 17.3 11H14l.7-3.52A2 2 0 0 0 12.74 5L7 10v10Z' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.7' />
    </svg>
  )
}

function countMap(counts: readonly ReactionCount[]) {
  return new Map(counts.map((entry) => [entry.reactionType ?? entry.label.toLowerCase(), entry.count]))
}

export function ReactionBarClient({
  counts,
  totalCount,
  viewerReaction,
  targetKind,
  targetId,
  errorMessage = null,
  label,
  className,
}: ReactionBarClientProps) {
  const [currentCounts, setCurrentCounts] = useState(() => countMap(counts))
  const [currentTotal, setCurrentTotal] = useState(totalCount ?? 0)
  const [selected, setSelected] = useState<ReactionType | null>(viewerReaction)
  const [pending, setPending] = useState<ReactionType | null>(null)
  const [error, setError] = useState<string | null>(errorMessage)

  async function toggle(type: ReactionType) {
    if (pending) return

    const previousCounts = new Map(currentCounts)
    const previousTotal = currentTotal
    const previousSelected = selected
    const nextCounts = new Map(currentCounts)
    const isRemoving = selected === type

    if (isRemoving) {
      nextCounts.set(type, Math.max(0, (nextCounts.get(type) ?? 0) - 1))
    } else {
      if (selected) nextCounts.set(selected, Math.max(0, (nextCounts.get(selected) ?? 0) - 1))
      nextCounts.set(type, (nextCounts.get(type) ?? 0) + 1)
    }

    setError(null)
    setCurrentCounts(nextCounts)
    setCurrentTotal(Math.max(0, currentTotal + (isRemoving ? -1 : selected ? 0 : 1)))
    setSelected(isRemoving ? null : type)
    setPending(type)

    try {
      const response = await fetch('/api/portal/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetKind, targetId: String(targetId), reactionType: type }),
      })
      const result = await response.json() as { ok?: boolean; summary?: ReactionSummary; message?: string }
      if (!response.ok || !result.ok || !result.summary) {
        throw new Error(result.message || 'Unable to save this reaction.')
      }

      setCurrentCounts(countMap(result.summary.counts ?? []))
      setCurrentTotal(result.summary.totalCount ?? 0)
      setSelected(result.summary.viewerReaction ?? null)
    } catch (cause) {
      setCurrentCounts(previousCounts)
      setCurrentTotal(previousTotal)
      setSelected(previousSelected)
      setError(cause instanceof Error ? cause.message : 'Unable to save this reaction. Please try again.')
    } finally {
      setPending(null)
    }
  }

  return (
    <section aria-label={label} className={cn('flex flex-col gap-3 border-t border-jpv-border pt-5 sm:flex-row sm:items-center sm:justify-between', className)} data-engagement-component='reaction-bar'>
      <div className='min-w-0 flex-1 space-y-3'>
        <span className='inline-flex min-h-11 items-center gap-2 rounded-jpv-action border border-jpv-border bg-jpv-surface px-3 py-2 text-sm text-jpv-ink'>
          <ReactionIcon />
          <span className='font-semibold'>{currentTotal} {currentTotal === 1 ? 'reaction' : 'reactions'}</span>
        </span>
        {error ? <p aria-live='assertive' className='jpv-notice jpv-notice-danger px-3 py-2 text-sm' role='alert'>{error}</p> : null}
      </div>
      <div className='flex flex-wrap items-center gap-3'>
        {options.map((option) => {
          const isSelected = selected === option.type
          return (
            <button
              aria-busy={pending === option.type}
              aria-label={pending === option.type ? `${option.label}, saving` : option.label}
              aria-pressed={isSelected}
              className={cn('inline-flex min-h-11 items-center gap-2 rounded-jpv-action border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jpv-focus disabled:cursor-wait disabled:opacity-70', isSelected ? 'border-jpv-brand bg-jpv-surface text-jpv-brand-deep' : 'border-jpv-border bg-jpv-canvas text-jpv-muted')}
              disabled={pending !== null}
              key={option.type}
              onClick={() => void toggle(option.type)}
              type='button'
            >
              <ReactionIcon />
              <span>{pending === option.type ? 'Saving…' : option.label}</span>
              <span className='tabular-nums'>{currentCounts.get(option.type) ?? 0}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
