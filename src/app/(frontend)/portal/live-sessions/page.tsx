import Link from 'next/link'

import { requirePortalMember } from '@/lib/auth/requirePortalMember'
import { listMemberLiveSessions } from '@/lib/liveSessions/memberSessions'

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(date)
}

function statusLabel(status: string): string {
  return status === 'live'
    ? 'Live now'
    : status === 'scheduled'
      ? 'Scheduled'
      : status === 'completed'
        ? 'Completed'
        : 'Cancelled'
}

export default async function PortalLiveSessionsPage() {
  const { memberId, payload } = await requirePortalMember('/portal/live-sessions')
  const sessions = await listMemberLiveSessions(payload, memberId)

  return (
    <div className='space-y-8'>
      <header className='rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm'>
        <p className='text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500'>Live learning</p>
        <h1 className='mt-3 text-3xl font-semibold tracking-tight'>Live sessions</h1>
        <p className='mt-4 max-w-3xl text-sm leading-6 text-neutral-600'>
          Sessions appear only for courses in which you have an active enrollment. Join becomes available when the host starts the session.
        </p>
      </header>

      {sessions.length > 0 ? (
        <section className='grid gap-4'>
          {sessions.map((session) => (
            <article className='rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm' key={session.id}>
              <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
                <div>
                  <p className='text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500'>{session.courseTitle}</p>
                  <h2 className='mt-2 text-xl font-semibold'>{session.title}</h2>
                  <p className='mt-2 text-sm text-neutral-600'>{formatDate(session.scheduledAt)}</p>
                  <p className='mt-3 inline-flex rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700'>
                    {statusLabel(session.status)}
                  </p>
                </div>
                {session.canJoin ? (
                  <Link
                    className='inline-flex rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white'
                    href={`/courses/${session.courseId}/sessions/${session.id}/join`}
                  >
                    Join session
                  </Link>
                ) : (
                  <span className='text-sm text-neutral-500'>
                    {session.status === 'scheduled'
                      ? 'Waiting for host'
                      : session.status === 'live' && !session.roomReady
                        ? 'Room unavailable'
                        : 'Joining closed'}
                  </span>
                )}
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className='rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-sm text-neutral-600'>
          No live sessions are available for your enrolled courses.
        </section>
      )}
    </div>
  )
}
