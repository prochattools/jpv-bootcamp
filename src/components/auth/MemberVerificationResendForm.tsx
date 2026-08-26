'use client'

import { FormEvent, useState } from 'react'

import { AuthFlowNotice } from '@/components/auth/AuthFlowNotice'

const GENERIC_MESSAGE = 'If an eligible account exists, a verification email will be sent shortly.'

export function MemberVerificationResendForm() {
  const [email, setEmail] = useState('')
  const [result, setResult] = useState<{ message: string; tone: 'success' | 'error' } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    setSubmitting(true)
    setResult(null)
    try {
      const response = await fetch('/api/member-email-verification/resend', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!response.ok && response.status === 400) {
        setResult({ message: 'Enter a valid email address and try again.', tone: 'error' })
      } else {
        setResult({ message: GENERIC_MESSAGE, tone: 'success' })
      }
    } catch {
      setResult({ message: GENERIC_MESSAGE, tone: 'success' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className='mt-7 border-t border-jpv-border pt-7' onSubmit={submit}>
      <h2 className='text-sm font-bold text-jpv-ink'>Didn&apos;t receive a verification email?</h2>
      <p className='mt-2 text-sm leading-6 text-jpv-muted'>
        Enter your member email address. For privacy, the response is the same for every account.
      </p>
      <label className='mt-4 block text-sm font-semibold text-jpv-ink' htmlFor='verification-email'>
        Member email
      </label>
      <input
        autoComplete='email'
        className='mt-2 w-full rounded-lg border border-jpv-border bg-jpv-canvas px-4 py-3 text-sm text-jpv-ink outline-none transition focus:border-jpv-green-deep focus:ring-2 focus:ring-jpv-green/25'
        id='verification-email'
        maxLength={320}
        onChange={(event) => setEmail(event.target.value)}
        required
        type='email'
        value={email}
      />
      <button
        className='jpv-button-secondary mt-3 w-full'
        disabled={submitting}
        type='submit'
      >
        {submitting ? 'Requesting…' : 'Resend verification email'}
      </button>
      {result ? (
        <div className='mt-3'>
          <AuthFlowNotice
            message={result.message}
            title={result.tone === 'error' ? 'Check your email address' : 'Request received'}
            tone={result.tone}
          />
        </div>
      ) : null}
    </form>
  )
}
