'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

export type AdminModeContextValue = {
  isAdmin: boolean
  adminModeOn: boolean
  toggleAdminMode: () => void
}

const AdminModeContext = createContext<AdminModeContextValue>({
  isAdmin: false,
  adminModeOn: false,
  toggleAdminMode: () => {},
})

export function AdminModeProvider({
  children,
  isAdmin,
}: {
  children: ReactNode
  isAdmin: boolean
}) {
  const [adminModeOn, setAdminModeOn] = useState(isAdmin)

  return (
    <AdminModeContext.Provider
      value={{
        isAdmin,
        adminModeOn: isAdmin && adminModeOn,
        toggleAdminMode: isAdmin ? () => setAdminModeOn((v) => !v) : () => {},
      }}
    >
      {children}
    </AdminModeContext.Provider>
  )
}

export function useAdminMode(): AdminModeContextValue {
  return useContext(AdminModeContext)
}
