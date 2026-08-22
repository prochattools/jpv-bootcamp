'use client'

import { Menu } from 'lucide-react'

type PortalTopBarProps = {
  onMobileMenuOpen: () => void
}

export function PortalTopBar({ onMobileMenuOpen }: PortalTopBarProps) {
  return (
    <div className='flex shrink-0 items-center justify-between border-b border-jpv-border bg-jpv-surface px-4 py-4 lg:px-8'>
      <button
        aria-label='Open navigation menu'
        className='flex min-h-11 min-w-11 items-center justify-center rounded-jpv-action text-jpv-ink transition hover:bg-jpv-canvas lg:hidden'
        onClick={onMobileMenuOpen}
        type='button'
      >
        <Menu aria-hidden='true' className='h-5 w-5' />
      </button>
      <div className='flex-1' />
    </div>
  )
}
