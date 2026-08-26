'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export type PortalTheme = 'light' | 'dark'

type PortalThemeContextValue = {
  theme: PortalTheme
  setTheme: (theme: PortalTheme) => void
  toggleTheme: () => void
}

const PortalThemeContext = createContext<PortalThemeContextValue | null>(null)

/**
 * Themes are scoped to the authenticated member portal. The portal intentionally
 * starts light on every open; this prevents a previous dark preference from
 * leaking into public pages and keeps the initial server/client render stable.
 */
export function PortalThemeProvider({
  children,
  enabled = true,
}: {
  children: ReactNode
  enabled?: boolean
}) {
  const [theme, setTheme] = useState<PortalTheme>('light')

  useEffect(() => {
    if (!enabled) setTheme('light')
  }, [enabled])

  const toggleTheme = useCallback(() => {
    if (!enabled) return
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }, [enabled])

  const value = useMemo<PortalThemeContextValue>(
    () => ({
      theme: enabled ? theme : 'light',
      setTheme: (nextTheme) => {
        if (enabled) setTheme(nextTheme)
      },
      toggleTheme,
    }),
    [enabled, theme, toggleTheme],
  )

  const effectiveTheme = enabled ? theme : 'light'

  return (
    <PortalThemeContext.Provider value={value}>
      <div
        className={`jpv-portal-theme-root h-full min-h-0 min-w-0${effectiveTheme === 'dark' ? ' dark' : ''}`}
        data-portal-theme={effectiveTheme}
      >
        {children}
      </div>
    </PortalThemeContext.Provider>
  )
}

export function usePortalTheme(): PortalThemeContextValue {
  const context = useContext(PortalThemeContext)
  if (!context) {
    throw new Error('usePortalTheme must be used within PortalThemeProvider')
  }
  return context
}
