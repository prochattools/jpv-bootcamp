import Link from 'next/link'
import { notFound } from 'next/navigation'

import { requirePortalMember } from '@/lib/auth/requirePortalMember'
import { getMemberCommunitySpaceDetail } from '@/lib/payloadCourse/communityPortal'
import { listSpaceLiveCalls } from '@/lib/liveSessions/memberSessions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ spaceSlug: string }>
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(date)
}

function statusLabel(status: string): string {
  if (status === 'live') return 'Live now'
  if (status === 'scheduled') return 'Scheduled'
  if (status === 'cancelled') return 'Cancelled'
  return status
}

function statusClass(status: string): string {
  if (status === 'live') return 'bg-emerald-50 text-emerald-700'
  if (status === 'scheduled') return 'bg-jpv-surface text-jpv-ink'
  return 'bg-jpv-surface-strong text-jpv-muted'
}

export default async function SpaceCallsPage({ params }: PageProps) {
  const { spaceSlug } = await params
  const encodedSlug = encodeURIComponent(spaceSlug)
  const { memberId, payload } = await requirePortalMember(`/portal/community/${encodedSlug}/calls`)

  const detail = await getMemberCommunitySpaceDetail(payload, memberId, spaceSlug)
  if (!detail || !detail.allowed) notFound()

  const calls = await listSpaceLiveCalls(payload, detail.id)

  return (
    <div className='space-y-6'>
      <Link
        className='text-sm font-bold text-jpv-sunshine-ink hover:text-jpv-brand-deep'
        href={`/portal/community/${encodedSlug}`}
      >
        ← {detail.name}
      </Link>

      <header className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8'>
        <p className='jpv-eyebrow'>{detail.name}</p>
        <h1 className='mt-2 text-3xl font-semibold tracking-tight text-jpv-ink'>Group calls</h1>
        <p className='mt-3 max-w-3xl text-sm leading-6 text-jpv-muted'>
          Upcoming and live calls for this space. Calls are scheduled by administrators.
          Join becomes available when the host opens the room.
        </p>
      </header>

      {calls.length > 0 ? (
        <section className='grid gap-4'>
          {calls.map((call) => (
            <article
              className='rounded-jpv-card border border-jpv-border bg-jpv-canvas p-5 shadow-jpv-card sm:p-6'
              key={call.id}
            >
              <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
                <div className='min-w-0'>
                  <h2 className='text-xl font-semibold text-jpv-ink'>{call.title}</h2>
                  <p className='mt-2 text-sm text-jpv-muted'>{formatDate(call.scheduledAt)}</p>
                  <p
                    className={`mt-3 inline-flex rounded-jpv-pill px-3 py-1 text-xs font-semibold ${statusClass(call.status)}`}
                  >
                    {statusLabel(call.status)}
                  </p>
                </div>
                {call.canJoin ? (
                  <Link
                    className='jpv-button-primary min-h-11 shrink-0'
                    href={`/portal/community/${encodedSlug}/calls/${encodeURIComponent(call.id)}`}
                  >
                    Join call
                  </Link>
                ) : (
                  <span className='text-sm text-jpv-muted'>
                    {call.status === 'scheduled' ? 'Waiting for host' : 'Joining closed'}
                  </span>
                )}
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className='rounded-jpv-card border border-dashed border-jpv-border bg-jpv-canvas p-6 text-sm text-jpv-muted sm:p-8'>
          No upcoming calls are scheduled for this space yet.
        </section>
      )}
    </div>
  )
}
