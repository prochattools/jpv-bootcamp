'use client'

import { Menu, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

import { MemberLogoutButton } from '@/components/auth/MemberLogoutButton'
import { AccessibleDialog } from '@/components/ui/AccessibleDialog'

const portalLinks = [
  { href: '/portal', label: 'Dashboard' },
  { href: '/portal/courses', label: 'Courses' },
  { href: '/portal/rooms', label: 'Rooms' },
  { href: '/portal/content', label: 'Updates' },
  { href: '/portal/community', label: 'Community' },
  { href: '/portal/leaderboard', label: 'Leaderboard' },
  { href: '/portal/bookmarks', label: 'Bookmarks' },
  { href: '/portal/members', label: 'Members' },
  { href: '/portal/partners', label: 'Partners' },
  { href: '/portal/account', label: 'Account' },
  { href: '/portal/billing', label: 'Billing' },
] as const

function isActive(pathname: string, href: string): boolean {
  return href === '/portal' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
}

function navLinkClass(active: boolean): string {
  return active
    ? 'flex min-h-11 items-center rounded-jpv-action bg-jpv-brand-deep px-3 py-2 text-sm font-semibold text-jpv-canvas'
    : 'flex min-h-11 items-center rounded-jpv-action px-3 py-2 text-sm font-medium text-jpv-ink transition hover:bg-jpv-surface hover:text-jpv-brand-deep'
}

export function PortalNavigation({ showLogout }: { showLogout: boolean }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      <div className='hidden items-center gap-3 lg:flex'>
        <nav aria-label='Member portal' className='flex items-center gap-1'>
          {portalLinks.map((link) => {
            const active = isActive(pathname, link.href)
            return (
              <Link aria-current={active ? 'page' : undefined} className={navLinkClass(active)} href={link.href} key={link.href}>
                {link.label}
              </Link>
            )
          })}
        </nav>
        {showLogout ? <MemberLogoutButton /> : null}
      </div>

      <button
        aria-controls='portal-mobile-navigation'
        aria-expanded={mobileOpen}
        aria-label='Open member portal navigation'
        className='jpv-button-secondary min-h-11 min-w-11 px-3 lg:hidden'
        onClick={() => setMobileOpen(true)}
        type='button'
      >
        <Menu aria-hidden='true' className='h-5 w-5' />
        <span className='sr-only'>Menu</span>
      </button>

      <AccessibleDialog
        className='w-[min(calc(100vw-2rem),28rem)] lg:hidden'
        labelledBy='portal-mobile-navigation-title'
        onClose={() => setMobileOpen(false)}
        open={mobileOpen}
      >
        <div className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-4 shadow-jpv-panel'>
          <div className='mb-4 flex items-center justify-between gap-4 border-b border-jpv-border pb-3'>
            <div>
              <p className='jpv-eyebrow'>Member portal</p>
              <h2 className='mt-1 text-lg font-semibold text-jpv-ink' id='portal-mobile-navigation-title'>
                Navigation
              </h2>
            </div>
            <button
              aria-label='Close member portal navigation'
              className='jpv-button-secondary min-h-11 min-w-11 px-3'
              onClick={() => setMobileOpen(false)}
              type='button'
            >
              <X aria-hidden='true' className='h-5 w-5' />
            </button>
          </div>

          <nav aria-label='Member portal mobile' className='grid gap-1' id='portal-mobile-navigation'>
            {portalLinks.map((link) => {
              const active = isActive(pathname, link.href)
              return (
                <Link
                  aria-current={active ? 'page' : undefined}
                  className={navLinkClass(active)}
                  href={link.href}
                  key={link.href}
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>

          {showLogout ? (
            <div className='mt-4 border-t border-jpv-border pt-4'>
              <MemberLogoutButton />
            </div>
          ) : null}
        </div>
      </AccessibleDialog>
    </>
  )
}
