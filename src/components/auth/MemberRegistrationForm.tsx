'use client'

import { useState, type FormEvent } from 'react'

type RegistrationResult = {
  ok: boolean
  message?: string
  error?: string
}

const FALLBACK_MESSAGE = 'Your account request was received. Check your email for the next verification step.'

export function MemberRegistrationForm() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    setSubmitting(true)
    setMessage(null)

    try {
      const response = await fetch('/api/member-registration', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          password,
          passwordConfirmation,
          acceptedTerms,
        }),
      })
      let payload: RegistrationResult | null = null
      try {
        payload = (await response.json()) as RegistrationResult
      } catch {
        payload = null
      }
      setMessage(payload?.message ?? FALLBACK_MESSAGE)
      if (response.ok) {
        window.location.assign('/portal?mode=login&registration=success')
      }
    } catch {
      setMessage('Your account request could not be completed from this environment. Contact support or try again later.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className='mt-8 grid gap-4' onSubmit={handleSubmit}>
      <div className='grid gap-4 sm:grid-cols-2'>
        <div>
          <label className='block text-sm font-medium text-neutral-800' htmlFor='register-first-name'>
            First name
          </label>
          <input className='mt-2 w-full rounded-lg border border-neutral-300 px-4 py-3 text-neutral-950' id='register-first-name' maxLength={60} onChange={(event) => setFirstName(event.target.value)} required value={firstName} />
        </div>
        <div>
          <label className='block text-sm font-medium text-neutral-800' htmlFor='register-last-name'>
            Last name
          </label>
          <input className='mt-2 w-full rounded-lg border border-neutral-300 px-4 py-3 text-neutral-950' id='register-last-name' maxLength={60} onChange={(event) => setLastName(event.target.value)} required value={lastName} />
        </div>
      </div>

      <div>
        <label className='block text-sm font-medium text-neutral-800' htmlFor='register-email'>Email</label>
        <input autoComplete='email' className='mt-2 w-full rounded-lg border border-neutral-300 px-4 py-3 text-neutral-950' id='register-email' maxLength={320} onChange={(event) => setEmail(event.target.value)} required type='email' value={email} />
      </div>

      <div>
        <label className='block text-sm font-medium text-neutral-800' htmlFor='register-password'>Password</label>
        <input autoComplete='new-password' className='mt-2 w-full rounded-lg border border-neutral-300 px-4 py-3 text-neutral-950' id='register-password' minLength={12} onChange={(event) => setPassword(event.target.value)} required type='password' value={password} />
      </div>

      <div>
        <label className='block text-sm font-medium text-neutral-800' htmlFor='register-password-confirmation'>Confirm password</label>
        <input autoComplete='new-password' className='mt-2 w-full rounded-lg border border-neutral-300 px-4 py-3 text-neutral-950' id='register-password-confirmation' minLength={12} onChange={(event) => setPasswordConfirmation(event.target.value)} required type='password' value={passwordConfirmation} />
      </div>

      <label className='flex items-start gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700'>
        <input checked={acceptedTerms} className='mt-1' onChange={(event) => setAcceptedTerms(event.target.checked)} required type='checkbox' />
        <span>I agree to the JPV Bootcamp terms and privacy policy.</span>
      </label>

      <p className='text-sm leading-6 text-neutral-600'>
        Free accounts are verified by email before sign in. Pro and VIP access are not selected here.
      </p>

      {message ? (
        <p aria-live='polite' className='rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800'>
          {message}
        </p>
      ) : null}

      <button className='rounded-lg bg-neutral-950 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60' disabled={submitting} type='submit'>
        {submitting ? 'Creating account…' : 'Create free account'}
      </button>
    </form>
  )
}
