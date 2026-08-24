'use client'

import { Eye, EyeOff } from 'lucide-react'
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
  'h-12 w-full rounded-lg border border-jpv-border bg-jpv-canvas px-4 text-sm text-jpv-ink outline-none transition focus:border-jpv-green-deep focus:ring-2 focus:ring-jpv-green/25'
const buttonClassName = 'jpv-button-primary mt-6 w-full'

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
      description='Enter your member email. We will send instructions when an eligible account exists.'
      title='Reset your password'
    >
      {state.submitted ? (
        <div className='jpv-notice text-sm leading-6' role='status'>
          <p className='font-semibold text-jpv-ink'>Check your inbox</p>
          <p className='mt-1 text-jpv-muted'>{state.message}</p>
          <Link
            className='mt-3 inline-block text-xs font-semibold text-jpv-brand hover:underline underline-offset-4'
            href='/portal?mode=login'
          >
            Back to sign in
          </Link>
        </div>
      ) : (
        <form action={action} className='grid gap-4'>
          <div>
            <label className='block text-sm font-semibold text-jpv-ink' htmlFor='forgot-email'>
              Email address
            </label>
            <input
              autoComplete='email'
              className={`mt-2 ${inputClassName}`}
              id='forgot-email'
              name='email'
              required
              type='email'
            />
          </div>
          <button className={buttonClassName} disabled={pending} type='submit'>
            {pending ? 'Sending…' : 'Send reset instructions'}
          </button>
        </form>
      )}
    </AuthCard>
  )
}

function PasswordFieldWithToggle({
  autoComplete,
  id,
  label,
  name,
}: {
  autoComplete: string
  id: string
  label: string
  name: string
}) {
  const [show, setShow] = useState(false)

  return (
    <div>
      <label className='block text-sm font-semibold text-jpv-ink' htmlFor={id}>
        {label}
      </label>
      <div className='relative mt-2'>
        <input
          autoComplete={autoComplete}
          className={inputClassName}
          id={id}
          minLength={12}
          name={name}
          required
          type={show ? 'text' : 'password'}
        />
        <button
          aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className='absolute right-3 top-1/2 -translate-y-1/2 p-1 text-jpv-muted transition hover:text-jpv-ink'
          onClick={() => setShow((v) => !v)}
          type='button'
        >
          {show ? <EyeOff aria-hidden size={16} /> : <Eye aria-hidden size={16} />}
        </button>
      </div>
    </div>
  )
}

function PasswordFields({ token }: { token: string }) {
  return (
    <div className='grid gap-4'>
      <input name='token' type='hidden' value={token} />
      <PasswordFieldWithToggle
        autoComplete='new-password'
        id='new-password'
        label='New password'
        name='password'
      />
      <PasswordFieldWithToggle
        autoComplete='new-password'
        id='confirm-password'
        label='Confirm new password'
        name='passwordConfirmation'
      />
      <p className='text-xs text-jpv-muted'>Minimum 12 characters.</p>
    </div>
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
    <AuthCard description='Use at least 12 characters.' title='Choose a new password'>
      {state.ok ? (
        <div className='jpv-notice text-sm leading-6' role='status'>
          <p className='font-semibold text-jpv-ink'>Password updated</p>
          <p className='mt-1 text-jpv-muted'>Your password has been updated. You can now sign in with your new password.</p>
          <Link
            className='mt-3 inline-block text-xs font-semibold text-jpv-brand hover:underline underline-offset-4'
            href='/portal?mode=login'
          >
            Sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          {state.error ? (
            <p className='jpv-notice jpv-notice-danger mb-4 text-sm' role='alert'>
              {state.error}
            </p>
          ) : null}
          <PasswordFields token={token} />
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
    <AuthCard description='Choose a password with at least 12 characters.' title='Finish setting up your account'>
      {state.ok ? (
        <div className='jpv-notice text-sm leading-6' role='status'>
          <p className='font-semibold text-jpv-ink'>Account ready</p>
          <p className='mt-1 text-jpv-muted'>Your account has been set up. You can now sign in.</p>
          <Link
            className='mt-3 inline-block text-xs font-semibold text-jpv-brand hover:underline underline-offset-4'
            href='/portal?mode=login'
          >
            Sign in
          </Link>
        </div>
      ) : (
        <form action={action}>
          {state.error ? (
            <p className='jpv-notice jpv-notice-danger mb-4 text-sm' role='alert'>
              {state.error}
            </p>
          ) : null}
          <PasswordFields token={token} />
          <button className={buttonClassName} disabled={pending || !token} type='submit'>
            {pending ? 'Saving…' : 'Set password'}
          </button>
        </form>
      )}
    </AuthCard>
  )
}
