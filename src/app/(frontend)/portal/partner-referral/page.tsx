'use client'
import Link from 'next/link'
import { useState } from 'react'
import { validateApplication } from '@/lib/referral/referralService'

export const dynamic = 'force-dynamic'

export default function PortalPartnerReferralPage() {
  const [result, setResult] = useState<string | null>(null)
  const [errors, setErrors] = useState<string[]>([])

  async function handleSubmit(formData: FormData) {
    const name = (formData.get('name') as string) ?? ''
    const email = (formData.get('email') as string) ?? ''
    const phone = (formData.get('phone') as string) ?? ''
    const message = (formData.get('message') as string) ?? ''
    const consentAccepted = formData.get('consentAccepted') === 'on'

    const validationResult = validateApplication({ name, email, phone: phone || undefined, message: message || undefined, consentAccepted })

    if (validationResult.status === 'validation_failed') {
      setErrors(validationResult.errors)
      setResult(null)
      return
    }

    setErrors([])
    setResult(`Reference: ${validationResult.reference}. Your partner referral application has been submitted for review.`)
  }

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">
          Partners
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Partner Referral</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600">
          Apply through a partner referral to join the JPV Bootcamp community.
        </p>
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Preview only — no live submission processing or email confirmation is active. All
          review is manual. Full features require migration and provider email verification.
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-neutral-950">Application form</h2>
        {result ? (
          <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {result}
          </p>
        ) : (
          <form action={handleSubmit} className="mt-6 space-y-5">
            {errors.length > 0 ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {errors.map((error, i) => (
                  <p key={i}>{error}</p>
                ))}
              </div>
            ) : null}
            <div>
              <label className="block text-sm font-medium text-neutral-700" htmlFor="name">Full name</label>
              <input className="mt-1 block w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm" id="name" name="name" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700" htmlFor="email">Email address</label>
              <input className="mt-1 block w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm" id="email" name="email" type="email" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700" htmlFor="phone">Phone (optional)</label>
              <input className="mt-1 block w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm" id="phone" name="phone" type="tel" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700" htmlFor="message">Message (optional)</label>
              <textarea className="mt-1 block w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm" id="message" name="message" rows={3} />
            </div>
            <div className="flex items-start gap-3">
              <input className="mt-1 h-4 w-4" id="consentAccepted" name="consentAccepted" type="checkbox" />
              <label className="text-sm text-neutral-600" htmlFor="consentAccepted">
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

      <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-neutral-950">Membership</h2>
        <p className="mt-2 text-sm leading-6 text-neutral-600">
          Pro is the single paid JPV Bootcamp membership at £80/month or £880/year.
          Partner referral applicants may be eligible for controlled Free access after review.
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
