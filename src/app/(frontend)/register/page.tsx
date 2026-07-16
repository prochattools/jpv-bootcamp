import Link from 'next/link'

export const metadata = {
  title: 'Choose Membership | JPV Bootcamp',
  description: 'JPV Bootcamp registration is completed through the paid membership Checkout flow.',
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default function RegisterPage() {
  return (
    <main className='mx-auto flex min-h-screen max-w-4xl items-center px-6 py-12 lg:px-10'>
      <section className='w-full rounded-[24px] border border-[#153f2e]/10 bg-white p-8 text-center shadow-[0_16px_45px_rgba(31,52,43,0.08)] sm:p-12'>
        <p className='text-xs font-bold uppercase tracking-[0.2em] text-[#8a7450]'>JPV Bootcamp Membership</p>
        <h1 className='mt-4 text-4xl font-bold tracking-tight text-[#153f2e] sm:text-5xl'>
          Registration starts with membership Checkout.
        </h1>
        <p className='mx-auto mt-5 max-w-2xl text-base leading-7 text-[#64736c]'>
          Public free account creation is unavailable. Choose monthly or annual membership billing, or apply a
          personal voucher or pay-it-forward promotion code during the same Stripe Checkout flow.
        </p>
        <div className='mt-8 flex flex-col justify-center gap-3 sm:flex-row'>
          <Link className='rounded-lg bg-[#153f2e] px-5 py-3 font-semibold text-white' href='/upgrade'>
            Choose membership
          </Link>
          <Link className='rounded-lg border border-[#153f2e]/20 px-5 py-3 font-semibold text-[#153f2e]' href='/portal?mode=login'>
            Existing member sign in
          </Link>
        </div>
      </section>
    </main>
  )
}
