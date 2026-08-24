'use client'

import {
  Bookmark,
  CreditCard,
  FolderOpen,
  GraduationCap,
  Handshake,
  LayoutDashboard,
  LogOut,
  Newspaper,
  PlayCircle,
  Settings,
  Trophy,
  UserCircle,
  Users,
  Video,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import type { ComponentType, SVGProps } from 'react'

import { AccessibleDialog } from '@/components/ui/AccessibleDialog'
import { jpvBrand } from '@/lib/brand/jpvDesignSystem'

type NavItem = {
  href: string
  label: string
  Icon: ComponentType<SVGProps<SVGSVGElement> & { className?: string }>
}

type NavGroup = {
  title: string
  items: NavItem[]
}

const sidebarGroups: NavGroup[] = [
  {
    title: 'Learn',
    items: [
      { href: '/portal', label: 'Dashboard', Icon: LayoutDashboard },
      { href: '/portal/courses', label: 'Courses', Icon: GraduationCap },
      { href: '/portal/live-sessions', label: 'Live', Icon: Video },
      { href: '/portal/content', label: 'Updates', Icon: Newspaper },
    ],
  },
  {
    title: 'Community',
    items: [
      { href: '/portal/community', label: 'Community', Icon: Users },
      { href: '/portal/leaderboard', label: 'Leaderboard', Icon: Trophy },
      { href: '/portal/members', label: 'Members', Icon: UserCircle },
      { href: '/portal/bookmarks', label: 'Bookmarks', Icon: Bookmark },
    ],
  },
  {
    title: 'Explore',
    items: [
      { href: '/portal/resources', label: 'Resources', Icon: FolderOpen },
      { href: '/portal/partners', label: 'Partners', Icon: Handshake },
    ],
  },
]

const accountItems: NavItem[] = [
  { href: '/portal/account', label: 'Account', Icon: Settings },
  { href: '/portal/billing', label: 'Billing', Icon: CreditCard },
]

function isActive(pathname: string, href: string): boolean {
  return href === '/portal' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
}

function navLinkClass(active: boolean): string {
  return active
    ? 'flex min-h-11 items-center gap-3 rounded-jpv-action bg-jpv-brand-deep px-3 py-2 text-sm font-semibold text-jpv-canvas'
    : 'flex min-h-11 items-center gap-3 rounded-jpv-action px-3 py-2 text-sm font-medium text-jpv-ink transition hover:bg-jpv-canvas hover:text-jpv-brand-deep'
}

function SidebarContent({
  pathname,
  showLogout,
  onLogout,
  logoutSubmitting,
  onNavigate,
}: {
  pathname: string
  showLogout: boolean
  onLogout: () => void
  logoutSubmitting: boolean
  onNavigate?: () => void
}) {
  return (
    <>
      <div className='flex h-20 shrink-0 items-center border-b border-jpv-border px-5'>
        <Link href='/portal' onClick={onNavigate}>
          <img
            alt={jpvBrand.logoAlt}
            className='h-14 w-auto object-contain'
            src={jpvBrand.logoHorizontalPath}
          />
        </Link>
      </div>

      <nav aria-label='Member portal' className='flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4'>
        {/* Start here — always-visible onboarding entry point */}
        <div className='mb-3'>
          <Link
            aria-current={isActive(pathname, '/portal/community/start-here') ? 'page' : undefined}
            className={
              isActive(pathname, '/portal/community/start-here')
                ? 'flex min-h-11 items-center gap-3 rounded-jpv-action bg-jpv-brand-deep px-3 py-2 text-sm font-semibold text-jpv-canvas'
                : 'flex min-h-11 items-center gap-3 rounded-jpv-action bg-jpv-brand/10 px-3 py-2 text-sm font-semibold text-jpv-brand-deep transition hover:bg-jpv-brand/20'
            }
            href='/portal/community/start-here'
          >
            <PlayCircle aria-hidden='true' className='h-4.5 w-4.5 shrink-0' />
            Start here
          </Link>
        </div>

        {sidebarGroups.map((group) => (
          <div className='mb-2' key={group.title}>
            <p className='mb-1 px-3 text-[0.6875rem] font-extrabold uppercase tracking-wider text-jpv-muted'>
              {group.title}
            </p>
            {group.items.map((item) => {
              const active = isActive(pathname, item.href)
              return (
                <Link
                  aria-current={active ? 'page' : undefined}
                  className={navLinkClass(active)}
                  href={item.href}
                  key={item.href}
                  onClick={onNavigate}
                >
                  <item.Icon aria-hidden='true' className='h-4.5 w-4.5 shrink-0' />
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}

        <div className='mt-auto border-t border-jpv-border pt-3'>
          {accountItems.map((item) => {
            const active = isActive(pathname, item.href)
            return (
              <Link
                aria-current={active ? 'page' : undefined}
                className={navLinkClass(active)}
                href={item.href}
                key={item.href}
                onClick={onNavigate}
              >
                <item.Icon aria-hidden='true' className='h-4.5 w-4.5 shrink-0' />
                {item.label}
              </Link>
            )
          })}
          {showLogout ? (
            <button
              className='flex min-h-11 w-full items-center gap-3 rounded-jpv-action px-3 py-2 text-sm font-medium text-jpv-ink transition hover:bg-jpv-canvas hover:text-jpv-brand-deep disabled:cursor-not-allowed disabled:opacity-60'
              disabled={logoutSubmitting}
              onClick={onLogout}
              type='button'
            >
              <LogOut aria-hidden='true' className='h-4.5 w-4.5 shrink-0' />
              {logoutSubmitting ? 'Signing out…' : 'Sign out'}
            </button>
          ) : null}
        </div>
      </nav>
    </>
  )
}

type PortalSidebarProps = {
  showLogout: boolean
  mobileOpen: boolean
  onMobileClose: () => void
}

export function PortalSidebar({ showLogout, mobileOpen, onMobileClose }: PortalSidebarProps) {
  const pathname = usePathname()
  const [logoutSubmitting, setLogoutSubmitting] = useState(false)

  async function handleLogout() {
    setLogoutSubmitting(true)
    try {
      const response = await fetch('/api/payload_members/logout', {
        method: 'POST',
        credentials: 'include',
      })
      if (response.ok) {
        window.location.assign('/portal?mode=login&loggedOut=1')
      }
    } catch {
      // silent fail — user can retry
    } finally {
      setLogoutSubmitting(false)
    }
  }

  return (
    <>
      <aside
        className='hidden h-full min-h-0 flex-col border-r border-jpv-border bg-jpv-surface lg:sticky lg:top-0 lg:flex'
        data-portal-sidebar
      >
        <SidebarContent
          logoutSubmitting={logoutSubmitting}
          onLogout={handleLogout}
          pathname={pathname}
          showLogout={showLogout}
        />
      </aside>

      <AccessibleDialog
        className='fixed inset-0 z-50 lg:hidden'
        labelledBy='portal-sidebar-title'
        onClose={onMobileClose}
        open={mobileOpen}
      >
        <div className='flex h-full'>
          <div className='flex h-full w-[280px] max-w-[calc(100vw-3rem)] flex-col bg-jpv-surface shadow-xl'>
            <div className='flex items-center justify-between border-b border-jpv-border px-4 py-3'>
              <h2 className='text-sm font-semibold text-jpv-ink' id='portal-sidebar-title'>
                Navigation
              </h2>
              <button
                aria-label='Close navigation'
                className='flex min-h-11 min-w-11 items-center justify-center rounded-jpv-action text-jpv-ink transition hover:bg-jpv-canvas'
                onClick={onMobileClose}
                type='button'
              >
                <X aria-hidden='true' className='h-5 w-5' />
              </button>
            </div>
            <div className='flex flex-1 flex-col overflow-y-auto'>
              <SidebarContent
                logoutSubmitting={logoutSubmitting}
                onLogout={handleLogout}
                onNavigate={onMobileClose}
                pathname={pathname}
                showLogout={showLogout}
              />
            </div>
          </div>
          <div aria-hidden='true' className='flex-1 bg-jpv-ink/30' onClick={onMobileClose} />
        </div>
      </AccessibleDialog>
    </>
  )
}
