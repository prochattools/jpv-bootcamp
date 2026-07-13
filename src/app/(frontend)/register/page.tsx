import Link from 'next/link'
import { redirect } from 'next/navigation'

import { MemberRegistrationForm } from '@/components/auth/MemberRegistrationForm'
import { getCurrentPayloadMember } from '@/lib/members/currentMember'

export const metadata = {
  title: 'Create Free Account | JPV Bootcamp',
  description: 'Create a free JPV Bootcamp account and verify your email before sign in.',
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function RegisterPage() {
  const { member } = await getCurrentPayloadMember()
  if (member) redirect('/portal')

  return (
    <main className='mx-auto grid min-h-screen max-w-7xl items-center px-6 py-12 lg:grid-cols-[1fr_0.9fr] lg:px-10'>
      <section>
        <p className='text-xs font-bold uppercase tracking-[0.2em] text-[#8a7450]'>
          JPV Bootcamp free access
        </p>
        <h1 className='mt-4 max-w-2xl text-4xl font-bold leading-tight tracking-tight text-[#153f2e] sm:text-5xl'>
          Create a free account. Verify email. Start learning.
        </h1>
        <p className='mt-5 max-w-xl text-base leading-7 text-[#64736c]'>
          Free is controlled support or pay-it-forward access. Pro is the only paid membership and is managed inside the new JPV Bootcamp platform.
        </p>
      </section>

      <section className='rounded-[24px] border border-[#153f2e]/10 bg-white p-6 shadow-[0_16px_45px_rgba(31,52,43,0.08)] sm:p-8'>
        <div className='mb-6'>
          <h2 className='text-2xl font-bold text-[#153f2e]'>Create free account</h2>
          <p className='mt-2 text-sm leading-6 text-[#68766f]'>
            Email verification is required before you can sign in. No payment is required.
          </p>
        </div>

        <MemberRegistrationForm />

        <p className='mt-6 text-sm text-[#68766f]'>
          Already verified?{' '}
          <Link className='font-semibold text-[#153f2e] underline underline-offset-4' href='/portal?mode=login'>
            Sign in
          </Link>
        </p>
      </section>
    </main>
  )
}
