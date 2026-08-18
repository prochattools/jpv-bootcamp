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
  const logoUrl = branding?.logoUrl || jpvBrand.logoPath
  const siteTitle = branding?.siteTitle || jpvBrand.name
  const bannerTitle = branding?.bannerTitle || 'Property education grounded in purpose and practical action.'
  const bannerDescription = branding?.bannerDescription || 'Secure access to your programme, resources, community, and account tools in one connected member experience.'

  return (
    <main className='jpv-auth-shell min-h-screen bg-jpv-canvas px-5 py-8 text-jpv-ink sm:px-8 lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(30rem,1.1fr)] lg:gap-8 lg:py-8'>
      <section
        className='relative hidden min-h-[calc(100vh-4rem)] overflow-hidden rounded-jpv-panel bg-jpv-green-deep p-10 text-jpv-canvas lg:flex lg:flex-col lg:justify-between xl:p-14'
        style={branding?.bannerBackgroundColor ? { backgroundColor: branding.bannerBackgroundColor } : undefined}
      >
        <Link className='relative flex w-fit items-center gap-3' href='/'>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt={jpvBrand.logoAlt} className='h-12 w-12 rounded-jpv-card object-cover' src={logoUrl} />
          <span>
            <span className='block text-base font-bold'>{siteTitle}</span>
            <span className='block text-xs opacity-70'>{jpvBrand.tagline}</span>
          </span>
        </Link>

        <div className='relative max-w-xl py-16'>
          <p className='jpv-eyebrow text-jpv-green'>Learn. Apply. Build.</p>
          <p
            className='jpv-editorial-heading mt-5 text-balance text-4xl leading-tight xl:text-5xl'
            style={branding?.bannerTitleColor ? { color: branding.bannerTitleColor } : undefined}
          >
            {bannerTitle}
          </p>
          <p
            className='mt-5 max-w-lg text-pretty text-base leading-7 text-jpv-canvas/70'
            style={branding?.bannerTextColor ? { color: branding.bannerTextColor } : undefined}
          >
            {bannerDescription}
          </p>
        </div>

        <p className='relative max-w-md border-t border-jpv-sunshine pt-4 text-sm leading-6 text-jpv-canvas/70'>
          Invest wisely, steward faithfully, bless generously.
        </p>
      </section>

      <section
        className='flex min-h-[calc(100vh-4rem)] items-center justify-center py-8 lg:min-h-0 lg:py-12'
        style={branding?.formBackgroundColor ? { backgroundColor: branding.formBackgroundColor } : undefined}
      >
        <div className='w-full max-w-xl'>
          <Link className='mb-10 flex w-fit items-center gap-3 lg:hidden' href='/'>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt={jpvBrand.logoAlt} className='h-11 w-11 rounded-jpv-card object-cover' src={logoUrl} />
            <span className='text-base font-bold'>{siteTitle}</span>
          </Link>

          <div>
            <p className='jpv-eyebrow'>{eyebrow}</p>
            <h1
              className='jpv-editorial-heading mt-4 text-balance text-4xl leading-tight sm:text-5xl'
              style={branding?.formTitleColor ? { color: branding.formTitleColor } : undefined}
            >
              {title}
            </h1>
            <p
              className='mt-4 max-w-lg text-pretty text-sm leading-7 text-jpv-muted sm:text-base'
              style={branding?.formTextColor ? { color: branding.formTextColor } : undefined}
            >
              {description}
            </p>
            {introActions ? <div className='mt-6'>{introActions}</div> : null}
          </div>

          <div className='mt-8 border-t border-jpv-border pt-8'>{children}</div>
          {footer ? <div className='mt-7 border-t border-jpv-border pt-6'>{footer}</div> : null}
        </div>
      </section>
    </main>
  )
}
