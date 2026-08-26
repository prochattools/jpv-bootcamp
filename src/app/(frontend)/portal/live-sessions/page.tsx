import Link from 'next/link'

import { LiveSessionState, liveSessionAvailabilityMessage } from '@/components/portal/LiveSessionState'
import { PortalLiveSessionAdmin } from '@/components/portal/PortalLiveSessionAdmin'
import { requirePortalAccess } from '@/lib/auth/requirePortalAccess'
import { listMemberLiveSessions } from '@/lib/liveSessions/memberSessions'
import type { PayloadDocument } from '@/lib/payloadCourse/accessService'

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(date)
}

export default async function PortalLiveSessionsPage() {
  const { actor, payload } = await requirePortalAccess('/portal/live-sessions')
  if (actor.kind === 'admin') {
    const [courses, spaces, members, sessions] = await Promise.all([
      payload.find({ collection: 'payload_courses', where: { status: { equals: 'published' } }, limit: 500, depth: 0, overrideAccess: true }),
      payload.find({ collection: 'payload_spaces', where: { status: { equals: 'published' } }, limit: 500, depth: 0, overrideAccess: true }),
      payload.find({ collection: 'payload_members', where: { accountStatus: { equals: 'active' } }, limit: 500, depth: 0, overrideAccess: true }),
      payload.find({ collection: 'live_sessions', limit: 200, sort: '-scheduledAt', depth: 1, overrideAccess: true }),
    ])
    const optionLabel = (document: PayloadDocument, fallback: string) => String(document.title ?? document.name ?? fallback)
    return (
      <div className='space-y-6'>
        <header className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8'>
          <p className='jpv-eyebrow'>Live learning</p>
          <h1 className='mt-2 text-3xl font-semibold tracking-tight text-jpv-ink'>Live sessions</h1>
          <p className='mt-3 max-w-3xl text-sm leading-6 text-jpv-muted'>Create, invite, start, and end LiveKit sessions without leaving the member portal.</p>
        </header>
        <PortalLiveSessionAdmin
          courses={courses.docs.map((course) => ({ id: String(course.id), label: optionLabel(course, 'Course') }))}
          members={members.docs.map((member) => ({ id: String(member.id), label: optionLabel(member, String(member.email ?? 'Member')), email: String(member.email ?? '') }))}
          sessions={sessions.docs.map((session) => ({ id: String(session.id), title: String(session.title ?? ''), status: String(session.status ?? ''), scheduledAt: String(session.scheduledAt ?? ''), audience: String(session.audience ?? '') }))}
          spaces={spaces.docs.map((space) => ({ id: String(space.id), label: optionLabel(space, 'Community space') }))}
        />
      </div>
    )
  }

  const sessions = await listMemberLiveSessions(payload, actor.memberId)

  return (
    <div className='space-y-6'>
      <header className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8'>
        <p className='jpv-eyebrow'>Live learning</p>
        <h1 className='mt-2 text-3xl font-semibold tracking-tight text-jpv-ink'>Live sessions</h1>
        <p className='mt-3 max-w-3xl text-sm leading-6 text-jpv-muted'>
          Sessions you are invited to or are eligible for appear here. Join becomes available when the host starts the session.
        </p>
      </header>

      {sessions.length > 0 ? (
        <section className='grid gap-4'>
          {sessions.map((session) => (
            <article className='rounded-jpv-card border border-jpv-border bg-jpv-canvas p-5 shadow-jpv-card sm:p-6' id={`session-${session.id}`} key={session.id}>
              <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
                <div className='min-w-0'>
                  <p className='jpv-eyebrow'>{session.courseTitle}{session.spaceTitle ? ` · ${session.spaceTitle}` : ''}</p>
                  <h2 className='mt-2 text-xl font-semibold text-jpv-ink'>{session.title}</h2>
                  <p className='mt-2 text-sm text-jpv-muted'>{formatDate(session.scheduledAt)}</p>
                  <div className='mt-3'><LiveSessionState status={session.status} /></div>
                </div>
                {session.canJoin ? (
                  <Link
                    className='jpv-button-primary min-h-11 shrink-0'
                    href={session.courseId
                      ? `/courses/${session.courseId}/sessions/${session.id}/join`
                      : session.spaceSlug
                        ? `/portal/community/${encodeURIComponent(session.spaceSlug)}/calls/${session.id}`
                        : '/portal/live-sessions'}
                  >
                    Join session
                  </Link>
                ) : (
                  <span className='max-w-56 text-sm leading-6 text-jpv-muted'>
                    {liveSessionAvailabilityMessage(session.status, session.roomReady)}
                  </span>
                )}
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className='rounded-jpv-card border border-dashed border-jpv-border bg-jpv-canvas p-6 text-sm text-jpv-muted sm:p-8'>
          <h2 className='font-semibold text-jpv-ink'>No sessions available</h2>
          <p className='mt-2'>New sessions you are invited to or eligible for will appear here when they are scheduled.</p>
        </section>
      )}
    </div>
  )
}
