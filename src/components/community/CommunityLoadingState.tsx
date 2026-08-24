type CommunityLoadingVariant = 'dashboard' | 'space' | 'post'

function SkeletonLine({ className = '' }: { className?: string }) {
  return <div aria-hidden='true' className={`animate-pulse rounded-jpv-pill bg-jpv-surface-strong ${className}`} />
}

function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden='true' className={`animate-pulse rounded-jpv-card border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card ${className}`}>
      <SkeletonLine className='h-3 w-24' />
      <SkeletonLine className='mt-4 h-5 w-3/4' />
      <SkeletonLine className='mt-3 h-4 w-full' />
      <SkeletonLine className='mt-2 h-4 w-5/6' />
    </div>
  )
}

export function CommunityLoadingState({ variant }: { variant: CommunityLoadingVariant }) {
  return (
    <div aria-busy='true' aria-label='Loading community' className='mx-auto w-full max-w-6xl space-y-8'>
      <section className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-10'>
        <SkeletonLine className='h-4 w-32' />
        <SkeletonLine className='mt-6 h-10 w-4/5 max-w-2xl' />
        <SkeletonLine className='mt-3 h-5 w-full max-w-xl' />
        <SkeletonLine className='mt-2 h-5 w-2/3 max-w-lg' />
      </section>

      {variant === 'dashboard' ? (
        <>
          <section className='space-y-4'>
            <SkeletonLine className='h-8 w-48' />
            <div className='grid gap-4 md:grid-cols-2'>
              <SkeletonCard />
              <SkeletonCard />
            </div>
          </section>
          <section className='space-y-4'>
            <SkeletonLine className='h-8 w-40' />
            <SkeletonCard />
            <SkeletonCard />
          </section>
        </>
      ) : null}

      {variant === 'space' ? (
        <>
          <SkeletonCard className='min-h-40' />
          <section className='space-y-4'>
            <SkeletonLine className='h-8 w-48' />
            <SkeletonCard />
            <SkeletonCard />
          </section>
        </>
      ) : null}

      {variant === 'post' ? (
        <>
          <section className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-10'>
            <SkeletonLine className='h-4 w-32' />
            <SkeletonLine className='mt-6 h-10 w-4/5' />
            <SkeletonLine className='mt-6 h-4 w-40' />
            <SkeletonLine className='mt-8 h-5 w-full max-w-3xl' />
            <SkeletonLine className='mt-3 h-5 w-5/6 max-w-3xl' />
          </section>
          <section className='space-y-4'>
            <SkeletonLine className='h-8 w-32' />
            <SkeletonCard />
            <SkeletonCard />
          </section>
        </>
      ) : null}

      <p className='text-sm text-jpv-muted'>Loading community content…</p>
    </div>
  )
}
