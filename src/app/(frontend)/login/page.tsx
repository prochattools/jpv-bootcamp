import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { MemberLoginForm } from '@/components/auth/MemberLoginForm'
import { MemberVerificationResendForm } from '@/components/auth/MemberVerificationResendForm'
import {
  getMemberLoginPageMessage,
  type MemberLoginPageStatus,
} from '@/lib/auth/memberLoginFlow'
import { resolvePayloadRequestSession } from '@/lib/auth/payloadSession'
import { decideSharedLogin } from '@/lib/auth/sharedLoginDecision'

type LoginSearchParams = {
  next?: string | string[]
  redirect?: string | string[]
  verification?: string | string[]
  emailChange?: string | string[]
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
  const verificationResult = firstValue(params?.verification)
  const emailChangeResult = firstValue(params?.emailChange)
  const verificationMessage =
    emailChangeResult === 'success'
      ? 'Your sign-in email address was changed successfully. Use the new address when you sign in.'
      : emailChangeResult === 'invalid'
        ? 'This email-change link is invalid or expired. Sign in with your current address to request another link.'
        : verificationResult === 'success'
          ? 'Your email address has been verified. You can now continue with member sign-in.'
          : verificationResult === 'used'
            ? 'This verification link has already been used. You can request another email below if needed.'
            : verificationResult === 'invalid'
              ? 'This verification link is invalid or expired. You can request another email below.'
              : null

  let status: MemberLoginPageStatus = 'anonymous'

  try {
    const session = await resolvePayloadRequestSession(requestHeaders)
    const decision = decideSharedLogin(session, requestedDestination)

    if (decision.allowed && decision.destination) {
      redirect(decision.destination)
    }

    if (decision.reason === 'no_authenticated_identity') {
      status = 'anonymous'
    } else if (decision.reason === 'member_email_unverified') {
      status = 'verification_required'
    } else {
      status = 'denied'
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'digest' in error) {
      throw error
    }
    status = 'unavailable'
  }

  const message = getMemberLoginPageMessage(status)

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
        {verificationMessage ? (
          <p
            className='mt-4 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm leading-6 text-neutral-700'
            role='status'
          >
            {verificationMessage}
          </p>
        ) : null}

        <MemberLoginForm requestedDestination={requestedDestination} />
        <MemberVerificationResendForm />

        <div className='mt-6 border-t border-neutral-200 pt-6'>
          <p className='text-center text-sm text-neutral-600'>Administrator account?</p>
          <Link
            className='mt-3 block rounded-lg border border-neutral-300 px-4 py-3 text-center text-sm font-semibold text-neutral-950'
            href='/admin/login'
          >
            JPV Bootcamp Portal administrator sign in
          </Link>
        </div>
      </section>
    </main>
  )
}
