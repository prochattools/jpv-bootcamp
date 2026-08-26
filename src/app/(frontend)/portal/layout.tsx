import type { ReactNode } from 'react'

import { PortalShell } from '@/components/portal/PortalShell'
import { ThemeProvider } from '@/components/theme-provider'
import { cachedResolvePayloadRequestSession } from '@/lib/auth/payloadSession'
import { getPortalNavigation } from '@/lib/portal-navigation'
import { headers } from 'next/headers'

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const requestHeaders = await headers()
  const [session, nav] = await Promise.all([
    cachedResolvePayloadRequestSession(requestHeaders),
    getPortalNavigation(),
  ])
  const showLogout = Boolean(session.member?.id || session.administratorId)
  const isAdmin = Boolean(session.administratorId && !session.unresolvedCollection)
  const isAuthenticated = Boolean(
    (session.member?.id && !session.unresolvedCollection) || isAdmin,
  )

  return (
    <ThemeProvider
      attribute='class'
      defaultTheme='light'
      enableSystem={false}
      disableTransitionOnChange
      storageKey='jpv-portal-theme'
      // Keep every portal route light by default. PortalShell mounts a second
      // provider only for authenticated portal pages where the toggle exists.
      forcedTheme='light'
    >
      <div className='jpv-product-shell h-[100dvh] min-h-0 min-w-0 overflow-hidden bg-jpv-canvas text-jpv-ink dark:bg-[var(--jpv-canvas)] dark:text-[var(--jpv-ink)]'>
        <PortalShell
          isAdmin={isAdmin}
          showLogout={showLogout}
          showThemeToggle={isAuthenticated}
          navPinned={nav.pinned}
          navGroups={nav.groups}
        >
          {children}
        </PortalShell>
      </div>
    </ThemeProvider>
  )
}
