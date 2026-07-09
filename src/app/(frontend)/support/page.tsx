import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  validateSponsorIntent,
  validateRecipientApplication,
} from '@/lib/support/payItForwardService'

export const dynamic = 'force-dynamic'

function field(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : ''
}

async function sponsorAction(formData: FormData) {
  'use server'
  const name = field(formData.get('name'))
  const email = field(formData.get('email'))
  const message = field(formData.get('message'))

  const result = validateSponsorIntent({ name, email, message })

  const params = new URLSearchParams()
  if (result.status === 'validation_failed') {
    params.set('sponsor_error', result.errors.join(', '))
  } else {
    params.set('sponsor_submitted', result.reference)
  }
  redirect(`/support?${params.toString()}`)
}

async function recipientAction(formData: FormData) {
  'use server'
  const name = field(formData.get('name'))
  const email = field(formData.get('email'))
  const reason = field(formData.get('reason'))
  const consentAccepted = formData.get('consentAccepted') === 'on'

  const result = validateRecipientApplication({ name, email, reason, consentAccepted })

  const params = new URLSearchParams()
  if (result.status === 'validation_failed') {
    params.set('recipient_error', result.errors.join(', '))
  } else {
    params.set('recipient_submitted', result.reference)
  }
  redirect(`/support?${params.toString()}`)
}

type SearchParams = Promise<{
  sponsor_error?: string
  sponsor_submitted?: string
  recipient_error?: string
  recipient_submitted?: string
}>

export default async function SupportPage({ searchParams }: { searchParams?: SearchParams }) {
  const query = (await (searchParams ?? Promise.resolve({}))) as {
    sponsor_error?: string
    sponsor_submitted?: string
    recipient_error?: string
    recipient_submitted?: string
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold">Support &amp; Pay It Forward</h1>
        <p className="text-muted-foreground">
          Support funding provides controlled Free access to JPV Bootcamp for approved applicants after review.
          This is not a public free tier. All Free access is reviewed and assigned by administrators.
        </p>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-neutral-950">Sponsor Free access</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Fund a controlled Free access seat for someone who cannot pay. Your intent is recorded for manual follow-up.
            Payment is not processed on this page.
          </p>

          <Link
            href="/sponsored"
            className="mt-3 inline-block text-sm font-semibold text-neutral-900 underline"
          >
            Existing sponsored checkout &rarr;
          </Link>

          {query.sponsor_submitted ? (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Sponsor intent recorded. Reference: <strong>{query.sponsor_submitted}</strong>
            </div>
          ) : null}

          {query.sponsor_error ? (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {query.sponsor_error}
            </div>
          ) : null}

          {!query.sponsor_submitted ? (
            <form action={sponsorAction} className="mt-6 grid gap-4">
              <label className="text-sm font-medium text-neutral-800">
                Full name <span className="text-red-500">*</span>
                <input
                  className="mt-2 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                  name="name"
                  required
                  maxLength={120}
                />
              </label>
              <label className="text-sm font-medium text-neutral-800">
                Email <span className="text-red-500">*</span>
                <input
                  className="mt-2 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                  name="email"
                  type="email"
                  required
                  maxLength={254}
                />
              </label>
              <label className="text-sm font-medium text-neutral-800">
                Message
                <textarea
                  className="mt-2 min-h-20 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                  name="message"
                  maxLength={1200}
                />
              </label>
              <button
                type="submit"
                className="rounded-lg bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800"
              >
                Record sponsor intent
              </button>
            </form>
          ) : null}
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-neutral-950">Apply for Free access</h2>
          <p className="mt-2 text-sm text-neutral-600">
            If you cannot pay for Pro membership, you can apply for controlled Free access.
            Applications are reviewed manually. Approval is not guaranteed.
          </p>

          <Link
            href="/sponsored/claim"
            className="mt-3 inline-block text-sm font-semibold text-neutral-900 underline"
          >
            Have a claim token? Use the sponsored claim page &rarr;
          </Link>

          {query.recipient_submitted ? (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Application submitted for manual review. Reference: <strong>{query.recipient_submitted}</strong>
            </div>
          ) : null}

          {query.recipient_error ? (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {query.recipient_error}
            </div>
          ) : null}

          {!query.recipient_submitted ? (
            <form action={recipientAction} className="mt-6 grid gap-4">
              <label className="text-sm font-medium text-neutral-800">
                Full name <span className="text-red-500">*</span>
                <input
                  className="mt-2 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                  name="name"
                  required
                  maxLength={120}
                />
              </label>
              <label className="text-sm font-medium text-neutral-800">
                Email <span className="text-red-500">*</span>
                <input
                  className="mt-2 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                  name="email"
                  type="email"
                  required
                  maxLength={254}
                />
              </label>
              <label className="text-sm font-medium text-neutral-800">
                Why are you applying? <span className="text-red-500">*</span>
                <textarea
                  className="mt-2 min-h-24 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                  name="reason"
                  required
                  maxLength={1200}
                />
              </label>
              <label className="flex items-start gap-3 text-sm text-neutral-700">
                <input type="checkbox" name="consentAccepted" required className="mt-1" />
                <span>
                  I consent to JPV Bootcamp processing my application data for Free access review purposes.
                </span>
              </label>
              <button
                type="submit"
                className="rounded-lg bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800"
              >
                Submit application
              </button>
            </form>
          ) : null}
        </section>
      </div>

      <section className="mt-12 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-neutral-950">Existing Pro member?</h2>
        <p className="mt-2 text-sm text-neutral-600">
          Pro is the single paid JPV Bootcamp membership with full course access, mentorship, and community.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/upgrade"
            className="rounded-lg bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800"
          >
            View Pro membership
          </Link>
          <Link
            href="/portal"
            className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            Member portal
          </Link>
        </div>
      </section>
    </main>
  )
}