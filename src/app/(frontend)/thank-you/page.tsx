import { Suspense } from 'react'

import { PublicInformationShell } from '@/components/public/PublicInformationShell'
import ThankYouClient from './ThankYouClient'

export const metadata = {
  title: "Thanks - you're in | JPV Bootcamp",
  description: 'Payment received. Check your inbox for login instructions.',
}

export default function ThankYouPage() {
  return (
    <PublicInformationShell
      description="You'll receive an email shortly with login instructions. If it does not arrive within five minutes, check spam or contact support."
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
