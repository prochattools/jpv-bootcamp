import Link from 'next/link'
import { notFound } from 'next/navigation'

import { LiveSessionState, liveSessionAvailabilityMessage } from '@/components/portal/LiveSessionState'
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

function formatRelative(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.round(diffMs / 60_000)
  if (diffMin < 1) return 'Just started'
  if (diffMin < 60) return `Started ${diffMin} min ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `Started ${diffHr}h ago`
  return formatDate(value)
}

export default async function SpaceCallsPage({ params }: PageProps) {
  const { spaceSlug } = await params
  const encodedSlug = encodeURIComponent(spaceSlug)
  const { memberId, payload } = await requirePortalMember(`/portal/community/${encodedSlug}/calls`)

  const detail = await getMemberCommunitySpaceDetail(payload, memberId, spaceSlug)
  if (!detail || !detail.allowed) notFound()

  const calls = await listSpaceLiveCalls(payload, detail.id)

  return (
    <div className='mx-auto max-w-4xl space-y-6'>
      <Link
        className='text-sm font-bold text-jpv-sunshine-ink hover:text-jpv-brand-deep'
        href={`/portal/community/${encodedSlug}`}
      >
        ← {detail.name}
      </Link>

      <header className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8'>
        <p className='jpv-eyebrow'>{detail.name}</p>
        <h1 className='mt-2 text-3xl font-semibold tracking-tight text-jpv-ink'>Live Sessions</h1>
        <p className='mt-3 max-w-3xl text-sm leading-6 text-jpv-muted'>
          Upcoming and live calls for this space. Calls are scheduled by administrators.
          Join becomes available when the host opens the room.
        </p>
      </header>

      {calls.length > 0 ? (
        <section className='grid gap-4'>
          {calls.map((call) => {
            const isLive = call.status === 'live'
            return (
              <article
                className={`rounded-xl border bg-white p-5 shadow-sm dark:bg-neutral-900 sm:p-6 ${isLive ? 'border-green-200' : 'border-jpv-border'}`}
                key={call.id}
              >
                <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
                  <div className='min-w-0 flex-1'>
                    <div className='flex flex-wrap items-center gap-2'>
                      <LiveSessionState status={call.status} />
                    </div>
                    <h2 className='mt-2 text-xl font-semibold text-jpv-ink'>{call.title}</h2>
                    <p className='mt-1 text-sm text-jpv-muted'>
                      {isLive ? formatRelative(call.scheduledAt) : formatDate(call.scheduledAt)}
                    </p>
                  </div>
                  <div className='flex shrink-0 items-center'>
                    {call.canJoin ? (
                      <Link
                        className='jpv-button-primary min-h-[52px] rounded-xl px-6 text-base font-semibold'
                        href={`/portal/community/${encodedSlug}/calls/${encodeURIComponent(call.id)}`}
                      >
                        Join call
                      </Link>
                    ) : (
                      <span className='max-w-56 text-sm leading-6 text-jpv-muted'>
                        {liveSessionAvailabilityMessage(call.status)}
                      </span>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </section>
      ) : (
        <section className='rounded-xl border border-dashed border-jpv-border bg-jpv-canvas p-10 text-center sm:p-12'>
          <div className='mx-auto max-w-sm'>
            <p className='text-2xl'>📅</p>
            <h2 className='mt-3 text-base font-semibold text-jpv-ink'>No sessions yet</h2>
            <p className='mt-2 text-sm text-jpv-muted'>
              No calls are scheduled for this space yet. Check back soon — the admin team will post upcoming sessions here.
            </p>
          </div>
        </section>
      )}
    </div>
  )
}
