'use client'

import { useState, type FormEvent } from 'react'

import {
  GENERIC_MEMBER_LOGIN_ERROR,
  TEMPORARY_MEMBER_LOGIN_ERROR,
  getMemberLoginErrorMessage,
  parseMemberSessionResponse,
  resolveMemberDestination,
  shouldClearDeniedMemberSession,
} from '@/lib/auth/memberLoginFlow'

type MemberLoginFormProps = {
  requestedDestination?: string | null
}

export function MemberLoginForm({ requestedDestination }: MemberLoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function clearDeniedSession(): Promise<void> {
    try {
      await fetch('/api/payload_members/logout', {
        method: 'POST',
        credentials: 'include',
      })
    } catch {
      // Best-effort cleanup must not replace the safe login error.
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    setError(null)
    setSubmitting(true)

    try {
      const loginResponse = await fetch('/api/payload_members/login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      if (!loginResponse.ok) {
        setError(
          loginResponse.status >= 500
            ? TEMPORARY_MEMBER_LOGIN_ERROR
            : GENERIC_MEMBER_LOGIN_ERROR,
        )
        return
      }

      const requestedPortalDestination = resolveMemberDestination(requestedDestination)
      const sessionResponse = await fetch(
        `/api/member-session?next=${encodeURIComponent(requestedPortalDestination)}`,
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            Accept: 'application/json',
          },
        },
      )

      let sessionPayload: unknown = null
      try {
        sessionPayload = await sessionResponse.json()
      } catch {
        // Malformed responses fail closed below.
      }

      const decision = parseMemberSessionResponse(sessionPayload)
      if (!sessionResponse.ok || !decision.allowed) {
        if (shouldClearDeniedMemberSession(decision)) {
          await clearDeniedSession()
        }
        setError(
          sessionResponse.status >= 500
            ? TEMPORARY_MEMBER_LOGIN_ERROR
            : getMemberLoginErrorMessage(decision),
        )
        return
      }

      window.location.assign(decision.destination)
    } catch {
      setError(TEMPORARY_MEMBER_LOGIN_ERROR)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className='mt-8 grid gap-5' onSubmit={handleSubmit}>
      <div>
        <label className='block text-sm font-medium text-neutral-800' htmlFor='member-email'>
          Email
        </label>
        <input
          autoComplete='email'
          className='mt-2 w-full rounded-lg border border-neutral-300 px-4 py-3 text-neutral-950 outline-none focus:border-neutral-950'
          id='member-email'
          name='email'
          onChange={(event) => setEmail(event.target.value)}
          required
          type='email'
          value={email}
        />
      </div>

      <div>
        <label className='block text-sm font-medium text-neutral-800' htmlFor='member-password'>
          Password
        </label>
        <input
          autoComplete='current-password'
          className='mt-2 w-full rounded-lg border border-neutral-300 px-4 py-3 text-neutral-950 outline-none focus:border-neutral-950'
          id='member-password'
          name='password'
          onChange={(event) => setPassword(event.target.value)}
          required
          type='password'
          value={password}
        />
      </div>

      {error ? (
        <p aria-live='polite' className='rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800'>
          {error}
        </p>
      ) : null}

      <button
        className='rounded-lg bg-neutral-950 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60'
        disabled={submitting}
        type='submit'
      >
        {submitting ? 'Signing in…' : 'Student and member sign in'}
      </button>
    </form>
  )
}
