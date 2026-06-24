import Link from 'next/link'
import type { ReactNode } from 'react'

import { logoutMemberAction } from './actions'

type PortalShellProps = {
  children: ReactNode
  memberEmail?: string | null
}

export function PortalShell({ children, memberEmail }: PortalShellProps) {
  return (
    <div className='min-h-screen bg-[#f4f1e9] text-[#14261d]'>
      <header className='border-b border-[#193f2f]/10 bg-white/90 backdrop-blur'>
        <div className='mx-auto flex max-w-7xl items-center justify-between gap-5 px-6 py-5 lg:px-10'>
          <Link className='flex items-center gap-3' href='/learn'>
            <div className='flex h-11 w-11 items-center justify-center rounded-full bg-[#153f2e] text-sm font-bold tracking-wide text-[#f4eac6]'>
              JPV
            </div>
            <div>
              <p className='text-lg font-bold tracking-tight text-[#153f2e]'>JPV Bootcamp</p>
              <p className='text-xs font-medium uppercase tracking-[0.16em] text-[#8a7450]'>
                Learning Portal
              </p>
            </div>
          </Link>

          <nav className='hidden items-center gap-8 text-sm font-semibold text-[#355246] md:flex'>
            <Link className='transition hover:text-[#153f2e]' href='/learn'>
              Courses
            </Link>
            <Link className='transition hover:text-[#153f2e]' href='/learn/billing'>
              Billing
            </Link>
            <Link className='transition hover:text-[#153f2e]' href='/learn/community'>
              Community
            </Link>
            <Link className='transition hover:text-[#153f2e]' href='/learn/account'>
              Account
            </Link>
          </nav>

          {memberEmail ? (
            <div className='flex items-center gap-3'>
              <div className='hidden text-right sm:block'>
                <p className='text-sm font-semibold text-[#153f2e]'>{memberEmail}</p>
                <p className='text-xs text-[#6f7f77]'>JPV Bootcamp member</p>
              </div>
              <form action={logoutMemberAction}>
                <button
                  className='rounded-full border border-[#153f2e]/15 bg-white px-4 py-2 text-sm font-bold text-[#153f2e] transition hover:border-[#153f2e]/35'
                  type='submit'
                >
                  Sign out
                </button>
              </form>
            </div>
          ) : (
            <Link
              className='rounded-full bg-[#153f2e] px-5 py-2.5 text-sm font-bold text-white'
              href='/learn/login'
            >
              Sign in
            </Link>
          )}
        </div>
      </header>

      {children}
    </div>
  )
}

export function StatusPill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'good' | 'warn' | 'neutral' }) {
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
