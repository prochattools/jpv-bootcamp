'use client'

import { useMemo, useState } from 'react'

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
    <main className='bg-jpv-gradient min-h-screen px-6 py-20 text-jpv-gray-50'>
      <div className='mx-auto max-w-5xl space-y-10'>
        <header className='space-y-4 text-center'>
          <p className='text-sm uppercase tracking-[0.35rem] text-jpv-green/80'>JPV Bootcamp Membership</p>
          <h1 className='text-4xl font-bold sm:text-5xl'>Choose your membership billing</h1>
          <p className='mx-auto max-w-2xl text-jpv-gray-300'>
            One membership with monthly or annual billing. Every Checkout collects email, telephone number, a
            payment method, and supports personal voucher or pay-it-forward promotion codes.
          </p>
        </header>

        <div className='grid gap-6 md:grid-cols-2'>
          <section className='rounded-3xl border border-jpv-gray-700 bg-jpv-bg-dark/70 p-8'>
            <h2 className='text-2xl font-semibold'>Monthly</h2>
            <p className='mt-3 text-3xl font-bold'>£80/month</p>
            <p className='mt-3 text-sm leading-6 text-jpv-gray-300'>
              No minimum commitment. Renews monthly until cancelled; cancellation takes effect at the end of the
              current paid month.
            </p>
            <a
              aria-disabled={!accepted}
              href={accepted ? monthlyHref : undefined}
              className='mt-6 block rounded-full bg-jpv-green px-6 py-3 text-center font-semibold text-black aria-disabled:pointer-events-none aria-disabled:opacity-50'
            >
              Continue with monthly billing
            </a>
          </section>

          <section className='rounded-3xl border border-jpv-green/60 bg-jpv-bg-dark/70 p-8'>
            <h2 className='text-2xl font-semibold'>Annual</h2>
            <p className='mt-3 text-3xl font-bold'>£800/year</p>
            <p className='mt-3 text-sm leading-6 text-jpv-gray-300'>
              Paid upfront for 12 months and renews automatically each year unless cancelled before renewal.
            </p>
            <a
              aria-disabled={!accepted}
              href={accepted ? annualHref : undefined}
              className='mt-6 block rounded-full bg-jpv-green px-6 py-3 text-center font-semibold text-black aria-disabled:pointer-events-none aria-disabled:opacity-50'
            >
              Continue with annual billing
            </a>
          </section>
        </div>

        <label className='flex items-start gap-3 rounded-2xl border border-jpv-gray-700 bg-jpv-bg-dark/70 p-5 text-sm leading-6 text-jpv-gray-300'>
          <input
            type='checkbox'
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
            className='mt-1 h-4 w-4'
          />
          <span>
            I understand that the selected membership renews automatically until cancelled. A voucher or
            pay-it-forward code covers only its approved period, after which the same subscription renews at the
            normal recurring price.
          </span>
        </label>

        <div className='flex justify-center gap-6 text-sm text-jpv-gray-300'>
          <a href='/portal?mode=login' className='hover:text-jpv-green'>Sign in</a>
          <a href='/' className='hover:text-jpv-green'>Back to main site</a>
        </div>
      </div>
    </main>
  )
}
