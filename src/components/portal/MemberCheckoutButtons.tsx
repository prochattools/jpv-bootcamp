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
      <section className='rounded-jpv-card border border-jpv-border bg-jpv-canvas p-5 shadow-jpv-card'>
        <h3 className='text-lg font-semibold text-jpv-ink'>JPV Bootcamp Membership — Monthly</h3>
        <p className='mt-2 text-sm leading-6 text-jpv-muted'>
          £80 each month. There is no minimum commitment. Your membership renews monthly until you cancel,
          and cancellation takes effect at the end of the current paid month.
        </p>
        <button
          type='button'
          disabled={checkoutDisabled}
          onClick={() => handleCheckout('monthly')}
          className='jpv-button-primary mt-5 w-full text-left'
        >
          <span className='block font-semibold'>
            {loading === 'monthly' ? 'Opening checkout...' : 'Start monthly membership — pay £80 now'}
          </span>
          <span className='mt-1 block text-xs opacity-75'>Monthly recurring subscription</span>
        </button>
      </section>

      <section className='rounded-jpv-card border border-jpv-border bg-jpv-canvas p-5 shadow-jpv-card'>
        <h3 className='text-lg font-semibold text-jpv-ink'>JPV Bootcamp Membership — Annual</h3>
        <p className='mt-2 text-sm leading-6 text-jpv-muted'>
          £800 upfront for 12 months. Your annual membership renews automatically each year unless you cancel
          before the renewal date.
        </p>
        <button
          type='button'
          disabled={checkoutDisabled}
          onClick={() => handleCheckout('annual')}
          className='jpv-button-secondary mt-5 w-full text-left'
        >
          <span className='block font-semibold'>
            {loading === 'annual' ? 'Opening checkout...' : 'Start annual membership — pay £800 now'}
          </span>
          <span className='mt-1 block text-xs opacity-60'>Annual recurring subscription</span>
        </button>
      </section>

      <label className='flex items-start gap-3 rounded-jpv-card border border-jpv-border bg-jpv-canvas p-5 text-sm leading-6 text-jpv-muted'>
        <input
          checked={recurringPaymentAccepted}
          className='mt-1 h-4 w-4 rounded border-jpv-border accent-jpv-brand'
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
        <p role='alert' className='jpv-notice jpv-notice-danger'>
          {error}
        </p>
      )}
    </div>
  )
}
