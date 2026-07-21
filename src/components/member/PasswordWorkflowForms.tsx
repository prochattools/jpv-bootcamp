'use client'

import Link from 'next/link'
import { useActionState, useState, type FormEvent } from 'react'

import { AuthShell } from '@/components/auth/AuthShell'
import {
  requestPasswordResetAction,
  type ForgotPasswordActionState,
} from '@/app/(frontend)/forgot-password/actions'
import { type ResetPasswordActionState } from '@/app/(frontend)/reset-password/actions'
import {
  completeMemberSetupAction,
  type SetPasswordActionState,
} from '@/app/(frontend)/set-password/actions'

const inputClassName =
  'mt-2 w-full rounded-lg border border-jpv-border bg-jpv-canvas px-4 py-3 text-sm text-jpv-ink outline-none transition focus:border-jpv-green-deep focus:ring-2 focus:ring-jpv-green/25'
const buttonClassName =
  'jpv-button-primary mt-6 w-full'

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
    <AuthShell
      description={description}
      eyebrow='Secure member access'
      footer={(
        <p className='text-sm text-jpv-muted'>
          <Link className='font-semibold text-jpv-ink underline decoration-jpv-green underline-offset-4' href='/portal?mode=login'>
            Back to sign in
          </Link>
        </p>
      )}
      title={title}
    >
      {children}
    </AuthShell>
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
        <p className='jpv-notice text-sm leading-6 text-jpv-muted' role='status'>
          {state.message}
        </p>
      ) : (
        <form action={action}>
          <label className='block text-sm font-semibold text-jpv-ink'>
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
      <label className='block text-sm font-semibold text-jpv-ink'>
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
      <label className='mt-4 block text-sm font-semibold text-jpv-ink'>
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

type ResetPasswordApiResponse = {
  ok?: boolean
  error?: string
}

function resetPasswordErrorMessage(error: string | undefined): string {
  if (error === 'password_too_short') return 'Use at least 12 characters.'
  if (error === 'password_mismatch') return 'The password confirmation does not match.'
  if (error === 'invalid_request') return 'Enter and confirm your new password.'
  return 'This password link is invalid, expired, or already used.'
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, setState] = useState<ResetPasswordActionState>({})
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setPending(true)
    setState({})

    try {
      const response = await fetch('/api/member-password/reset', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          password: String(formData.get('password') ?? ''),
          passwordConfirmation: String(formData.get('passwordConfirmation') ?? ''),
        }),
      })

      const contentType = response.headers.get('content-type') ?? ''
      if (!contentType.includes('application/json')) {
        setState({ error: 'This password link is invalid, expired, or already used.' })
        return
      }

      const result = (await response.json()) as ResetPasswordApiResponse
      if (response.ok && result.ok === true) {
        setState({ ok: true })
        return
      }

      setState({ error: resetPasswordErrorMessage(result.error) })
    } catch {
      setState({ error: 'This password link is invalid, expired, or already used.' })
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthCard title='Choose a new password' description='Use at least 12 characters.'>
      {state.ok ? (
        <p className='jpv-notice text-sm text-jpv-muted' role='status'>
          Your password has been updated. You can now sign in.
        </p>
      ) : (
        <form onSubmit={handleSubmit}>
          <PasswordFields token={token} />
          {state.error && (
            <p className='jpv-notice jpv-notice-danger mt-4 text-sm' role='alert'>
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
        <p className='jpv-notice text-sm text-jpv-muted' role='status'>
          Your account is ready. You can now sign in.
        </p>
      ) : (
        <form action={action}>
          <PasswordFields token={token} />
          {state.error && (
            <p className='jpv-notice jpv-notice-danger mt-4 text-sm' role='alert'>
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
