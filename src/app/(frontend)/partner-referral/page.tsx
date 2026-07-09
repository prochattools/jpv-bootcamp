import { redirect } from 'next/navigation'
import { parseReferralCode, validateApplication } from '@/lib/referral/referralService'

export const dynamic = 'force-dynamic'

function field(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : ''
}

async function submitAction(formData: FormData) {
  'use server'
  const name = field(formData.get('name'))
  const email = field(formData.get('email'))
  const phone = field(formData.get('phone'))
  const message = field(formData.get('message'))
  const consentAccepted = formData.get('consentAccepted') === 'on'
  const ref = field(formData.get('ref'))

  const result = validateApplication({ name, email, phone, message, consentAccepted })

  const params = new URLSearchParams()
  if (ref) params.set('ref', ref)
  if (result.status === 'validation_failed') {
    params.set('error', result.errors.join(', '))
  } else {
    params.set('submitted', result.reference)
  }
  redirect(`/partner-referral?${params.toString()}`)
}

type SearchParams = Promise<{ ref?: string; submitted?: string; error?: string }>

export default async function PartnerReferralPage({ searchParams }: { searchParams?: SearchParams }) {
  const query = (await (searchParams ?? Promise.resolve({}))) as { ref?: string; submitted?: string; error?: string }
  const referralCode = parseReferralCode(query.ref ?? null)

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold">Partner Referral</h1>
        <p className="text-muted-foreground">
          Apply through a partner referral to join the JPV Bootcamp community.
        </p>
      </div>

      {referralCode ? (
        <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Referred by partner code: <strong>{referralCode}</strong>
        </div>
      ) : null}

      {query.submitted ? (
        <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Application submitted for manual review. Reference: <strong>{query.submitted}</strong>
        </div>
      ) : null}

      {query.error ? (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {query.error}
        </div>
      ) : null}

      {!query.submitted ? (
        <section className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-neutral-950">Apply for partnership</h2>
          <form action={submitAction} className="mt-6 grid gap-4 sm:grid-cols-2">
            {referralCode ? (
              <input type="hidden" name="ref" value={referralCode} />
            ) : null}
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
              Phone
              <input
                className="mt-2 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                name="phone"
                maxLength={30}
              />
            </label>
            <label className="sm:col-span-2 text-sm font-medium text-neutral-800">
              Message
              <textarea
                className="mt-2 min-h-24 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                name="message"
                maxLength={1200}
              />
            </label>
            <label className="sm:col-span-2 flex items-start gap-3 text-sm text-neutral-700">
              <input type="checkbox" name="consentAccepted" required className="mt-1" />
              <span>
                I consent to JPV Bootcamp processing my application data for partnership review purposes.
              </span>
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                className="rounded-lg bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800"
              >
                Submit application
              </button>
            </div>
          </form>
        </section>
      ) : null}
    </main>
  )
}