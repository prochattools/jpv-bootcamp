import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { requirePortalMember } from '@/lib/auth/requirePortalMember'
import { getPartnerApplicationDetail, submitPartnerApplication } from '@/lib/payloadCourse/partnerApplications'

export const dynamic = 'force-dynamic'

const fieldClass =
  'mt-2 w-full rounded-jpv-control border border-jpv-border bg-jpv-canvas px-4 py-3 text-sm text-jpv-ink outline-none transition focus:border-jpv-green-deep focus:ring-2 focus:ring-jpv-green/25'

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

export default async function PartnerApplicationPage({
  params,
  searchParams,
}: {
  params: Promise<{ partnerSlug: string }>
  searchParams?: Promise<{ submitted?: string }>
}): Promise<JSX.Element> {
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
    <div className='space-y-6'>
      <Link className='inline-flex min-h-11 items-center text-sm font-semibold text-jpv-brand-deep hover:underline' href='/portal/partners'>
        Back to partners
      </Link>

      <header className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8'>
        <p className='jpv-eyebrow'>Partner application</p>
        <h1 className='mt-2 text-3xl font-semibold tracking-tight text-jpv-ink'>{partner.name}</h1>
        <p className='mt-3 max-w-3xl text-sm leading-6 text-jpv-muted'>
          {partner.summary ?? 'Partner details are limited to approved member-safe fields.'}
        </p>
      </header>

      {query.submitted ? (
        <p className='jpv-notice'>Application status: {query.submitted}</p>
      ) : null}

      <section className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-5 shadow-jpv-card sm:p-6'>
        <div className='max-w-3xl'>
          <p className='jpv-eyebrow'>Application details</p>
          <h2 className='mt-2 text-xl font-semibold text-jpv-ink'>Privacy and consent</h2>
          <p className='mt-2 text-sm leading-6 text-jpv-muted'>
            Your application uses your authenticated member identity and the partner&apos;s configured delivery mode. Browser input cannot control recipient destinations.
          </p>
          {partner.privacyNotice ? <p className='jpv-notice mt-4'>{partner.privacyNotice}</p> : null}
        </div>

        <form action={submitAction} className='mt-6 grid gap-5 sm:grid-cols-2'>
          <input name='partnerSlug' type='hidden' value={partnerSlug} />
          <label className='text-sm font-medium text-jpv-ink'>
            Company
            <input className={fieldClass} maxLength={120} name='company' />
          </label>
          <label className='text-sm font-medium text-jpv-ink'>
            Country
            <input className={fieldClass} maxLength={80} name='country' />
          </label>
          <label className='text-sm font-medium text-jpv-ink sm:col-span-2'>
            Experience
            <input className={fieldClass} maxLength={160} name='experience' />
          </label>
          <label className='text-sm font-medium text-jpv-ink sm:col-span-2'>
            Message
            <textarea className={`${fieldClass} min-h-32`} maxLength={1200} name='message' />
          </label>
          <label className='flex min-h-11 items-start gap-3 rounded-jpv-card border border-jpv-border bg-jpv-surface p-4 text-sm text-jpv-ink sm:col-span-2'>
            <input className='mt-1 h-5 w-5 accent-jpv-brand' name='consentAccepted' required type='checkbox' />
            <span>I agree to share the submitted application details with this partner under the published privacy notice.</span>
          </label>
          <div className='sm:col-span-2'>
            <button className='jpv-button-primary min-h-11' type='submit'>
              Submit application
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
