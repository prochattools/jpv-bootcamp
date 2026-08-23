'use client'

import type { ReactNode } from 'react'
import { useState } from 'react'

import { PortalSidebar } from '@/components/portal/PortalSidebar'
import { PortalTopBar } from '@/components/portal/PortalTopBar'

type PortalShellProps = {
  children: ReactNode
  showLogout: boolean
}

export function PortalShell({ children, showLogout }: PortalShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className='grid h-full min-h-0 min-w-0 lg:grid-cols-[260px_minmax(0,1fr)]'>
      <PortalSidebar
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
        showLogout={showLogout}
      />
      <div className='flex h-full min-h-0 min-w-0 flex-col'>
        <PortalTopBar
          onMobileMenuOpen={() => setMobileMenuOpen(true)}
        />
        <main className='min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 py-8 sm:px-6 lg:px-8 lg:py-10'>
          {children}
        </main>
      </div>
    </div>
  )
}
