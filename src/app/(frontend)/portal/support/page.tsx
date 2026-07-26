import Link from 'next/link'

export const dynamic = 'force-dynamic'

const disabledFieldClass =
  'mt-2 block min-h-11 w-full rounded-jpv-control border border-jpv-border bg-jpv-surface px-4 py-3 text-sm text-jpv-muted'

function DisabledField({
  label,
  name,
  type = 'text',
}: {
  label: string
  name: string
  type?: 'text' | 'email'
}) {
  return (
    <div>
      <label className='block text-sm font-medium text-jpv-ink' htmlFor={name}>
        {label}
      </label>
      <input
        className={disabledFieldClass}
        disabled
        id={name}
        name={name}
        type={type}
      />
    </div>
  )
}

export default function PortalSupportPage() {
  return (
    <div className='space-y-6'>
      <section className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8'>
        <p className='jpv-eyebrow'>Support</p>
        <h1 className='mt-2 text-3xl font-semibold tracking-tight text-jpv-ink'>Support &amp; Pay It Forward</h1>
        <p className='mt-3 max-w-2xl text-sm leading-6 text-jpv-muted'>
          Preview the planned voucher-funded and pay-it-forward-funded JPV Bootcamp Membership application flows.
        </p>
        <div className='jpv-notice mt-4'>
          Preview only — these forms do not submit, create records, send notifications, or generate references. Voucher-funded and pay-it-forward-funded access use the same membership lifecycle and require administrator review.
        </div>
        <Link className='jpv-button-secondary mt-4 min-h-11' href='/#pricing'>
          View JPV Bootcamp Membership
        </Link>
      </section>

      <div className='grid gap-6 lg:grid-cols-2'>
        <section className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8'>
          <h2 className='text-2xl font-semibold text-jpv-ink'>Sponsor a seat</h2>
          <p className='mt-2 text-sm leading-6 text-jpv-muted'>
            Durable sponsorship-intent processing is not active yet.
          </p>
          <form aria-label='Sponsor seat preview' className='mt-6 space-y-5'>
            <DisabledField label='Full name' name='sponsorName' />
            <DisabledField label='Email address' name='sponsorEmail' type='email' />
            <div>
              <label className='block text-sm font-medium text-jpv-ink' htmlFor='sponsorMessage'>
                Message
              </label>
              <textarea
                className={disabledFieldClass}
                disabled
                id='sponsorMessage'
                name='sponsorMessage'
                rows={4}
              />
            </div>
            <button
              className='jpv-button-secondary min-h-11 w-full cursor-not-allowed opacity-60'
              disabled
              type='button'
            >
              Submission unavailable in preview
            </button>
          </form>
        </section>

        <section className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8'>
          <h2 className='text-2xl font-semibold text-jpv-ink'>Apply for funded membership</h2>
          <p className='mt-2 text-sm leading-6 text-jpv-muted'>
            Durable application and manual review processing is not active yet.
          </p>
          <form aria-label='Funded membership application preview' className='mt-6 space-y-5'>
            <DisabledField label='Full name' name='recipientName' />
            <DisabledField label='Email address' name='recipientEmail' type='email' />
            <div>
              <label className='block text-sm font-medium text-jpv-ink' htmlFor='recipientReason'>
                Reason for applying
              </label>
              <textarea
                className={disabledFieldClass}
                disabled
                id='recipientReason'
                name='recipientReason'
                rows={4}
              />
            </div>
            <button
              className='jpv-button-secondary min-h-11 w-full cursor-not-allowed opacity-60'
              disabled
              type='button'
            >
              Submission unavailable in preview
            </button>
          </form>
        </section>
      </div>

      <Link className='inline-flex min-h-11 items-center text-sm font-medium text-jpv-brand-deep hover:underline' href='/portal'>
        Back to portal
      </Link>
    </div>
  )
}
