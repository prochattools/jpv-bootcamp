import Link from 'next/link'
import { notFound } from 'next/navigation'

import LiveCallRoom from '@/components/portal/LiveCallRoom'
import { LiveSessionState } from '@/components/portal/LiveSessionState'
import { requirePortalAccess } from '@/lib/auth/requirePortalAccess'
import { listMemberLiveSessions } from '@/lib/liveSessions/memberSessions'
import {
  isValidLiveSessionRoomName,
  liveSessionRelationshipId,
} from '@/lib/liveSessions/sessionLifecycle'
import type { PayloadDocument } from '@/lib/payloadCourse/accessService'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ sessionId: string }>
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized || null
}

function formatDate(value: string | null): string {
  if (!value) return 'TBD'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'TBD'
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(date)
}

export default async function PortalLiveSessionPage({ params }: PageProps) {
  const { sessionId } = await params
  const { actor, payload } = await requirePortalAccess(`/portal/live-sessions/${encodeURIComponent(sessionId)}`)

  let session: PayloadDocument | null = null
  if (actor.kind === 'member') {
    const sessions = await listMemberLiveSessions(payload, actor.memberId)
    const summary = sessions.find((candidate) => candidate.id === sessionId)
    if (!summary) notFound()
    session = await payload.findByID({
      collection: 'live_sessions',
      id: sessionId,
      depth: 1,
      overrideAccess: true,
    }).catch((): null => null) as PayloadDocument | null
  } else {
    session = await payload.findByID({
      collection: 'live_sessions',
      id: sessionId,
      depth: 1,
      overrideAccess: true,
    }).catch((): null => null) as PayloadDocument | null
    if (!session || liveSessionRelationshipId(session.hostUser) !== actor.administratorId) notFound()
  }

  if (!session) notFound()

  const title = asString(session.title) ?? 'Live session'
  const status = asString(session.status)
  const scheduledAt = asString(session.scheduledAt)
  const roomReady = isValidLiveSessionRoomName(session.roomName)
  const isLive = status === 'live'
  const isClosed = status === 'completed' || status === 'cancelled'

  return (
    <div className='mx-auto max-w-5xl space-y-6'>
      <Link className='text-sm font-bold text-jpv-sunshine-ink hover:text-jpv-brand-deep' href='/portal/live-sessions'>
        ← Live sessions
      </Link>

      <header className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8'>
        <p className='jpv-eyebrow'>Live learning</p>
        <h1 className='mt-2 text-3xl font-semibold tracking-tight text-jpv-ink'>{title}</h1>
        <p className='mt-3 text-sm text-jpv-muted'>{formatDate(scheduledAt)}</p>
        <div className='mt-3'><LiveSessionState status={status} /></div>
      </header>

      {isClosed ? (
        <section className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 text-center shadow-jpv-card sm:p-8'>
          <h2 className='font-semibold text-jpv-ink'>This session has ended</h2>
          <p className='mt-2 text-sm text-jpv-muted'>The session is no longer available to join.</p>
        </section>
      ) : !isLive ? (
        <section className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 text-center shadow-jpv-card sm:p-8'>
          <h2 className='font-semibold text-jpv-ink'>Not started yet</h2>
          <p className='mt-2 text-sm text-jpv-muted'>The host has not opened this room yet. Come back when the session goes live.</p>
        </section>
      ) : !roomReady ? (
        <section className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 text-center shadow-jpv-card sm:p-8'>
          <h2 className='font-semibold text-jpv-ink'>Room temporarily unavailable</h2>
          <p className='mt-2 text-sm text-jpv-muted'>The session is live, but the room cannot be opened. Contact support if this continues.</p>
        </section>
      ) : (
        <section className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-4 shadow-jpv-card sm:p-6'>
          <LiveCallRoom sessionId={sessionId} sessionTitle={title} />
        </section>
      )}
    </div>
  )
}
