'use client'

import { createContext, useContext, type ReactNode } from 'react'

export type AdminModeContextValue = {
  isAdmin: boolean
  adminModeOn: boolean
}

const AdminModeContext = createContext<AdminModeContextValue>({
  isAdmin: false,
  adminModeOn: false,
})

export function AdminModeProvider({
  children,
  isAdmin,
}: {
  children: ReactNode
  isAdmin: boolean
}) {
  return (
    <AdminModeContext.Provider
      value={{
        isAdmin,
        // This is a presentation flag only. The server rechecks admin access
        // for every mutation; an admin should not need a second mode toggle.
        adminModeOn: isAdmin,
      }}
    >
      {children}
    </AdminModeContext.Provider>
  )
}

export function useAdminMode(): AdminModeContextValue {
  return useContext(AdminModeContext)
}
