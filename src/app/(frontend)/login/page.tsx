import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { resolvePayloadRequestSession } from '@/lib/auth/payloadSession'
import { decideSharedLogin } from '@/lib/auth/sharedLoginDecision'

type LoginSearchParams = {
  next?: string | string[]
  redirect?: string | string[]
}

type LoginPageProps = {
  searchParams?: Promise<LoginSearchParams>
}

function firstValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export default async function SharedLoginPage({ searchParams }: LoginPageProps) {
  const [requestHeaders, params] = await Promise.all([headers(), searchParams])
  const requestedDestination = firstValue(params?.next) ?? firstValue(params?.redirect)

  let status: 'anonymous' | 'denied' | 'unavailable' = 'anonymous'

  try {
    const session = await resolvePayloadRequestSession(requestHeaders)
    const decision = decideSharedLogin(session, requestedDestination)

    if (decision.allowed && decision.destination) {
      redirect(decision.destination)
    }

    status = decision.reason === 'no_authenticated_identity' ? 'anonymous' : 'denied'
  } catch (error) {
    if (error && typeof error === 'object' && 'digest' in error) {
      throw error
    }
    status = 'unavailable'
  }

  const message =
    status === 'anonymous'
      ? 'Choose the secure area that matches your account.'
      : status === 'unavailable'
        ? 'Sign-in is temporarily unavailable. Please try again shortly.'
        : 'We could not safely continue this session. Sign out and try again, or contact support.'

  return (
    <main className='mx-auto flex min-h-screen max-w-xl items-center px-6 py-16'>
      <section className='w-full rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm'>
        <img
          alt='JPV Bootcamp'
          className='mx-auto h-auto w-full max-w-56'
          src='/images/jpv-logo.png'
        />
        <h1 className='mt-8 text-center text-3xl font-semibold text-neutral-950'>Sign in</h1>
        <p className='mt-3 text-center text-sm leading-6 text-neutral-600'>{message}</p>

        <div className='mt-8 grid gap-3'>
          <Link
            className='rounded-lg bg-neutral-950 px-4 py-3 text-center text-sm font-semibold text-white'
            href='/admin/login'
          >
            Administrator sign in
          </Link>
          <div className='rounded-lg border border-neutral-200 px-4 py-3 text-center text-sm text-neutral-600'>
            Member sign-in continues through the protected member portal setup.
          </div>
        </div>
      </section>
    </main>
  )
}
