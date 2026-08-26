export default function FrontendLoading() {
  return (
    <main className='min-h-[100dvh] bg-jpv-canvas px-5 py-8 text-jpv-ink sm:px-6 sm:py-12 lg:py-16'>
      <div className='mx-auto max-w-4xl'>
        <section
          aria-busy='true'
          aria-live='polite'
          className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8'
          role='status'
        >
          <p className='jpv-eyebrow'>JPV Bootcamp</p>
          <div className='mt-4 h-8 w-2/3 animate-pulse rounded-jpv-control bg-jpv-surface-strong motion-reduce:animate-none' />
          <div className='mt-4 h-4 w-full animate-pulse rounded-jpv-control bg-jpv-surface motion-reduce:animate-none' />
          <div className='mt-2 h-4 w-4/5 animate-pulse rounded-jpv-control bg-jpv-surface motion-reduce:animate-none' />
          <span className='sr-only'>Loading page</span>
        </section>
      </div>
    </main>
  )
}
