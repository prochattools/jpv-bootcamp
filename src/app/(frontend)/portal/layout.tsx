import Link from 'next/link'
import type { ReactNode } from 'react'

import { PortalNavigation } from '@/components/portal/PortalNavigation'
import { resolvePayloadRequestSession } from '@/lib/auth/payloadSession'
import { jpvBrand } from '@/lib/brand/jpvDesignSystem'
import { headers } from 'next/headers'

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const requestHeaders = await headers()
  const session = await resolvePayloadRequestSession(requestHeaders)
  const showLogout = Boolean(session.member?.id || session.administratorId)

  return (
    <div className='jpv-product-shell min-h-screen bg-jpv-canvas text-jpv-ink'>
      <header className='border-b border-jpv-border bg-jpv-canvas'>
        <div className='mx-auto flex min-h-[4.75rem] max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6'>
          <Link className='flex min-w-0 items-center gap-3' href='/portal'>
            <img alt={jpvBrand.logoAlt} className='h-9 w-auto shrink-0 object-contain' src={jpvBrand.logoHorizontalPath} />
          </Link>

          <PortalNavigation showLogout={showLogout} />
        </div>
      </header>

      <main className='mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-10'>{children}</main>
    </div>
  )
}
