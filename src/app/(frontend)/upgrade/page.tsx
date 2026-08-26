'use client'

import { useMemo, useState } from 'react'

import { PublicInformationShell } from '@/components/public/PublicInformationShell'

export default function UpgradePage() {
  const [accepted, setAccepted] = useState(false)
  const monthlyHref = useMemo(
    () => `/api/stripe/checkout?plan=membership&billing=monthly&recurring_payment_accepted=${accepted}`,
    [accepted],
  )
  const annualHref = useMemo(
    () => `/api/stripe/checkout?plan=membership&billing=annual&recurring_payment_accepted=${accepted}`,
    [accepted],
  )

  return (
    <PublicInformationShell
      backHref='/portal?mode=login'
      backLabel='Back to sign in'
      description='One JPV Bootcamp Membership with monthly or annual billing. Checkout collects the details required to create and manage your membership.'
      eyebrow='JPV Bootcamp Membership'
      title='Choose your billing cadence'
    >
      <section className='grid gap-5 md:grid-cols-2'>
        <article className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8'>
          <p className='jpv-eyebrow'>Monthly</p>
          <h2 className='mt-2 text-2xl font-semibold text-jpv-ink'>£80/month</h2>
          <p className='mt-3 text-sm leading-6 text-jpv-muted'>
            No minimum commitment. Renews monthly until cancelled; cancellation takes effect at the end of the current paid month.
          </p>
          <a
            aria-disabled={!accepted}
            className='jpv-button-primary mt-6 min-h-11 w-full justify-center aria-disabled:pointer-events-none aria-disabled:opacity-50'
            href={accepted ? monthlyHref : undefined}
          >
            Continue with monthly billing
          </a>
        </article>

        <article className='rounded-jpv-panel border border-jpv-brand bg-jpv-surface p-6 shadow-jpv-card sm:p-8'>
          <p className='jpv-eyebrow'>Annual</p>
          <h2 className='mt-2 text-2xl font-semibold text-jpv-ink'>£800/year</h2>
          <p className='mt-3 text-sm leading-6 text-jpv-muted'>
            Paid upfront for 12 months and renews automatically each year unless cancelled before renewal.
          </p>
          <a
            aria-disabled={!accepted}
            className='jpv-button-primary mt-6 min-h-11 w-full justify-center aria-disabled:pointer-events-none aria-disabled:opacity-50'
            href={accepted ? annualHref : undefined}
          >
            Continue with annual billing
          </a>
        </article>
      </section>

      <label className='flex min-h-11 items-start gap-3 rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-5 text-sm leading-6 text-jpv-ink shadow-jpv-card'>
        <input
          checked={accepted}
          className='mt-1 h-5 w-5 accent-jpv-brand'
          onChange={(event) => setAccepted(event.target.checked)}
          type='checkbox'
        />
        <span>
          I understand that the selected membership renews automatically until cancelled. A voucher or pay-it-forward code covers only its approved period, after which the same subscription renews at the normal recurring price.
        </span>
      </label>

      <div className='flex flex-wrap gap-4'>
        <a className='jpv-button-secondary min-h-11' href='/'>Back to main site</a>
      </div>
    </PublicInformationShell>
  )
}
