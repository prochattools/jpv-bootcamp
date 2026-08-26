'use client'

import type { ReactNode } from 'react'
import { useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

import { AdminModeProvider } from '@/components/portal/AdminModeContext'
import { PortalSidebar } from '@/components/portal/PortalSidebar'
import { PortalTopBar } from '@/components/portal/PortalTopBar'
import { ThemeProvider } from '@/components/theme-provider'
import type { PortalNavGroup, PortalNavItem } from '@/lib/portal-navigation'

type PortalShellProps = {
  children: ReactNode
  isAdmin?: boolean
  showLogout: boolean
  showThemeToggle?: boolean
  navPinned?: PortalNavItem[]
  navGroups?: PortalNavGroup[]
}

export function PortalShell({
  children,
  isAdmin = false,
  showLogout,
  showThemeToggle = false,
  navPinned,
  navGroups,
}: PortalShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isPortalLogin = pathname === '/portal' && searchParams.get('mode') === 'login'
  const allowPortalTheme = showThemeToggle && !isPortalLogin

  const portalContent = (
    <div className='grid h-full min-h-0 min-w-0 lg:grid-cols-[260px_minmax(0,1fr)]'>
      <PortalSidebar
        mobileOpen={mobileMenuOpen}
        navGroups={navGroups}
        navPinned={navPinned}
        onMobileClose={() => setMobileMenuOpen(false)}
        showLogout={showLogout}
      />
      <div className='flex h-full min-h-0 min-w-0 flex-col'>
        <PortalTopBar
          onMobileMenuOpen={() => setMobileMenuOpen(true)}
          showThemeToggle={showThemeToggle}
        />
        <main className='min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 lg:px-8 lg:py-5'>
          {children}
        </main>
      </div>
    </div>
  )

  return (
    <AdminModeProvider isAdmin={isAdmin}>
      {allowPortalTheme ? (
        <ThemeProvider
          attribute='class'
          defaultTheme='light'
          enableSystem={false}
          disableTransitionOnChange
          storageKey='jpv-portal-theme'
        >
          {portalContent}
        </ThemeProvider>
      ) : portalContent}
    </AdminModeProvider>
  )
}
