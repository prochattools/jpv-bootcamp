'use client'

import { Eye, EyeOff } from 'lucide-react'
import { useState, type FormEvent } from 'react'

type RegistrationResult = {
  ok: boolean
  message?: string
  error?: string
}

const FALLBACK_MESSAGE = 'Your account request was received. Check your email for the next verification step.'

const inputClassName =
  'h-12 w-full rounded-lg border border-jpv-border bg-jpv-canvas px-4 text-jpv-ink outline-none transition focus:border-jpv-green-deep focus:ring-2 focus:ring-jpv-green/25'

export function MemberRegistrationForm() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    setSubmitting(true)
    setMessage(null)
    setIsError(false)

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
      if (response.ok) {
        setMessage(payload?.message ?? FALLBACK_MESSAGE)
        window.location.assign('/portal?mode=login&registration=success')
      } else {
        setIsError(true)
        setMessage(payload?.error ?? payload?.message ?? 'Your account request could not be completed. Contact support or try again later.')
      }
    } catch {
      setIsError(true)
      setMessage('Your account request could not be completed from this environment. Contact support or try again later.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className='grid gap-4' onSubmit={handleSubmit}>
      {/* Error alert above fields */}
      {message && isError ? (
        <p aria-live='polite' className='jpv-notice jpv-notice-danger text-sm' role='alert'>
          {message}
        </p>
      ) : null}

      <div className='grid gap-4 sm:grid-cols-2'>
        <div>
          <label className='block text-sm font-semibold text-jpv-ink' htmlFor='register-first-name'>
            First name
          </label>
          <input
            className={`mt-2 ${inputClassName}`}
            id='register-first-name'
            maxLength={60}
            onChange={(event) => setFirstName(event.target.value)}
            required
            value={firstName}
          />
        </div>
        <div>
          <label className='block text-sm font-semibold text-jpv-ink' htmlFor='register-last-name'>
            Last name
          </label>
          <input
            className={`mt-2 ${inputClassName}`}
            id='register-last-name'
            maxLength={60}
            onChange={(event) => setLastName(event.target.value)}
            required
            value={lastName}
          />
        </div>
      </div>

      <div>
        <label className='block text-sm font-semibold text-jpv-ink' htmlFor='register-email'>
          Email address
        </label>
        <input
          autoComplete='email'
          className={`mt-2 ${inputClassName}`}
          id='register-email'
          maxLength={320}
          onChange={(event) => setEmail(event.target.value)}
          required
          type='email'
          value={email}
        />
      </div>

      <div>
        <label className='block text-sm font-semibold text-jpv-ink' htmlFor='register-password'>
          Password
        </label>
        <div className='relative mt-2'>
          <input
            autoComplete='new-password'
            className={inputClassName}
            id='register-password'
            minLength={12}
            onChange={(event) => setPassword(event.target.value)}
            required
            type={showPassword ? 'text' : 'password'}
            value={password}
          />
          <button
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className='absolute right-3 top-1/2 -translate-y-1/2 p-1 text-jpv-muted transition hover:text-jpv-ink'
            onClick={() => setShowPassword((v) => !v)}
            type='button'
          >
            {showPassword ? <EyeOff aria-hidden size={16} /> : <Eye aria-hidden size={16} />}
          </button>
        </div>
        <p className='mt-1 text-xs text-jpv-muted'>Minimum 12 characters.</p>
      </div>

      <div>
        <label className='block text-sm font-semibold text-jpv-ink' htmlFor='register-password-confirmation'>
          Confirm password
        </label>
        <div className='relative mt-2'>
          <input
            autoComplete='new-password'
            className={inputClassName}
            id='register-password-confirmation'
            minLength={12}
            onChange={(event) => setPasswordConfirmation(event.target.value)}
            required
            type={showPasswordConfirmation ? 'text' : 'password'}
            value={passwordConfirmation}
          />
          <button
            aria-label={showPasswordConfirmation ? 'Hide password confirmation' : 'Show password confirmation'}
            className='absolute right-3 top-1/2 -translate-y-1/2 p-1 text-jpv-muted transition hover:text-jpv-ink'
            onClick={() => setShowPasswordConfirmation((v) => !v)}
            type='button'
          >
            {showPasswordConfirmation ? <EyeOff aria-hidden size={16} /> : <Eye aria-hidden size={16} />}
          </button>
        </div>
      </div>

      <label className='flex cursor-pointer items-start gap-3 rounded-lg border border-jpv-border bg-jpv-surface px-4 py-3 text-sm text-jpv-ink'>
        <input
          checked={acceptedTerms}
          className='mt-0.5'
          onChange={(event) => setAcceptedTerms(event.target.checked)}
          required
          type='checkbox'
        />
        <span>I agree to the JPV Bootcamp terms and privacy policy.</span>
      </label>

      <p className='text-xs leading-5 text-jpv-muted'>
        Administrator-created pending accounts are verified by email before sign in. Public membership onboarding is handled through Checkout.
      </p>

      {/* Success message */}
      {message && !isError ? (
        <p aria-live='polite' className='jpv-notice text-sm' role='status'>
          {message}
        </p>
      ) : null}

      <button
        className='jpv-button-primary w-full'
        disabled={submitting}
        type='submit'
      >
        {submitting ? 'Creating account…' : 'Create pending account'}
      </button>
    </form>
  )
}
