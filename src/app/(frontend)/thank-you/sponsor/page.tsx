import { Suspense } from 'react'

import { PublicInformationShell } from '@/components/public/PublicInformationShell'
import ThankYouClient from '../ThankYouClient'

export const metadata = {
  title: 'Thanks for funding JPV Bootcamp | JPV Bootcamp',
  description: 'Your purchase funded a sponsored JPV Bootcamp membership place.',
}

export default function SponsoredThankYouPage() {
  return (
    <PublicInformationShell
      description="Your purchase funded a sponsored JPV Bootcamp membership place. Someone who is ready to learn can now receive access."
      eyebrow='Payment received'
      title="Thanks — you're in."
    >
      <section className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8'>
        <Suspense fallback={<p className='text-sm text-jpv-muted'>Redirecting to the home page…</p>}>
          <ThankYouClient />
        </Suspense>
      </section>
    </PublicInformationShell>
  )
}
