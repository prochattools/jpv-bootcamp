'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <button
        aria-label='Toggle theme'
        className='flex min-h-11 min-w-11 items-center justify-center rounded-jpv-action text-jpv-muted transition hover:bg-jpv-surface hover:text-jpv-ink'
        type='button'
      >
        <Sun aria-hidden='true' className='h-5 w-5' />
      </button>
    )
  }

  const isDark = resolvedTheme === 'dark'

  return (
    <button
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className='flex min-h-11 min-w-11 items-center justify-center rounded-jpv-action text-jpv-muted transition hover:bg-jpv-surface hover:text-jpv-ink'
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      type='button'
    >
      {isDark ? (
        <Sun aria-hidden='true' className='h-5 w-5' />
      ) : (
        <Moon aria-hidden='true' className='h-5 w-5' />
      )}
    </button>
  )
}
