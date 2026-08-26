import type { ReactNode } from 'react'

type ResponsiveDataTableProps = {
  label: string
  children: ReactNode
  className?: string
}

export function ResponsiveDataTable({
  label,
  children,
  className = '',
}: ResponsiveDataTableProps) {
  return (
    <div className={className}>
      <p className='mb-2 text-xs text-jpv-muted sm:hidden'>Scroll horizontally to view all columns.</p>
      <div
        aria-label={label}
        className='overflow-x-auto rounded-jpv-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jpv-green-deep focus-visible:ring-offset-2'
        role='region'
        tabIndex={0}
      >
        {children}
      </div>
    </div>
  )
}
