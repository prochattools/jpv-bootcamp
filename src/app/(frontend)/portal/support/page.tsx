'use client'
import Link from 'next/link'
import { useState } from 'react'
import { validateSponsorIntent, validateRecipientApplication } from '@/lib/support/payItForwardService'

export const dynamic = 'force-dynamic'

export default function PortalSupportPage() {
  const [mode, setMode] = useState<'sponsor' | 'apply' | null>(null)
  const [sponsorResult, setSponsorResult] = useState<string | null>(null)
  const [recipientResult, setRecipientResult] = useState<string | null>(null)
  const [sponsorErrors, setSponsorErrors] = useState<string[]>([])
  const [recipientErrors, setRecipientErrors] = useState<string[]>([])

  async function handleSponsorSubmit(formData: FormData) {
    const name = (formData.get('sponsorName') as string) ?? ''
    const email = (formData.get('sponsorEmail') as string) ?? ''
    const message = (formData.get('sponsorMessage') as string) ?? ''

    const result = validateSponsorIntent({ name, email, message: message || undefined })

    if (result.status === 'validation_failed') {
      setSponsorErrors(result.errors)
      setSponsorResult(null)
      return
    }

    setSponsorErrors([])
    setSponsorResult(`Reference: ${result.reference}. Your sponsorship intent has been recorded. A team member will follow up manually.`)
  }

  async function handleRecipientSubmit(formData: FormData) {
    const name = (formData.get('recipientName') as string) ?? ''
    const email = (formData.get('recipientEmail') as string) ?? ''
    const reason = (formData.get('recipientReason') as string) ?? ''
    const consentAccepted = formData.get('recipientConsent') === 'on'

    const result = validateRecipientApplication({ name, email, reason, consentAccepted })

    if (result.status === 'validation_failed') {
      setRecipientErrors(result.errors)
      setRecipientResult(null)
      return
    }

    setRecipientErrors([])
    setRecipientResult(`Reference: ${result.reference}. Your application has been submitted for manual review.`)
  }

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">
          Support
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Support & Pay It Forward</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600">
          Sponsor a Free access seat or apply for controlled Free access after review.
        </p>
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Preview only — no live submission processing or email confirmation is active. All
          follow-up is manual. Full features require migration and provider email verification.
        </div>
      </section>

      {!mode ? (
        <section className="grid gap-5 md:grid-cols-2">
          <button
            onClick={() => setMode('sponsor')}
            className="rounded-2xl border border-neutral-200 bg-white p-6 text-left shadow-sm transition hover:border-neutral-300 hover:shadow-md"
          >
            <h2 className="text-xl font-semibold text-neutral-950">Sponsor a seat</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              Sponsor a Free access seat for someone in your network. A team member will follow up manually.
            </p>
          </button>
          <button
            onClick={() => setMode('apply')}
            className="rounded-2xl border border-neutral-200 bg-white p-6 text-left shadow-sm transition hover:border-neutral-300 hover:shadow-md"
          >
            <h2 className="text-xl font-semibold text-neutral-950">Apply for Free access</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              Apply for controlled Free access after manual review through pay-it-forward or administrator action.
            </p>
          </button>
        </section>
      ) : mode === 'sponsor' ? (
        <section className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-2xl font-semibold text-neutral-950">Sponsor a seat</h2>
            <button
              onClick={() => { setMode(null); setSponsorResult(null); setSponsorErrors([]) }}
              className="text-sm font-semibold text-neutral-700 underline-offset-4 hover:text-neutral-950 hover:underline"
            >
              Back
            </button>
          </div>
          {sponsorResult ? (
            <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {sponsorResult}
            </p>
          ) : (
            <form action={handleSponsorSubmit} className="mt-6 space-y-5">
              {sponsorErrors.length > 0 ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {sponsorErrors.map((error, i) => (
                    <p key={i}>{error}</p>
                  ))}
                </div>
              ) : null}
              <div>
                <label className="block text-sm font-medium text-neutral-700" htmlFor="sponsorName">Your name</label>
                <input className="mt-1 block w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm" id="sponsorName" name="sponsorName" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700" htmlFor="sponsorEmail">Your email</label>
                <input className="mt-1 block w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm" id="sponsorEmail" name="sponsorEmail" type="email" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700" htmlFor="sponsorMessage">Message (optional)</label>
                <textarea className="mt-1 block w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm" id="sponsorMessage" name="sponsorMessage" rows={3} />
              </div>
              <button
                className="rounded-lg bg-neutral-950 px-6 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800"
                type="submit"
              >
                Submit sponsorship intent
              </button>
            </form>
          )}
        </section>
      ) : (
        <section className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-2xl font-semibold text-neutral-950">Apply for Free access</h2>
            <button
              onClick={() => { setMode(null); setRecipientResult(null); setRecipientErrors([]) }}
              className="text-sm font-semibold text-neutral-700 underline-offset-4 hover:text-neutral-950 hover:underline"
            >
              Back
            </button>
          </div>
          {recipientResult ? (
            <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {recipientResult}
            </p>
          ) : (
            <form action={handleRecipientSubmit} className="mt-6 space-y-5">
              {recipientErrors.length > 0 ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {recipientErrors.map((error, i) => (
                    <p key={i}>{error}</p>
                  ))}
                </div>
              ) : null}
              <div>
                <label className="block text-sm font-medium text-neutral-700" htmlFor="recipientName">Your name</label>
                <input className="mt-1 block w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm" id="recipientName" name="recipientName" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700" htmlFor="recipientEmail">Your email</label>
                <input className="mt-1 block w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm" id="recipientEmail" name="recipientEmail" type="email" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700" htmlFor="recipientReason">Why are you applying?</label>
                <textarea className="mt-1 block w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm" id="recipientReason" name="recipientReason" rows={3} required />
              </div>
              <div className="flex items-start gap-3">
                <input className="mt-1 h-4 w-4" id="recipientConsent" name="recipientConsent" type="checkbox" />
                <label className="text-sm text-neutral-600" htmlFor="recipientConsent">
                  I consent to my application being reviewed by the JPV Bootcamp team.
                </label>
              </div>
              <button
                className="rounded-lg bg-neutral-950 px-6 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800"
                type="submit"
              >
                Submit application
              </button>
            </form>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-neutral-950">About Free access</h2>
        <p className="mt-2 text-sm leading-6 text-neutral-600">
          Free is controlled non-paid access only. Approved applicants receive Free access after
          manual review through support, pay-it-forward, or administrator action. Free is not a
          third public tier — the only paid membership is Pro at £80/month or £880/year.
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
            Dashboard
          </Link>
        </div>
      </section>
    </div>
  )
}
