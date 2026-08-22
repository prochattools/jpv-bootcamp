import type { ReactNode } from 'react'

import { PortalShell } from '@/components/portal/PortalShell'
import { resolvePayloadRequestSession } from '@/lib/auth/payloadSession'
import { headers } from 'next/headers'

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const requestHeaders = await headers()
  const session = await resolvePayloadRequestSession(requestHeaders)
  const showLogout = Boolean(session.member?.id || session.administratorId)

  return (
    <div className='jpv-product-shell min-h-screen bg-jpv-canvas text-jpv-ink'>
      <PortalShell showLogout={showLogout}>
        {children}
      </PortalShell>
    </div>
  )
}
