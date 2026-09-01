'use client'

import { useEffect } from 'react'

export default function BillingPortalReturnPage() {
  useEffect(() => {
    // Stripe returns from a different site. Re-enter the portal through a
    // first-party navigation so the existing member cookie is applied before
    // the protected billing page resolves the session.
    window.location.replace('/portal/billing')
  }, [])

  return (
    <main className='mx-auto flex min-h-screen max-w-2xl items-center justify-center px-6 py-16 text-center'>
      <div>
        <p className='jpv-eyebrow'>JPV Bootcamp</p>
        <h1 className='mt-3 text-3xl font-semibold tracking-tight text-jpv-ink'>Returning to your billing page…</h1>
        <p className='mt-3 text-jpv-muted'>If you are not redirected automatically, continue below.</p>
        <a className='jpv-button-primary mt-6 inline-flex' href='/portal/billing'>Continue to billing</a>
      </div>
    </main>
  )
}
