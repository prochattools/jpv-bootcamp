import { revalidatePath } from 'next/cache'
import { notFound, redirect } from 'next/navigation'

import { requirePortalMember } from '@/lib/auth/requirePortalMember'
import { submitPartnerApplication, getPartnerApplicationDetail } from '@/lib/payloadCourse/partnerApplications'

export const dynamic = 'force-dynamic'

function field(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : ''
}

async function submitAction(formData: FormData) {
  'use server'
  const partnerSlug = field(formData.get('partnerSlug'))
  const { memberId, payload } = await requirePortalMember(`/portal/partners/${partnerSlug}`)
  const result = await submitPartnerApplication(payload as never, {
    memberId,
    partnerSlug,
    application: {
      company: field(formData.get('company')),
      country: field(formData.get('country')),
      experience: field(formData.get('experience')),
      message: field(formData.get('message')),
      consentAccepted: formData.get('consentAccepted') === 'on',
    },
  })
  revalidatePath('/portal/partners')
  redirect(`/portal/partners/${partnerSlug}?submitted=${encodeURIComponent(result.outcome)}`)
}

export default async function PartnerApplicationPage({ params, searchParams }: { params: Promise<{ partnerSlug: string }>; searchParams?: Promise<{ submitted?: string }> }): Promise<JSX.Element> {
  const { partnerSlug } = await params
  const { memberId, payload } = await requirePortalMember(`/portal/partners/${partnerSlug}`)
  let partner: Awaited<ReturnType<typeof getPartnerApplicationDetail>>
  try {
    partner = await getPartnerApplicationDetail(payload as never, partnerSlug, memberId)
  } catch {
    notFound()
  }
  const query = (await (searchParams ?? Promise.resolve({}))) as { submitted?: string }

  return (
    <div className='space-y-8'>
      <section className='space-y-3'>
        <p className='text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500'>Partner</p>
        <h1 className='text-3xl font-semibold tracking-tight'>{partner.name}</h1>
        <p className='max-w-3xl text-sm leading-6 text-neutral-600'>{partner.summary ?? 'Partner details are limited to approved member-safe fields.'}</p>
      </section>

      {query.submitted ? (
        <p className='rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800'>
          Application status: {query.submitted}
        </p>
      ) : null}

      <section className='rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm'>
        <h2 className='text-xl font-semibold text-neutral-950'>Privacy and consent</h2>
        <p className='mt-2 text-sm text-neutral-600'>
          Your application is sent using server-owned member identity and the partner&apos;s configured delivery mode. Browser input does not control recipient destinations.
        </p>
        {partner.privacyNotice ? (
          <p className='mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900'>{partner.privacyNotice}</p>
        ) : null}

        <form action={submitAction} className='mt-6 grid gap-4 sm:grid-cols-2'>
          <input type='hidden' name='partnerSlug' value={partnerSlug} />
          <label className='text-sm font-medium text-neutral-800'>
            Company
            <input className='mt-2 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm' name='company' maxLength={120} />
          </label>
          <label className='text-sm font-medium text-neutral-800'>
            Country
            <input className='mt-2 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm' name='country' maxLength={80} />
          </label>
          <label className='sm:col-span-2 text-sm font-medium text-neutral-800'>
            Experience
            <input className='mt-2 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm' name='experience' maxLength={160} />
          </label>
          <label className='sm:col-span-2 text-sm font-medium text-neutral-800'>
            Message
            <textarea className='mt-2 min-h-32 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm' name='message' maxLength={1200} />
          </label>
          <label className='sm:col-span-2 flex items-start gap-3 text-sm text-neutral-700'>
            <input type='checkbox' name='consentAccepted' required className='mt-1' />
            <span>I agree to share the submitted application details with this partner under the published privacy notice.</span>
          </label>
          <div className='sm:col-span-2'>
            <button type='submit' className='rounded-lg bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800'>
              Submit application
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
