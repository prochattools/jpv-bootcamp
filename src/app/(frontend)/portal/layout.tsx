import type { ReactNode } from 'react'

import { PortalShell } from '@/components/portal/PortalShell'
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

  return (
    <div className='jpv-product-shell h-[100dvh] min-h-0 min-w-0 overflow-hidden bg-jpv-canvas text-jpv-ink dark:bg-[var(--jpv-canvas)] dark:text-[var(--jpv-ink)]'>
      <PortalShell showLogout={showLogout} navPinned={nav.pinned} navGroups={nav.groups}>
        {children}
      </PortalShell>
    </div>
  )
}
