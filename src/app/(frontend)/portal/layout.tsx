import Link from 'next/link'
import type { ReactNode } from 'react'

import { MemberLogoutButton } from '@/components/auth/MemberLogoutButton'
import { resolvePayloadRequestSession } from '@/lib/auth/payloadSession'
import { headers } from 'next/headers'

const portalLinks = [
  { href: '/portal', label: 'Dashboard' },
  { href: '/portal/programme', label: 'Programme preview' },
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
    <div className='min-h-screen bg-neutral-50 text-neutral-950'>
      <header className='border-b border-neutral-200 bg-white'>
        <div className='mx-auto flex max-w-6xl flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between'>
          <Link className='flex items-center gap-3' href='/portal'>
            <img alt='JPV Bootcamp' className='h-10 w-10 object-contain' src='/images/jpv-logo.png' />
            <span className='text-lg font-semibold'>Member Portal</span>
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
