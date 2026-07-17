import Link from 'next/link'

export const dynamic = 'force-dynamic'

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
      <label className="block text-sm font-medium text-neutral-700" htmlFor={name}>
        {label}
      </label>
      <input
        className="mt-1 block w-full rounded-lg border border-neutral-300 bg-neutral-100 px-4 py-2.5 text-sm text-neutral-500"
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
    <div className="space-y-8">
      <section>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">
          Support
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Support &amp; Pay It Forward</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600">
          Preview the planned voucher-funded and pay-it-forward-funded JPV Bootcamp Membership application flows for controlled Free access.
        </p>
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Preview only — these forms do not submit, create records, send notifications, or generate references. Voucher-funded and pay-it-forward-funded access use the same membership lifecycle and route through controlled Free access.
        </div>
        <Link className="mt-4 inline-flex text-sm font-medium text-neutral-600 hover:text-neutral-950" href="/#pricing">
          View JPV Bootcamp Membership
        </Link>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-neutral-950">Sponsor a seat</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            Durable sponsorship-intent processing is not active yet.
          </p>
          <form className="mt-6 space-y-5" aria-label="Sponsor seat preview">
            <DisabledField label="Full name" name="sponsorName" />
            <DisabledField label="Email address" name="sponsorEmail" type="email" />
            <div>
              <label className="block text-sm font-medium text-neutral-700" htmlFor="sponsorMessage">
                Message
              </label>
              <textarea
                className="mt-1 block w-full rounded-lg border border-neutral-300 bg-neutral-100 px-4 py-2.5 text-sm text-neutral-500"
                disabled
                id="sponsorMessage"
                name="sponsorMessage"
                rows={4}
              />
            </div>
            <button
              className="w-full cursor-not-allowed rounded-lg bg-neutral-300 px-4 py-3 text-sm font-semibold text-neutral-600"
              disabled
              type="button"
            >
              Submission unavailable in preview
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-neutral-950">Apply for funded membership</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            Durable application and manual review processing is not active yet.
          </p>
          <form className="mt-6 space-y-5" aria-label="Funded membership application preview">
            <DisabledField label="Full name" name="recipientName" />
            <DisabledField label="Email address" name="recipientEmail" type="email" />
            <div>
              <label className="block text-sm font-medium text-neutral-700" htmlFor="recipientReason">
                Reason for applying
              </label>
              <textarea
                className="mt-1 block w-full rounded-lg border border-neutral-300 bg-neutral-100 px-4 py-2.5 text-sm text-neutral-500"
                disabled
                id="recipientReason"
                name="recipientReason"
                rows={4}
              />
            </div>
            <button
              className="w-full cursor-not-allowed rounded-lg bg-neutral-300 px-4 py-3 text-sm font-semibold text-neutral-600"
              disabled
              type="button"
            >
              Submission unavailable in preview
            </button>
          </form>
        </section>
      </div>

      <Link className="text-sm font-medium text-neutral-600 hover:text-neutral-950" href="/portal">
        Back to portal
      </Link>
    </div>
  )
}
