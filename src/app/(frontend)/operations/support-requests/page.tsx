import 'server-only'

import Link from 'next/link'
import { revalidatePath } from 'next/cache'

import { requireCurrentPayloadAdmin } from '@/lib/admin/currentAdmin'
import { formatPhoneForDisplay } from '@/lib/normalize-phone'
import prisma from '@/libs/prisma'

export const dynamic = 'force-dynamic'

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value)
}

async function updateSupportRequest(formData: FormData) {
  'use server'

  const admin = await requireCurrentPayloadAdmin()
  const adminId = typeof admin.id === 'number' ? admin.id : Number(admin.id)
  const requestId = String(formData.get('requestId') ?? '')
  const reviewStatus = String(formData.get('reviewStatus') ?? '')

  if (!Number.isInteger(adminId)) throw new Error('Authenticated administrator ID is invalid')
  if (!requestId || !['pending', 'in_review', 'resolved'].includes(reviewStatus)) return

  await prisma.supportRequest.update({
    where: { id: requestId },
    data: {
      reviewStatus,
      reviewedAt: reviewStatus === 'pending' ? null : new Date(),
      reviewedByAccountId: reviewStatus === 'pending' ? null : adminId,
    },
  })

  revalidatePath('/operations/support-requests')
}

export default async function SupportRequestsPage() {
  await requireCurrentPayloadAdmin()

  const requests = await prisma.supportRequest.findMany({
    orderBy: [{ reviewStatus: 'asc' }, { createdAt: 'desc' }],
    take: 100,
  })

  const openCount = requests.filter((request) => request.reviewStatus !== 'resolved').length

  return (
    <main className='mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8'>
      <Link className='inline-flex min-h-11 items-center text-sm font-semibold text-jpv-muted underline-offset-4 hover:text-jpv-ink hover:underline' href='/admin'>
        ← Back to Payload dashboard
      </Link>
      <header className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8'>
        <p className='jpv-eyebrow'>Support</p>
        <div className='mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between'>
          <div>
            <h1 className='text-3xl font-semibold tracking-tight text-jpv-ink'>Support requests</h1>
            <p className='mt-2 max-w-2xl text-sm leading-6 text-jpv-muted'>
              Questions submitted through the public and member support forms. Review each request and track whether it is being handled.
            </p>
          </div>
          <span className='inline-flex min-h-11 items-center rounded-jpv-pill border border-jpv-border bg-jpv-surface px-4 text-sm font-semibold text-jpv-ink'>
            {openCount} open
          </span>
        </div>
      </header>

      {requests.length === 0 ? (
        <section className='rounded-jpv-panel border border-dashed border-jpv-border bg-jpv-surface p-6 text-sm text-jpv-muted'>
          No support requests have been submitted yet.
        </section>
      ) : (
        <section className='space-y-4' aria-label='Support request inbox'>
          {requests.map((request) => (
            <article className='rounded-jpv-card border border-jpv-border bg-jpv-canvas p-5 shadow-jpv-card sm:p-6' key={request.id}>
              <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
                <div className='min-w-0'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <span className='jpv-eyebrow'>{request.reviewStatus.replace('_', ' ')}</span>
                    <span className='text-xs text-jpv-muted'>{formatDate(request.createdAt)}</span>
                  </div>
                  <h2 className='mt-2 break-words text-xl font-semibold text-jpv-ink'>{request.name}</h2>
                  <a className='mt-1 inline-flex min-h-11 items-center break-all text-sm font-semibold text-jpv-brand-deep hover:underline' href={`mailto:${request.normalizedEmail}`}>
                    {request.normalizedEmail}
                  </a>
                  {request.phone ? (
                    <a className='mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-jpv-brand-deep hover:underline' href={`tel:${request.phone}`}>
                      Phone: {formatPhoneForDisplay(request.phone)}
                    </a>
                  ) : (
                    <p className='mt-1 text-sm text-jpv-muted'>Phone: Not provided</p>
                  )}
                  <p className='mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-jpv-ink'>{request.question}</p>
                  <p className='mt-4 text-xs text-jpv-muted'>Source: {request.source ?? 'support form'}</p>
                </div>

                <form action={updateSupportRequest} className='flex w-full flex-wrap gap-2 lg:w-auto'>
                  <input name='requestId' type='hidden' value={request.id} />
                  {request.reviewStatus !== 'in_review' ? (
                    <button className='jpv-button-secondary min-h-11 flex-1 justify-center lg:flex-none' name='reviewStatus' type='submit' value='in_review'>
                      Mark in review
                    </button>
                  ) : null}
                  {request.reviewStatus !== 'resolved' ? (
                    <button className='jpv-button-primary min-h-11 flex-1 justify-center lg:flex-none' name='reviewStatus' type='submit' value='resolved'>
                      Mark resolved
                    </button>
                  ) : (
                    <button className='jpv-button-secondary min-h-11 flex-1 justify-center lg:flex-none' name='reviewStatus' type='submit' value='pending'>
                      Reopen
                    </button>
                  )}
                </form>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  )
}
