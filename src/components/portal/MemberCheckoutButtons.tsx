'use client'

import { useState } from 'react'

import { startMemberCheckout, type MemberCheckoutBilling } from '@/lib/actions/startMemberCheckout'

const PLAN = 'pro'
const OPTIONS: Array<{ billing: MemberCheckoutBilling; label: string; description: string }> = [
  {
    billing: 'monthly',
    label: 'Start Pro monthly',
    description: 'Monthly payments with a 12-month commitment.',
  },
  {
    billing: 'annual',
    label: 'Start Pro annual',
    description: 'Annual upfront payment.',
  },
]

export function MemberCheckoutButtons() {
  const [loading, setLoading] = useState<MemberCheckoutBilling | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleCheckout(billing: MemberCheckoutBilling) {
    const plan = PLAN
    setLoading(billing)
    setError(null)

    try {
      const result = await startMemberCheckout(plan, billing)
      if (result.ok === true) {
        window.location.href = result.checkoutUrl
        return
      }

      const message =
        result.error === 'existing_subscription'
          ? 'An existing subscription already needs attention. Use Manage billing instead.'
          : result.error === 'unauthenticated'
            ? 'Please sign in again before starting checkout.'
            : 'Checkout is temporarily unavailable. Please try again.'
      setError(message)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className='space-y-4'>
      <div className='grid gap-3 sm:grid-cols-2'>
        {OPTIONS.map((option) => (
          <button
            key={option.billing}
            type='button'
            disabled={loading !== null}
            onClick={() => handleCheckout(option.billing)}
            className='rounded-lg bg-neutral-950 px-4 py-3 text-left text-sm text-white transition hover:bg-neutral-800 disabled:opacity-50'
          >
            <span className='block font-semibold'>
              {loading === option.billing ? 'Opening checkout...' : option.label}
            </span>
            <span className='mt-1 block text-xs text-neutral-300'>{option.description}</span>
          </button>
        ))}
      </div>
      {error && (
        <p role='alert' className='rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800'>
          {error}
        </p>
      )}
    </div>
  )
}
