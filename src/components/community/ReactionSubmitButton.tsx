'use client'

import { useFormStatus } from 'react-dom'

import { cn } from '@/helpers/utils'

type ReactionSubmitButtonProps = {
  label: string
  selected: boolean
  count: number
  value: 'helpful' | 'insightful' | 'celebrate'
  className?: string
}

function ReactionIcon() {
  return (
    <svg aria-hidden='true' className='h-4 w-4' fill='none' viewBox='0 0 24 24'>
      <path
        d='M7 10v10H4V10h3Zm0 10h9.2a2 2 0 0 0 1.95-1.56l1.1-5A2 2 0 0 0 17.3 11H14l.7-3.52A2 2 0 0 0 12.74 5L7 10v10Z'
        stroke='currentColor'
        strokeLinecap='round'
        strokeLinejoin='round'
        strokeWidth='1.7'
      />
    </svg>
  )
}

export function ReactionSubmitButton({
  label,
  selected,
  count,
  value,
  className,
}: ReactionSubmitButtonProps) {
  const { pending } = useFormStatus()

  return (
    <button
      aria-busy={pending}
      aria-label={pending ? `${label}, saving` : label}
      aria-pressed={selected}
      className={cn(
        'inline-flex min-h-11 items-center gap-2 rounded-jpv-action border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jpv-focus focus-visible:ring-offset-2 focus-visible:ring-offset-jpv-canvas disabled:cursor-wait disabled:opacity-70',
        selected
          ? 'border-jpv-brand bg-jpv-surface text-jpv-brand-deep'
          : 'border-jpv-border bg-jpv-canvas text-jpv-muted',
        className,
      )}
      data-engagement-component='reaction-submit-button'
      data-reaction-state={selected ? 'selected' : 'idle'}
      disabled={pending}
      name='reactionType'
      type='submit'
      value={value}
    >
      <ReactionIcon />
      <span aria-live='polite'>{pending ? 'Saving…' : label}</span>
      <span className='tabular-nums'>{count}</span>
    </button>
  )
}
