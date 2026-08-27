import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

export function PublicInformationShell({
  eyebrow,
  title,
  description,
  children,
  backHref = '/',
  backLabel = 'Back to JPV Bootcamp',
}: {
  eyebrow: string
  title: string
  description: string
  children: ReactNode
  backHref?: string
  backLabel?: string
}) {
  return (
    <main className='min-h-[100dvh] min-w-0 bg-jpv-canvas text-jpv-ink' data-jpv-public-shell='true'>
      <section className='px-5 py-8 sm:px-6 sm:py-12 lg:py-16'>
        <div className='mx-auto min-w-0 max-w-4xl'>
          <Link
            className='inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-jpv-brand-deep transition hover:text-jpv-brand'
            href={backHref}
          >
            <ArrowLeft aria-hidden='true' size={17} />
            {backLabel}
          </Link>

          <header className='mt-8 rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8'>
            <p className='jpv-eyebrow'>{eyebrow}</p>
            <h1 className='jpv-editorial-heading mt-3 text-3xl text-jpv-ink sm:text-4xl'>{title}</h1>
            <p className='mt-3 max-w-3xl text-sm leading-6 text-jpv-muted sm:text-base'>{description}</p>
          </header>

          <div className='mt-6 space-y-5'>{children}</div>
        </div>
      </section>
    </main>
  )
}

export function PublicInformationCard({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-5 shadow-jpv-card sm:p-6'>
      <h2 className='text-xl font-semibold text-jpv-ink'>{title}</h2>
      <div className='mt-3 space-y-3 text-sm leading-6 text-jpv-muted'>{children}</div>
    </section>
  )
}
