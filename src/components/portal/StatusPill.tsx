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
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : tone === 'warn'
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : 'border-[#153f2e]/10 bg-white text-[#51645b]'

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] ${className}`}>
      {children}
    </span>
  )
}
