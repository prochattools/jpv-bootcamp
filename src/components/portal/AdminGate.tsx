'use client'

import type { ReactNode } from 'react'

import { useAdminMode } from '@/components/portal/AdminModeContext'

/**
 * Renders children only when the session actor is a platform admin AND admin
 * mode is enabled. This is a PRESENTATION gate only — it never authorizes
 * mutations. Every server action or server route behind this gate must
 * independently re-derive the actor via requirePortalAccess or requirePortalMember.
 */
export function AdminGate({ children }: { children: ReactNode }) {
  const { isAdmin, adminModeOn } = useAdminMode()
  if (!isAdmin || !adminModeOn) return null
  return <>{children}</>
}
