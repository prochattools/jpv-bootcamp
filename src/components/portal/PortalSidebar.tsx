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
  Shield,
  Trophy,
  UserCircle,
  Users,
  Video,
  X,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import type { ComponentType, SVGProps } from 'react'

import { AccessibleDialog } from '@/components/ui/AccessibleDialog'
import { useAdminMode } from '@/components/portal/AdminModeContext'
import { jpvBrand } from '@/lib/brand/jpvDesignSystem'
import type { PortalNavGroup, PortalNavItem } from '@/lib/portal-navigation'

const ICON_MAP: Record<string, LucideIcon> = {
  Bookmark,
  CreditCard,
  FolderOpen,
  GraduationCap,
  Handshake,
  LayoutDashboard,
  Newspaper,
  PlayCircle,
  Settings,
  Trophy,
  UserCircle,
  Users,
  Video,
}

function resolveIcon(name: string | null | undefined): LucideIcon | null {
  if (!name) return null
  return ICON_MAP[name] ?? null
}

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
      { href: '/portal/rooms', label: 'Rooms', Icon: Video },
      // /portal/live-sessions remains a supported legacy alias for Rooms.
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
    ? 'flex min-h-11 min-w-0 items-center gap-3 rounded-jpv-action bg-jpv-brand-deep px-3 py-2 text-sm font-semibold text-jpv-canvas'
    : 'flex min-h-11 min-w-0 items-center gap-3 rounded-jpv-action px-3 py-2 text-sm font-medium text-jpv-ink transition hover:bg-jpv-canvas hover:text-jpv-brand-deep'
}

