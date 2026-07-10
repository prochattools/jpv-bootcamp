import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default function PortalPartnerReferralPage() {
  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">
          Partners
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Partner Referral</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600">
          Preview the planned partner-referral application flow.
        </p>
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Preview only — this form does not submit, create a record, send a notification, or generate a reference.
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-neutral-950">Application form</h2>
        <p className="mt-2 text-sm leading-6 text-neutral-600">
          Durable partner-application processing is not active yet.
        </p>
        <form className="mt-6 space-y-5" aria-label="Partner referral preview">
          <div>
            <label className="block text-sm font-medium text-neutral-700" htmlFor="name">
              Full name
            </label>
            <input
              className="mt-1 block w-full rounded-lg border border-neutral-300 bg-neutral-100 px-4 py-2.5 text-sm text-neutral-500"
              disabled
              id="name"
              name="name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700" htmlFor="email">
              Email address
            </label>
            <input
              className="mt-1 block w-full rounded-lg border border-neutral-300 bg-neutral-100 px-4 py-2.5 text-sm text-neutral-500"
              disabled
              id="email"
              name="email"
              type="email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700" htmlFor="phone">
              Phone
            </label>
            <input
              className="mt-1 block w-full rounded-lg border border-neutral-300 bg-neutral-100 px-4 py-2.5 text-sm text-neutral-500"
              disabled
              id="phone"
              name="phone"
              type="tel"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700" htmlFor="message">
              Message
            </label>
            <textarea
              className="mt-1 block w-full rounded-lg border border-neutral-300 bg-neutral-100 px-4 py-2.5 text-sm text-neutral-500"
              disabled
              id="message"
              name="message"
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

      <Link className="text-sm font-medium text-neutral-600 hover:text-neutral-950" href="/portal">
        Back to portal
      </Link>
    </div>
  )
}
