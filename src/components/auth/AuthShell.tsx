import Link from 'next/link'
import type { ReactNode } from 'react'

import { jpvBrand } from '@/lib/brand/jpvDesignSystem'

export type AuthShellBranding = {
  siteTitle?: string
  logoUrl?: string
  bannerTitle?: string
  bannerDescription?: string
  bannerTitleColor?: string
  bannerTextColor?: string
  bannerBackgroundColor?: string
  formTitleColor?: string
  formTextColor?: string
  formBackgroundColor?: string
}

type AuthShellProps = {
  eyebrow: string
  title: string
  description: string
  children: ReactNode
  introActions?: ReactNode
  footer?: ReactNode
  branding?: AuthShellBranding
}

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  introActions,
  footer,
  branding,
}: AuthShellProps) {
  const bannerTitle = branding?.bannerTitle || 'Property education grounded in purpose and practical action.'
  const bannerDescription = branding?.bannerDescription || 'Secure access to your programme, resources, community, and account tools in one connected member experience.'

  return (
    <main className='jpv-auth-shell min-h-[100dvh] overflow-auto bg-jpv-canvas text-jpv-ink lg:grid lg:h-[100dvh] lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:overflow-hidden'>
      {/* Left banner — desktop only */}
      <section
        className='relative hidden overflow-hidden rounded-r-none bg-jpv-brand-deep p-10 text-jpv-canvas lg:flex lg:h-full lg:flex-col lg:justify-between xl:p-14'
        style={branding?.bannerBackgroundColor ? { backgroundColor: branding.bannerBackgroundColor } : undefined}
      >
        <Link className='relative flex w-fit items-center' href='/'>
          <img alt={jpvBrand.logoAlt} className='h-16 w-auto max-w-[12rem] object-contain' src={jpvBrand.logoHorizontalPath} />
        </Link>

        <div className='relative max-w-xl py-16'>
          <p className='jpv-eyebrow text-jpv-brand-bright'>Learn. Apply. Build.</p>
          <p
            className='jpv-editorial-heading mt-5 text-balance text-4xl leading-tight xl:text-5xl'
            style={branding?.bannerTitleColor ? { color: branding.bannerTitleColor } : undefined}
          >
            {bannerTitle}
          </p>
          <p
            className='mt-5 max-w-lg text-pretty text-base leading-7 text-jpv-canvas/75'
            style={branding?.bannerTextColor ? { color: branding.bannerTextColor } : undefined}
          >
            {bannerDescription}
          </p>
        </div>

        <p className='relative max-w-md border-t border-jpv-canvas/20 pt-4 text-sm leading-6 text-jpv-canvas/70'>
          Invest wisely, steward faithfully, bless generously.
        </p>
      </section>

      {/* Right form panel */}
      <section
        className='min-w-0 px-5 py-10 sm:px-10 lg:overflow-y-auto lg:py-14'
        style={branding?.formBackgroundColor ? { backgroundColor: branding.formBackgroundColor } : undefined}
      >
        <div className='mx-auto w-full max-w-lg'>
          {/* Logo — visible on mobile; desktop sees logo in the left banner */}
          <div className='mb-8 lg:hidden'>
            <Link href='/'>
              <img alt={jpvBrand.logoAlt} className='h-12 w-auto max-w-[10rem] object-contain' src={jpvBrand.logoHorizontalPath} />
            </Link>
          </div>

          <p className='jpv-eyebrow'>{eyebrow}</p>
          <h1
            className='mt-3 text-3xl font-bold leading-tight text-jpv-ink sm:text-4xl'
            style={branding?.formTitleColor ? { color: branding.formTitleColor } : undefined}
          >
            {title}
          </h1>
          <p
            className='mt-3 text-base leading-7 text-jpv-muted'
            style={branding?.formTextColor ? { color: branding.formTextColor } : undefined}
          >
            {description}
          </p>
          {introActions ? <div className='mt-5'>{introActions}</div> : null}

          <div className='mt-8 border-t border-jpv-border pt-8'>{children}</div>

          {/* Footer */}
          {footer ? (
            <div className='mt-6 border-t border-jpv-border pt-4 text-sm text-jpv-muted'>
              {footer}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  )
}
