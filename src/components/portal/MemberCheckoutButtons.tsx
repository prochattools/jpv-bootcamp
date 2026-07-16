'use client'

import { useState } from 'react'

import { startMemberCheckout, type MemberCheckoutBilling } from '@/lib/actions/startMemberCheckout'

const PLAN = 'membership'

export function MemberCheckoutButtons() {
  const [loading, setLoading] = useState<MemberCheckoutBilling | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [recurringPaymentAccepted, setRecurringPaymentAccepted] = useState(false)

  async function handleCheckout(billing: MemberCheckoutBilling) {
    setLoading(billing)
    setError(null)

    try {
      const result = await startMemberCheckout(PLAN, billing, { recurringPaymentAccepted })
      if (result.ok === true) {
        window.location.href = result.checkoutUrl
        return
      }

      const message =
        result.error === 'existing_subscription'
          ? 'An existing membership subscription already needs attention. Use Manage billing instead.'
          : result.error === 'consent_required'
            ? 'Accept the recurring-payment acknowledgment before continuing.'
            : result.error === 'unauthenticated'
              ? 'Please sign in again before starting checkout.'
              : 'Checkout is temporarily unavailable. Please try again.'
      setError(message)
    } finally {
      setLoading(null)
    }
  }

  const checkoutDisabled = loading !== null || !recurringPaymentAccepted

  return (
    <div className='space-y-5'>
      <section className='rounded-2xl border border-neutral-200 bg-white p-5'>
        <h3 className='text-lg font-semibold text-neutral-950'>JPV Bootcamp Membership — Monthly</h3>
        <p className='mt-2 text-sm leading-6 text-neutral-700'>
          £80 each month. There is no minimum commitment. Your membership renews monthly until you cancel,
          and cancellation takes effect at the end of the current paid month.
        </p>
        <button
          type='button'
          disabled={checkoutDisabled}
          onClick={() => handleCheckout('monthly')}
          className='mt-5 w-full rounded-lg bg-neutral-950 px-4 py-3 text-left text-sm text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50'
        >
          <span className='block font-semibold'>
            {loading === 'monthly' ? 'Opening checkout...' : 'Start monthly membership — pay £80 now'}
          </span>
          <span className='mt-1 block text-xs text-neutral-300'>Monthly recurring subscription</span>
        </button>
      </section>

      <section className='rounded-2xl border border-neutral-200 bg-white p-5'>
        <h3 className='text-lg font-semibold text-neutral-950'>JPV Bootcamp Membership — Annual</h3>
        <p className='mt-2 text-sm leading-6 text-neutral-700'>
          £800 upfront for 12 months. Your annual membership renews automatically each year unless you cancel
          before the renewal date.
        </p>
        <button
          type='button'
          disabled={checkoutDisabled}
          onClick={() => handleCheckout('annual')}
          className='mt-5 w-full rounded-lg border border-neutral-300 px-4 py-3 text-left text-sm text-neutral-950 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50'
        >
          <span className='block font-semibold'>
            {loading === 'annual' ? 'Opening checkout...' : 'Start annual membership — pay £800 now'}
          </span>
          <span className='mt-1 block text-xs text-neutral-600'>Annual recurring subscription</span>
        </button>
      </section>

      <label className='flex items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-5 text-sm leading-6 text-neutral-700'>
        <input
          checked={recurringPaymentAccepted}
          className='mt-1 h-4 w-4 rounded border-neutral-300'
          onChange={(event) => setRecurringPaymentAccepted(event.target.checked)}
          type='checkbox'
        />
        <span>
          <strong>Recurring-payment acknowledgment:</strong> I understand that the selected membership renews
          automatically at the stated price until I cancel. I understand that a voucher or pay-it-forward code
          covers only its approved period and that the same subscription then renews at the normal recurring price.
        </span>
      </label>

      {error && (
        <p role='alert' className='rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800'>
          {error}
        </p>
      )}
    </div>
  )
}
