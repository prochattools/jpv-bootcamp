'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import {
  requestPasswordResetAction,
  type ForgotPasswordActionState,
} from '@/app/(frontend)/forgot-password/actions'
import {
  completePasswordResetAction,
  type ResetPasswordActionState,
} from '@/app/(frontend)/reset-password/actions'
import {
  completeMemberSetupAction,
  type SetPasswordActionState,
} from '@/app/(frontend)/set-password/actions'

const inputClassName =
  'mt-2 w-full rounded-lg border border-neutral-300 px-3 py-3 text-sm text-neutral-950 outline-none focus:border-neutral-950'
const buttonClassName =
  'mt-6 w-full rounded-lg bg-neutral-950 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60'

function AuthCard({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <main className='mx-auto flex min-h-screen max-w-xl items-center px-6 py-16'>
      <section className='w-full rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm'>
        <img
          alt='JPV Bootcamp'
          className='mx-auto h-auto w-full max-w-56'
          src='/images/jpv-logo.png'
        />
        <h1 className='mt-8 text-center text-3xl font-semibold text-neutral-950'>{title}</h1>
        <p className='mt-3 text-center text-sm leading-6 text-neutral-600'>{description}</p>
        {children}
        <p className='mt-6 text-center text-sm text-neutral-600'>
          <Link className='font-semibold text-neutral-950 underline' href='/portal?mode=login'>
            Back to sign in
          </Link>
        </p>
      </section>
    </main>
  )
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<ForgotPasswordActionState, FormData>(
    requestPasswordResetAction,
    {},
  )

  return (
    <AuthCard
      title='Reset your password'
      description='Enter your member email. We will send instructions when an eligible account exists.'
    >
      {state.submitted ? (
        <p className='mt-8 rounded-lg bg-neutral-100 px-4 py-3 text-sm leading-6 text-neutral-700'>
          {state.message}
        </p>
      ) : (
        <form action={action} className='mt-8'>
          <label className='block text-sm font-medium text-neutral-800'>
            Email address
            <input
              autoComplete='email'
              className={inputClassName}
              name='email'
              required
              type='email'
            />
          </label>
          <button className={buttonClassName} disabled={pending} type='submit'>
            {pending ? 'Sending…' : 'Send reset instructions'}
          </button>
        </form>
      )}
    </AuthCard>
  )
}

function PasswordFields({ token }: { token: string }) {
  return (
    <>
      <input name='token' type='hidden' value={token} />
      <label className='block text-sm font-medium text-neutral-800'>
        New password
        <input
          autoComplete='new-password'
          className={inputClassName}
          minLength={12}
          name='password'
          required
          type='password'
        />
      </label>
      <label className='mt-4 block text-sm font-medium text-neutral-800'>
        Confirm new password
        <input
          autoComplete='new-password'
          className={inputClassName}
          minLength={12}
          name='passwordConfirmation'
          required
          type='password'
        />
      </label>
    </>
  )
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<ResetPasswordActionState, FormData>(
    completePasswordResetAction,
    {},
  )

  return (
    <AuthCard title='Choose a new password' description='Use at least 12 characters.'>
      {state.ok ? (
        <p className='mt-8 rounded-lg bg-neutral-100 px-4 py-3 text-sm text-neutral-700'>
          Your password has been updated. You can now sign in.
        </p>
      ) : (
        <form action={action} className='mt-8'>
          <PasswordFields token={token} />
          {state.error && (
            <p className='mt-4 rounded-lg bg-neutral-100 px-4 py-3 text-sm text-neutral-700'>
              {state.error}
            </p>
          )}
          <button className={buttonClassName} disabled={pending || !token} type='submit'>
            {pending ? 'Updating…' : 'Update password'}
          </button>
        </form>
      )}
    </AuthCard>
  )
}

export function SetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<SetPasswordActionState, FormData>(
    completeMemberSetupAction,
    {},
  )

  return (
    <AuthCard title='Finish setting up your account' description='Choose a password with at least 12 characters.'>
      {state.ok ? (
        <p className='mt-8 rounded-lg bg-neutral-100 px-4 py-3 text-sm text-neutral-700'>
          Your account is ready. You can now sign in.
        </p>
      ) : (
        <form action={action} className='mt-8'>
          <PasswordFields token={token} />
          {state.error && (
            <p className='mt-4 rounded-lg bg-neutral-100 px-4 py-3 text-sm text-neutral-700'>
              {state.error}
            </p>
          )}
          <button className={buttonClassName} disabled={pending || !token} type='submit'>
            {pending ? 'Saving…' : 'Set password'}
          </button>
        </form>
      )}
    </AuthCard>
  )
}
