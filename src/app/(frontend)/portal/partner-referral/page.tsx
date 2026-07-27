import Link from 'next/link'

export const dynamic = 'force-dynamic'

const fieldClass =
  'mt-2 block min-h-11 w-full rounded-jpv-control border border-jpv-border bg-jpv-surface px-4 py-3 text-sm text-jpv-muted'

export default function PortalPartnerReferralPage() {
  return (
    <div className='space-y-6'>
      <header className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8'>
        <p className='jpv-eyebrow'>Partners</p>
        <h1 className='mt-2 text-3xl font-semibold tracking-tight text-jpv-ink'>Partner referral</h1>
        <p className='mt-3 max-w-2xl text-sm leading-6 text-jpv-muted'>
          Preview the planned partner-referral application flow.
        </p>
        <p className='jpv-notice mt-4'>
          Preview only — this form does not submit, create a record, send a notification, or generate a reference.
        </p>
      </header>

      <section className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-5 shadow-jpv-card sm:p-6'>
        <h2 className='text-xl font-semibold text-jpv-ink'>Application form</h2>
        <p className='mt-2 text-sm leading-6 text-jpv-muted'>Durable partner-application processing is not active yet.</p>
        <form aria-label='Partner referral preview' className='mt-6 grid gap-5 sm:grid-cols-2'>
          <label className='text-sm font-medium text-jpv-ink' htmlFor='name'>
            Full name
            <input className={fieldClass} disabled id='name' name='name' />
          </label>
          <label className='text-sm font-medium text-jpv-ink' htmlFor='email'>
            Email address
            <input className={fieldClass} disabled id='email' name='email' type='email' />
          </label>
          <label className='text-sm font-medium text-jpv-ink' htmlFor='phone'>
            Phone
            <input className={fieldClass} disabled id='phone' name='phone' type='tel' />
          </label>
          <label className='text-sm font-medium text-jpv-ink sm:col-span-2' htmlFor='message'>
            Message
            <textarea className={`${fieldClass} min-h-32`} disabled id='message' name='message' rows={4} />
          </label>
          <button className='jpv-button-secondary min-h-11 w-full cursor-not-allowed justify-center opacity-60 sm:col-span-2' disabled type='button'>
            Submission unavailable in preview
          </button>
        </form>
      </section>

      <Link className='inline-flex min-h-11 items-center text-sm font-semibold text-jpv-brand-deep hover:underline' href='/portal'>
        Back to portal
      </Link>
    </div>
  )
}
