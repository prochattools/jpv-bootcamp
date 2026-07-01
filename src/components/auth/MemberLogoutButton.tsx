'use client'

import { useState } from 'react'

export function MemberLogoutButton() {
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleLogout() {
    setError(null)
    setSubmitting(true)

    try {
      const response = await fetch('/api/payload_members/logout', {
        method: 'POST',
        credentials: 'include',
      })

      if (!response.ok) {
        setError('Sign out could not be completed. Please try again.')
        return
      }

      window.location.assign('/login')
    } catch {
      setError('Sign out is temporarily unavailable. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className='flex flex-col items-end gap-2'>
      <button
        className='rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60'
        disabled={submitting}
        onClick={handleLogout}
        type='button'
      >
        {submitting ? 'Signing out…' : 'Sign out'}
      </button>
      {error ? (
        <p aria-live='polite' className='max-w-xs text-right text-xs text-red-700'>
          {error}
        </p>
      ) : null}
    </div>
  )
}
