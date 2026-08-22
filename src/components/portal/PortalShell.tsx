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
    <div className='grid lg:grid-cols-[260px_1fr]'>
      <PortalSidebar
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
        showLogout={showLogout}
      />
      <div className='flex min-h-screen flex-col'>
        <PortalTopBar
          onMobileMenuOpen={() => setMobileMenuOpen(true)}
        />
        <main className='flex-1 px-4 py-8 sm:px-6 lg:px-8 lg:py-10'>
          {children}
        </main>
      </div>
    </div>
  )
}
