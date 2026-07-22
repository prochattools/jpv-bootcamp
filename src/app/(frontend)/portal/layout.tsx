import Link from 'next/link'
import type { ReactNode } from 'react'

import { MemberLogoutButton } from '@/components/auth/MemberLogoutButton'
import { resolvePayloadRequestSession } from '@/lib/auth/payloadSession'
import { jpvBrand } from '@/lib/brand/jpvDesignSystem'
import { headers } from 'next/headers'

// 'Programme preview' is omitted from the nav: it serves placeholder/draft
// content only and is not part of the live member experience. The route
// /portal/programme remains accessible for internal review.
const portalLinks = [
  { href: '/portal', label: 'Dashboard' },
  { href: '/portal/courses', label: 'Courses' },
  { href: '/portal/community', label: 'Community' },
  { href: '/portal/partners', label: 'Partners' },
  { href: '/portal/account', label: 'Account' },
  { href: '/portal/billing', label: 'Billing' },
] as const

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const requestHeaders = await headers()
  const session = await resolvePayloadRequestSession(requestHeaders)
  const showLogout = Boolean(session.member?.id || session.administratorId)

  return (
    <div className='jpv-product-shell min-h-screen bg-jpv-canvas text-jpv-ink'>
      <header className='border-b border-jpv-border bg-jpv-canvas'>
        <div className='mx-auto flex max-w-6xl flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between'>
          <Link className='flex items-center gap-3' href='/portal'>
            <img alt={jpvBrand.logoAlt} className='h-10 w-10 rounded-jpv-card object-contain' src={jpvBrand.logoPath} />
            <span>
              <span className='block text-base font-semibold'>{jpvBrand.name}</span>
              <span className='block text-xs text-jpv-muted'>Member portal</span>
            </span>
          </Link>

          <div className='flex flex-col gap-3 md:items-end'>
            <nav aria-label='Member portal' className='flex flex-wrap gap-2'>
              {portalLinks.map((link) => (
                <Link
                  className='rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 hover:text-neutral-950'
                  href={link.href}
                  key={link.href}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            {showLogout ? <MemberLogoutButton /> : null}
          </div>
        </div>
      </header>

      <main className='mx-auto w-full max-w-6xl px-6 py-10'>{children}</main>
    </div>
  )
}
