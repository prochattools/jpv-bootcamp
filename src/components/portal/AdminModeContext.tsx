'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

export type AdminModeContextValue = {
  isAdmin: boolean
  adminModeOn: boolean
  toggleAdminMode: () => void
}

const AdminModeContext = createContext<AdminModeContextValue>({
  isAdmin: false,
  adminModeOn: false,
  toggleAdminMode: () => undefined,
})

export function AdminModeProvider({
  children,
  isAdmin,
}: {
  children: ReactNode
  isAdmin: boolean
}) {
  const [adminModeOn, setAdminModeOn] = useState(isAdmin)

  useEffect(() => {
    if (!isAdmin) setAdminModeOn(false)
  }, [isAdmin])

  const toggleAdminMode = useCallback(() => {
    if (isAdmin) setAdminModeOn((current) => !current)
  }, [isAdmin])

  return (
    <AdminModeContext.Provider
      value={{
        isAdmin,
        // This is a presentation flag only. The server rechecks admin access
        // for every mutation, including when an administrator turns the mode off.
        adminModeOn,
        toggleAdminMode,
      }}
    >
      {children}
    </AdminModeContext.Provider>
  )
}

export function useAdminMode(): AdminModeContextValue {
  return useContext(AdminModeContext)
}
