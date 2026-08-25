type LiveSessionStateProps = {
  status: string | null
  compact?: boolean
}

const states: Record<string, { label: string; className: string }> = {
  live: { label: 'Live now', className: 'bg-emerald-50 text-emerald-700' },
  scheduled: { label: 'Scheduled', className: 'bg-blue-50 text-blue-700' },
  completed: { label: 'Ended', className: 'bg-jpv-surface-strong text-jpv-muted' },
  cancelled: { label: 'Cancelled', className: 'bg-jpv-surface-strong text-jpv-muted' },
}

export function LiveSessionState({ status, compact = false }: LiveSessionStateProps) {
  const state = states[status ?? ''] ?? {
    label: 'Unavailable',
    className: 'bg-jpv-surface-strong text-jpv-muted',
  }
  const isLive = status === 'live'

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-jpv-pill font-semibold ${compact ? 'px-2.5 py-1 text-xs' : 'px-3 py-1 text-xs'} ${state.className}`}
    >
      {isLive ? (
        <span aria-hidden='true' className='relative flex h-2 w-2'>
          <span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75 motion-reduce:animate-none' />
          <span className='relative inline-flex h-2 w-2 rounded-full bg-emerald-500' />
        </span>
      ) : null}
      {state.label}
    </span>
  )
}

export function liveSessionAvailabilityMessage(status: string, roomReady = true): string {
  if (status === 'scheduled') return 'Waiting for the host to open the room.'
  if (status === 'live' && !roomReady) return 'The room is temporarily unavailable.'
  if (status === 'cancelled') return 'This session was cancelled.'
  if (status === 'completed') return 'This session has ended.'
  return 'Joining is not available.'
}
