'use client'

import { Menu, Shield, UserCircle } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { useAdminMode } from '@/components/portal/AdminModeContext'
import { NotificationBell } from '@/components/portal/NotificationBell'
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
  const { isAdmin, adminModeOn, toggleAdminMode } = useAdminMode()

  return (
    <header
      className='flex h-16 min-w-0 shrink-0 items-center justify-between border-b border-jpv-border bg-jpv-canvas px-2 sm:px-6 lg:px-8 dark:border-[var(--jpv-border)] dark:bg-[var(--jpv-canvas)]'
      data-portal-topbar
    >
      <div className='flex min-w-0 flex-1 items-center gap-1 sm:gap-3'>
        <button
          aria-label='Open navigation'
          className='flex min-h-11 min-w-11 items-center justify-center rounded-jpv-action text-jpv-ink transition hover:bg-jpv-surface dark:text-[var(--jpv-ink)] dark:hover:bg-[var(--jpv-surface)] lg:hidden'
          onClick={onMobileMenuOpen}
          type='button'
        >
          <Menu aria-hidden='true' className='h-5 w-5' />
        </button>
        <h1 className='min-w-0 truncate text-lg font-semibold text-jpv-ink dark:text-[var(--jpv-ink)]'>{pageTitle}</h1>
      </div>

      <div className='flex shrink-0 items-center gap-0 sm:gap-1'>
        {isAdmin && (
          <>
            <button
              aria-label={adminModeOn ? 'Disable admin controls' : 'Enable admin controls'}
              aria-pressed={adminModeOn}
              className={`flex items-center gap-1.5 rounded-jpv-action px-2 py-1.5 text-xs font-semibold transition sm:px-2.5 ${
                adminModeOn
                  ? 'bg-jpv-brand-deep text-jpv-canvas hover:bg-jpv-brand-hover'
                  : 'bg-jpv-surface text-jpv-muted hover:bg-jpv-border dark:bg-[var(--jpv-surface)] dark:text-[var(--jpv-muted)] dark:hover:bg-[var(--jpv-border)]'
              }`}
              onClick={toggleAdminMode}
              type='button'
            >
              <Shield aria-hidden='true' className='h-3.5 w-3.5 shrink-0' />
              <span className='hidden sm:inline'>{adminModeOn ? 'Admin On' : 'Admin Off'}</span>
            </button>
          </>
        )}
        <ThemeToggle />
        <NotificationBell />
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
