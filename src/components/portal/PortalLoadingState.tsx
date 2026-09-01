type PortalLoadingVariant = 'portal' | 'courses' | 'course' | 'lesson'

function Skeleton({ className }: { className: string }) {
  return <div aria-hidden='true' className={`animate-pulse rounded-jpv-pill bg-jpv-surface-strong ${className}`} />
}

export function PortalLoadingState({ variant }: { variant: PortalLoadingVariant }) {
  const cardCount = variant === 'courses' ? 3 : variant === 'lesson' ? 4 : 2

  return (
    <div aria-busy='true' aria-label='Loading portal content' className='mx-auto w-full max-w-5xl space-y-6'>
      <section className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8'>
        <Skeleton className='h-4 w-28' />
        <Skeleton className='mt-5 h-10 w-4/5 max-w-2xl' />
        <Skeleton className='mt-3 h-5 w-full max-w-xl' />
      </section>
      <section className={variant === 'courses' ? 'grid gap-5 md:grid-cols-2' : 'space-y-4'}>
        {Array.from({ length: cardCount }, (_, index) => (
          <div className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card' key={index}>
            <Skeleton className='h-4 w-32' />
            <Skeleton className='mt-4 h-7 w-3/4' />
            <Skeleton className='mt-3 h-4 w-full' />
            <Skeleton className='mt-2 h-4 w-5/6' />
          </div>
        ))}
      </section>
      <p className='text-sm text-jpv-muted'>Loading portal content…</p>
    </div>
  )
}
