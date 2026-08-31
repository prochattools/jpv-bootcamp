'use client'

import type { ReactNode } from 'react'

import { useAdminMode } from '@/components/portal/AdminModeContext'

/**
 * Shows member-facing portal content whenever Admin Mode is off. Non-admin
 * members always remain in this view; the gate only hides it for an admin
 * while the admin presentation is enabled.
 */
export function MemberModeGate({ children }: { children: ReactNode }) {
  const { isAdmin, adminModeOn } = useAdminMode()
  if (isAdmin && adminModeOn) return null
  return <>{children}</>
}
