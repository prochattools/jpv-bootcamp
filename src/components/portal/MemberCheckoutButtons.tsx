'use client'

import { useState } from 'react'

import { startMemberCheckout, type MemberCheckoutBilling } from '@/lib/actions/startMemberCheckout'

const PLAN = 'pro'

export function MemberCheckoutButtons() {
  const [loading, setLoading] = useState<MemberCheckoutBilling | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [contractAccepted, setContractAccepted] = useState(false)
  const [immediateAccessRequested, setImmediateAccessRequested] = useState(false)

  async function handleCheckout(billing: MemberCheckoutBilling) {
    setLoading(billing)
    setError(null)

    try {
      const result = await startMemberCheckout(
        PLAN,
        billing,
        billing === 'monthly'
          ? { contractAccepted, immediateAccessRequested }
          : undefined,
      )
      if (result.ok === true) {
        window.location.href = result.checkoutUrl
        return
      }

      const message =
        result.error === 'existing_subscription'
          ? 'An existing subscription or commitment already needs attention. Use Manage billing instead.'
          : result.error === 'consent_required'
            ? 'Accept both monthly commitment acknowledgments before continuing.'
            : result.error === 'unauthenticated'
              ? 'Please sign in again before starting checkout.'
              : 'Checkout is temporarily unavailable. Please try again.'
      setError(message)
    } finally {
      setLoading(null)
    }
  }

  const monthlyDisabled = loading !== null || !contractAccepted || !immediateAccessRequested

  return (
    <div className='space-y-5'>
      <section className='rounded-2xl border border-neutral-200 bg-white p-5'>
        <h3 className='text-lg font-semibold text-neutral-950'>Pro Monthly</h3>
        <p className='mt-2 text-sm leading-6 text-neutral-700'>
          £80 each month for an initial 12-month commitment. Total initial commitment: £960.
          After the initial 12 monthly billing periods, membership continues at £80 per month until you cancel.
        </p>
        <div className='mt-5 space-y-4'>
          <label className='flex items-start gap-3 text-sm leading-6 text-neutral-700'>
            <input
              checked={contractAccepted}
              className='mt-1 h-4 w-4 rounded border-neutral-300'
              onChange={(event) => setContractAccepted(event.target.checked)}
              type='checkbox'
            />
            <span>
              <strong>Contract acknowledgment:</strong> I agree to pay £80 per month for the initial
              12-month commitment, understand the total initial commitment is £960, and understand that
              membership continues monthly at £80 after the initial term until canceled.
            </span>
          </label>
          <label className='flex items-start gap-3 text-sm leading-6 text-neutral-700'>
            <input
              checked={immediateAccessRequested}
              className='mt-1 h-4 w-4 rounded border-neutral-300'
              onChange={(event) => setImmediateAccessRequested(event.target.checked)}
              type='checkbox'
            />
            <span>
              <strong>Immediate access request:</strong> I request immediate access during the 14-day
              cancellation period. I understand that if I cancel during that period, JPV may deduct the
              proportionate value of service supplied where legally permitted.
            </span>
          </label>
        </div>
        <button
          type='button'
          disabled={monthlyDisabled}
          onClick={() => handleCheckout('monthly')}
          className='mt-5 w-full rounded-lg bg-neutral-950 px-4 py-3 text-left text-sm text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50'
        >
          <span className='block font-semibold'>
            {loading === 'monthly' ? 'Opening checkout...' : 'Start Pro — pay £80 now'}
          </span>
          <span className='mt-1 block text-xs text-neutral-300'>Monthly commitment checkout</span>
        </button>
      </section>

      <section className='rounded-2xl border border-neutral-200 bg-white p-5'>
        <h3 className='text-lg font-semibold text-neutral-950'>Pro Annual</h3>
        <p className='mt-2 text-sm leading-6 text-neutral-700'>£880 upfront for 12 months.</p>
        <button
          type='button'
          disabled={loading !== null}
          onClick={() => handleCheckout('annual')}
          className='mt-5 w-full rounded-lg border border-neutral-300 px-4 py-3 text-left text-sm text-neutral-950 transition hover:bg-neutral-50 disabled:opacity-50'
        >
          <span className='block font-semibold'>
            {loading === 'annual' ? 'Opening checkout...' : 'Start Pro annual — pay £880 now'}
          </span>
          <span className='mt-1 block text-xs text-neutral-600'>Annual upfront checkout</span>
        </button>
      </section>

      {error && (
        <p role='alert' className='rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800'>
          {error}
        </p>
      )}
    </div>
  )
}
