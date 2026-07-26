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

function statusClass(status: string): string {
  return status === 'live'
    ? 'bg-emerald-50 text-emerald-700'
    : status === 'scheduled'
      ? 'bg-jpv-surface text-jpv-ink'
      : 'bg-jpv-surface-strong text-jpv-muted'
}

export default async function PortalLiveSessionsPage() {
  const { memberId, payload } = await requirePortalMember('/portal/live-sessions')
  const sessions = await listMemberLiveSessions(payload, memberId)

  return (
    <div className='space-y-6'>
      <header className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8'>
        <p className='jpv-eyebrow'>Live learning</p>
        <h1 className='mt-2 text-3xl font-semibold tracking-tight text-jpv-ink'>Live sessions</h1>
        <p className='mt-3 max-w-3xl text-sm leading-6 text-jpv-muted'>
          Sessions appear only for courses in which you have an active enrollment. Join becomes available when the host starts the session.
        </p>
      </header>

      {sessions.length > 0 ? (
        <section className='grid gap-4'>
          {sessions.map((session) => (
            <article className='rounded-jpv-card border border-jpv-border bg-jpv-canvas p-5 shadow-jpv-card sm:p-6' key={session.id}>
              <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
                <div className='min-w-0'>
                  <p className='jpv-eyebrow'>{session.courseTitle}</p>
                  <h2 className='mt-2 text-xl font-semibold text-jpv-ink'>{session.title}</h2>
                  <p className='mt-2 text-sm text-jpv-muted'>{formatDate(session.scheduledAt)}</p>
                  <p className={`mt-3 inline-flex rounded-jpv-pill px-3 py-1 text-xs font-semibold ${statusClass(session.status)}`}>
                    {statusLabel(session.status)}
                  </p>
                </div>
                {session.canJoin ? (
                  <Link
                    className='jpv-button-primary min-h-11 shrink-0'
                    href={`/courses/${session.courseId}/sessions/${session.id}/join`}
                  >
                    Join session
                  </Link>
                ) : (
                  <span className='text-sm text-jpv-muted'>
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
        <section className='rounded-jpv-card border border-dashed border-jpv-border bg-jpv-canvas p-6 text-sm text-jpv-muted sm:p-8'>
          No live sessions are available for your enrolled courses.
        </section>
      )}
    </div>
  )
}