function SidebarContent({
  pathname,
  showLogout,
  onLogout,
  logoutSubmitting,
  logoutError,
  onNavigate,
  navPinned,
  navGroups,
}: {
  pathname: string
  showLogout: boolean
  onLogout: () => void
  logoutSubmitting: boolean
  logoutError: string | null
  onNavigate?: () => void
  navPinned?: PortalNavItem[]
  navGroups?: PortalNavGroup[]
}) {
  const { isAdmin } = useAdminMode()
  const pinnedItems: PortalNavItem[] = navPinned ?? [{ label: 'Start here', href: '/portal/community/start-here', iconName: 'PlayCircle', navGroup: '_pinned', groupSortOrder: 0, itemSortOrder: 0, highlighted: true }]
  const groups: PortalNavGroup[] = navGroups ?? sidebarGroups.map(g => ({ title: g.title, sortOrder: 0, items: g.items.map(i => ({ label: i.label, href: i.href, iconName: null as string | null, navGroup: g.title, groupSortOrder: 0, itemSortOrder: 0, highlighted: false })) }))

  return (
    <>
      {/* Logo */}
      <div className='flex h-20 shrink-0 items-center justify-between border-b border-jpv-border px-5 dark:border-[var(--jpv-border)]'>
        <Link href='/portal' onClick={onNavigate}>
          <img alt={jpvBrand.logoAlt} className='h-14 w-auto object-contain' src={jpvBrand.logoHorizontalPath} />
        </Link>
        {isAdmin && (
          <span className='ml-2 flex items-center gap-0.5 rounded-sm bg-jpv-brand-deep px-1.5 py-0.5 text-[0.6rem] font-extrabold uppercase tracking-widest text-jpv-canvas'>
            <Shield aria-hidden='true' className='h-2.5 w-2.5 shrink-0' />
            Admin
          </span>
        )}
      </div>

      <nav aria-label='Member portal' className='flex min-w-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3 sm:px-3 sm:py-4 dark:text-[var(--jpv-ink)]'>
        {/* Pinned/highlighted items at top */}
        {pinnedItems.length > 0 && (
          <div className='mb-2'>
            {pinnedItems.map((item) => {
              const Icon = resolveIcon(item.iconName)
              const active = isActive(pathname, item.href)
              return (
                <Link
                  key={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={
                    active
                      ? 'flex min-h-11 min-w-0 items-center gap-3 rounded-jpv-action bg-jpv-brand-deep px-3 py-2 text-sm font-semibold text-jpv-canvas'
                      : 'flex min-h-11 min-w-0 items-center gap-3 rounded-jpv-action bg-jpv-brand/10 px-3 py-2 text-sm font-semibold text-jpv-brand-deep transition hover:bg-jpv-brand/20'
                  }
                  href={item.href}
                  onClick={onNavigate}
                >
                  {Icon && <Icon aria-hidden='true' className='h-4.5 w-4.5 shrink-0' />}
                  <span className='min-w-0 truncate'>{item.label}</span>
                </Link>
              )
            })}
          </div>
        )}

        {/* Dynamic nav groups */}
        {groups.map((group) => (
          <div className='mb-1' key={group.title}>
            <p className='mb-1 px-3 text-[0.6875rem] font-extrabold uppercase tracking-wider text-jpv-muted'>
              {group.title}
            </p>
            {group.items.map((item) => {
              const Icon = resolveIcon(item.iconName)
              const active = isActive(pathname, item.href)
              return (
                <Link
                  key={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={navLinkClass(active)}
                  href={item.href}
                  onClick={onNavigate}
                >
                  {Icon && <Icon aria-hidden='true' className='h-4.5 w-4.5 shrink-0' />}
                  <span className='min-w-0 truncate'>{item.label}</span>
                </Link>
              )
            })}
          </div>
        ))}

        {/* Account section — always at bottom */}
        <div className='mt-auto border-t border-jpv-border pt-2 dark:border-[var(--jpv-border)]'>
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
                <span className='min-w-0 truncate'>{item.label}</span>
              </Link>
            )
          })}
          {showLogout ? (
            <>
              <button
                className='flex min-h-11 w-full items-center gap-3 rounded-jpv-action px-3 py-2 text-sm font-medium text-jpv-ink transition hover:bg-jpv-canvas hover:text-jpv-brand-deep disabled:cursor-not-allowed disabled:opacity-60'
                disabled={logoutSubmitting}
                onClick={onLogout}
                type='button'
              >
                <LogOut aria-hidden='true' className='h-4.5 w-4.5 shrink-0' />
                <span className='min-w-0 truncate'>{logoutSubmitting ? 'Signing out…' : 'Sign out'}</span>
              </button>
              {logoutError ? (
                <p aria-live='polite' className='px-3 pt-1 text-xs text-red-700' role='alert'>
                  {logoutError}
                </p>
              ) : null}
            </>
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
  navPinned?: PortalNavItem[]
  navGroups?: PortalNavGroup[]
}

export function PortalSidebar({ showLogout, mobileOpen, onMobileClose, navPinned, navGroups }: PortalSidebarProps) {
  const pathname = usePathname()
  const [logoutSubmitting, setLogoutSubmitting] = useState(false)
  const [logoutError, setLogoutError] = useState<string | null>(null)

  async function handleLogout() {
    setLogoutError(null)
    setLogoutSubmitting(true)
    try {
      const response = await fetch('/api/portal/logout', {
        method: 'POST',
        credentials: 'include',
      })
      if (response.ok) {
        window.location.assign('/portal?mode=login&loggedOut=1')
      } else {
        setLogoutError('Sign out could not be completed. Please try again.')
      }
    } catch {
      setLogoutError('Sign out is temporarily unavailable. Please try again.')
    } finally {
      setLogoutSubmitting(false)
    }
  }

  return (
    <>
      <aside
        className='hidden h-full min-h-0 flex-col border-r border-jpv-border bg-jpv-surface lg:sticky lg:top-0 lg:flex dark:border-[var(--jpv-border)] dark:bg-[var(--jpv-surface)]'
        data-portal-sidebar
      >
        <SidebarContent
          logoutError={logoutError}
          logoutSubmitting={logoutSubmitting}
          navGroups={navGroups}
          navPinned={navPinned}
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
          <div className='flex h-full w-[280px] max-w-[calc(100vw-3rem)] flex-col bg-jpv-surface shadow-xl dark:bg-[var(--jpv-surface)]'>
            <div className='flex items-center justify-between border-b border-jpv-border px-4 py-3 dark:border-[var(--jpv-border)]'>
              <h2 className='text-sm font-semibold text-jpv-ink dark:text-[var(--jpv-ink)]' id='portal-sidebar-title'>
                Navigation
              </h2>
              <button
                aria-label='Close navigation'
                className='flex min-h-11 min-w-11 items-center justify-center rounded-jpv-action text-jpv-ink transition hover:bg-jpv-canvas dark:text-[var(--jpv-ink)] dark:hover:bg-[var(--jpv-canvas)]'
                onClick={onMobileClose}
                type='button'
              >
                <X aria-hidden='true' className='h-5 w-5' />
              </button>
            </div>
            <div className='flex flex-1 flex-col overflow-y-auto'>
              <SidebarContent
                logoutError={logoutError}
                logoutSubmitting={logoutSubmitting}
                navGroups={navGroups}
                navPinned={navPinned}
                onLogout={handleLogout}
                onNavigate={onMobileClose}
                pathname={pathname}
                showLogout={showLogout}
              />
            </div>
          </div>
          <div aria-hidden='true' className='flex-1 bg-jpv-ink/30 dark:bg-[color-mix(in_srgb,var(--jpv-ink)_30%,transparent)]' onClick={onMobileClose} />
        </div>
      </AccessibleDialog>
    </>
  )
}
