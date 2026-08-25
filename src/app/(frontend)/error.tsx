'use client'

import Link from 'next/link'

export default function FrontendError({
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <main className='min-h-[100dvh] bg-jpv-canvas px-5 py-8 text-jpv-ink sm:px-6 sm:py-12 lg:py-16'>
      <div className='mx-auto max-w-3xl'>
        <section aria-labelledby='frontend-error-title' className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8'>
          <p className='jpv-eyebrow'>Something went wrong</p>
          <h1 className='jpv-editorial-heading mt-3 text-3xl text-jpv-ink sm:text-4xl' id='frontend-error-title'>
            We could not load this page.
          </h1>
          <p className='mt-3 max-w-2xl text-sm leading-6 text-jpv-muted sm:text-base'>
            Try the request again. If the problem continues, return to the home page or sign in again.
          </p>
          <div className='mt-6 flex flex-wrap gap-3'>
            <button className='jpv-button-primary min-h-11' onClick={reset} type='button'>
              Try again
            </button>
            <Link className='jpv-button-secondary min-h-11' href='/'>
              Go to the home page
            </Link>
            <Link className='jpv-button-secondary min-h-11' href='/portal?mode=login'>
              Member sign in
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
