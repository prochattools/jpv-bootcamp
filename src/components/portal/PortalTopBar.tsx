'use client'

import { Bell, Menu, UserCircle } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { ThemeToggle } from '@/components/portal/ThemeToggle'

const PAGE_TITLES: Record<string, string> = {
  '/portal': 'Dashboard',
  '/portal/courses': 'Courses',
  '/portal/live-sessions': 'Live Sessions',
  '/portal/content': 'Updates',
  '/portal/community': 'Community',
  '/portal/leaderboard': 'Leaderboard',
  '/portal/bookmarks': 'Bookmarks',
  '/portal/members': 'Members',
  '/portal/partners': 'Partners',
  '/portal/resources': 'Resources',
  '/portal/account': 'Account',
  '/portal/billing': 'Billing',
  '/portal/support': 'Support',
  '/portal/programme': 'Programme',
}

function resolvePageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  for (const [prefix, title] of Object.entries(PAGE_TITLES)) {
    if (prefix !== '/portal' && pathname.startsWith(`${prefix}/`)) return title
  }
  return 'Portal'
}

type PortalTopBarProps = {
  onMobileMenuOpen: () => void
}

export function PortalTopBar({ onMobileMenuOpen }: PortalTopBarProps) {
  const pathname = usePathname()
  const pageTitle = resolvePageTitle(pathname)

  return (
    <header
      className='flex h-16 shrink-0 items-center justify-between border-b border-jpv-border bg-jpv-canvas px-4 sm:px-6 lg:px-8'
      data-portal-topbar
    >
      <div className='flex items-center gap-3'>
        <button
          aria-label='Open navigation'
          className='flex min-h-11 min-w-11 items-center justify-center rounded-jpv-action text-jpv-ink transition hover:bg-jpv-surface lg:hidden'
          onClick={onMobileMenuOpen}
          type='button'
        >
          <Menu aria-hidden='true' className='h-5 w-5' />
        </button>
        <h1 className='text-lg font-semibold text-jpv-ink'>{pageTitle}</h1>
      </div>

      <div className='flex items-center gap-1'>
        <ThemeToggle />
        <button
          aria-label='Notifications'
          className='flex min-h-11 min-w-11 items-center justify-center rounded-jpv-action text-jpv-muted transition hover:bg-jpv-surface hover:text-jpv-ink'
          type='button'
        >
          <Bell aria-hidden='true' className='h-5 w-5' />
        </button>
        <Link
          aria-label='Account settings'
          className='flex h-9 w-9 items-center justify-center rounded-full bg-jpv-brand-deep text-xs font-bold text-jpv-canvas transition hover:bg-jpv-brand-hover'
          href='/portal/account'
        >
          <UserCircle aria-hidden='true' className='h-5 w-5' />
        </Link>
      </div>
    </header>
  )
}
