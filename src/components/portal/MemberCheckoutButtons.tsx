'use client'

import { useState } from 'react'

import { startMemberCheckout, type MemberCheckoutPlan } from '@/lib/actions/startMemberCheckout'

const LABELS: Record<MemberCheckoutPlan, string> = {
  pro: 'Start Pro membership',
  vip: 'Start VIP membership',
}

export function MemberCheckoutButtons() {
  const [loadingPlan, setLoadingPlan] = useState<MemberCheckoutPlan | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleCheckout(plan: MemberCheckoutPlan) {
    setLoadingPlan(plan)
    setError(null)

    try {
      const result = await startMemberCheckout(plan)
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
      setLoadingPlan(null)
    }
  }

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap gap-3'>
        {(['pro', 'vip'] as const).map((plan) => (
          <button
            key={plan}
            type='button'
            disabled={loadingPlan !== null}
            onClick={() => handleCheckout(plan)}
            className='inline-flex items-center rounded-lg bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-50'
          >
            {loadingPlan === plan ? 'Opening checkout...' : LABELS[plan]}
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
