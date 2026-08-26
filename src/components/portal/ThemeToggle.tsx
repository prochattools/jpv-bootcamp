'use client'

import { Moon, Sun } from 'lucide-react'
import { usePortalTheme } from '@/components/theme-provider'

export function ThemeToggle() {
  const { theme, toggleTheme } = usePortalTheme()
  const isDark = theme === 'dark'

  return (
    <button
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDark}
      className='flex min-h-11 min-w-11 items-center justify-center rounded-jpv-action text-jpv-muted transition hover:bg-jpv-surface hover:text-jpv-ink dark:text-[var(--jpv-muted)] dark:hover:bg-[var(--jpv-surface)] dark:hover:text-[var(--jpv-ink)]'
      onClick={toggleTheme}
      type='button'
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? (
        <Sun aria-hidden='true' className='h-5 w-5' />
      ) : (
        <Moon aria-hidden='true' className='h-5 w-5' />
      )}
      <span className='sr-only'>{isDark ? 'Dark mode is on' : 'Light mode is on'}</span>
    </button>
  )
}
