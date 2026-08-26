import type { ReactNode } from 'react'

export function StatusPill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'good' | 'warn' | 'neutral'
}) {
  const className =
    tone === 'good'
      ? 'border-jpv-brand/20 bg-emerald-50 text-emerald-700'
      : tone === 'warn'
        ? 'border-jpv-sunshine bg-jpv-surface text-jpv-sunshine-ink'
        : 'border-jpv-border bg-jpv-canvas text-jpv-muted'

  return (
    <span className={`inline-flex rounded-jpv-pill border px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] ${className}`}>
      {children}
    </span>
  )
}
