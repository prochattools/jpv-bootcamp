import { redirect } from 'next/navigation'

import { getCurrentPayloadMember } from '@/lib/members/currentMember'

import { LoginForm } from '../LoginForm'
import { PortalShell } from '../PortalShell'
import Link from 'next/link'

export const metadata = {
  title: 'Member Sign In | JPV Bootcamp',
  description: 'Sign in to your JPV Bootcamp learning portal.',
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? ''
}

function safeNextPath(value: string): string {
  if (!value.startsWith('/')) return '/learn'
  if (value.startsWith('//')) return '/learn'
  if (!value.startsWith('/learn')) return '/learn'
  return value
}

export default async function LearnLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { member } = await getCurrentPayloadMember()
  if (member) {
    redirect('/learn')
  }

  const params = await searchParams
  const nextPath = safeNextPath(firstParam(params.next))
  const loggedOut = firstParam(params.loggedOut) === '1'

  return (
    <PortalShell>
      <main className='mx-auto grid min-h-[calc(100vh-84px)] max-w-7xl items-center gap-10 px-6 py-12 lg:grid-cols-[1fr_0.85fr] lg:px-10'>
        <section>
          <p className='text-xs font-bold uppercase tracking-[0.2em] text-[#8a7450]'>
            JPV Bootcamp member access
          </p>
          <h1 className='mt-4 max-w-2xl text-4xl font-bold leading-tight tracking-tight text-[#153f2e] sm:text-5xl'>
            Sign in to your JPV Bootcamp learning portal.
          </h1>
          <p className='mt-5 max-w-xl text-base leading-7 text-[#64736c]'>
            Your course access is checked securely before private lessons and member content are loaded.
          </p>
        </section>

        <section className='rounded-[24px] border border-[#153f2e]/10 bg-white p-6 shadow-[0_16px_45px_rgba(31,52,43,0.08)] sm:p-8'>
          <div className='mb-6'>
            <h2 className='text-2xl font-bold text-[#153f2e]'>Member sign in</h2>
            <p className='mt-2 text-sm leading-6 text-[#68766f]'>
              Use the JPV Bootcamp member account provided through the approved enrollment or migration process.
            </p>
          </div>

          {loggedOut && (
            <p className='mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800'>
              You have been signed out.
            </p>
          )}

          <LoginForm nextPath={nextPath} />

          <p className='mt-6 text-xs leading-5 text-[#7b8982]'>
            Public self-signup is not enabled. New member accounts are created through approved JPV Bootcamp enrollment and migration processes.
          </p>
          <div className='mt-5 flex flex-col gap-3 sm:flex-row'>
            <Link className='rounded-lg border border-[#153f2e]/20 px-4 py-3 text-center text-sm font-semibold text-[#153f2e]' href='/register'>
              Create free account
            </Link>
            <Link className='rounded-lg border border-[#153f2e]/20 px-4 py-3 text-center text-sm font-semibold text-[#153f2e]' href='/learn/login?loggedOut=1'>
              Resend verification
            </Link>
          </div>
        </section>
      </main>
    </PortalShell>
  )
}
