'use client'

import { FormEvent, useState } from 'react'

const GENERIC_MESSAGE = 'If an eligible account exists, a verification email will be sent shortly.'

export function MemberVerificationResendForm() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    setSubmitting(true)
    setMessage(null)
    try {
      const response = await fetch('/api/member-email-verification/resend', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!response.ok && response.status === 400) {
        setMessage('Enter a valid email address and try again.')
      } else {
        setMessage(GENERIC_MESSAGE)
      }
    } catch {
      setMessage(GENERIC_MESSAGE)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className='mt-6 border-t border-neutral-200 pt-6' onSubmit={submit}>
      <h2 className='text-sm font-semibold text-neutral-950'>Didn&apos;t receive a verification email?</h2>
      <p className='mt-2 text-sm leading-6 text-neutral-600'>
        Enter your member email address. For privacy, the response is the same for every account.
      </p>
      <label className='mt-4 block text-sm font-medium text-neutral-800' htmlFor='verification-email'>
        Member email
      </label>
      <input
        autoComplete='email'
        className='mt-2 w-full rounded-lg border border-neutral-300 px-4 py-3 text-sm text-neutral-950'
        id='verification-email'
        maxLength={320}
        onChange={(event) => setEmail(event.target.value)}
        required
        type='email'
        value={email}
      />
      <button
        className='mt-3 w-full rounded-lg bg-neutral-950 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60'
        disabled={submitting}
        type='submit'
      >
        {submitting ? 'Requesting…' : 'Resend verification email'}
      </button>
      {message ? (
        <p aria-live='polite' className='mt-3 text-sm leading-6 text-neutral-600'>
          {message}
        </p>
      ) : null}
    </form>
  )
}
