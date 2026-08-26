import Link from 'next/link'
import { notFound } from 'next/navigation'

import { requirePortalMember } from '@/lib/auth/requirePortalMember'
import { getMemberCommunitySpaceDetail } from '@/lib/payloadCourse/communityPortal'
import {
  isValidLiveSessionRoomName,
  liveSessionRelationshipId,
} from '@/lib/liveSessions/sessionLifecycle'
import LiveCallRoom from '@/components/portal/LiveCallRoom'
import { LiveSessionState } from '@/components/portal/LiveSessionState'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ spaceSlug: string; sessionId: string }>
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const s = value.trim()
  return s || null
}

export default async function JoinCallPage({ params }: PageProps) {
  const { spaceSlug, sessionId } = await params
  const encodedSlug = encodeURIComponent(spaceSlug)
  const { memberId, payload } = await requirePortalMember(
    `/portal/community/${encodedSlug}/calls/${encodeURIComponent(sessionId)}`
  )

  // Verify member has access to this space
  const detail = await getMemberCommunitySpaceDetail(payload, memberId, spaceSlug)
  if (!detail || !detail.allowed) notFound()

  // Load the live session and verify it belongs to this space
  const sessionResult = await payload.find({
    collection: 'live_sessions',
    where: {
      and: [
        { id: { equals: sessionId } },
        { space: { equals: detail.id } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const session = sessionResult.docs[0]
  if (!session) notFound()

  const sessionTitle = asString(session.title) ?? 'Group call'
  const sessionStatus = asString(session.status)
  const scheduledAt = asString(session.scheduledAt)
  const isLive = sessionStatus === 'live'
  const isClosed = sessionStatus === 'completed' || sessionStatus === 'cancelled'
  const roomReady = isValidLiveSessionRoomName(session.roomName)

  function formatDate(value: string | null): string {
    if (!value) return 'TBD'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'TBD'
    return new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(date)
  }

  return (
    <div className='mx-auto max-w-4xl space-y-6'>
      <Link
        className='text-sm font-bold text-jpv-sunshine-ink hover:text-jpv-brand-deep'
        href={`/portal/community/${encodedSlug}/calls`}
      >
        ← Calls
      </Link>

      <header className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8'>
        <p className='jpv-eyebrow'>{detail.name}</p>
        <h1 className='mt-2 text-3xl font-semibold tracking-tight text-jpv-ink'>{sessionTitle}</h1>
        <p className='mt-3 text-sm text-jpv-muted'>
          {formatDate(scheduledAt)}
        </p>
        <div className='mt-3'><LiveSessionState status={sessionStatus} /></div>
      </header>

      {isClosed ? (
        <section className='rounded-xl border border-jpv-border bg-jpv-canvas p-6 text-center sm:p-8'>
          <p className='text-2xl'>🎬</p>
          <h2 className='mt-3 text-base font-semibold text-jpv-ink'>This call has ended</h2>
          <p className='mt-2 text-sm text-jpv-muted'>The session is no longer available to join.</p>
          <div className='mt-5'>
            <Link
              className='jpv-button-secondary'
              href={`/portal/community/${encodedSlug}/calls`}
            >
              Back to sessions
            </Link>
          </div>
        </section>
      ) : !isLive ? (
        <section className='rounded-xl border border-jpv-border bg-jpv-canvas p-6 text-center sm:p-8'>
          <p className='text-2xl'>⏳</p>
          <h2 className='mt-3 text-base font-semibold text-jpv-ink'>Not started yet</h2>
          <p className='mt-2 text-sm text-jpv-muted'>
            The host has not opened this room yet. Come back when the call goes live.
          </p>
          <div className='mt-5'>
            <Link className='jpv-button-secondary' href={`/portal/community/${encodedSlug}/calls`}>
              Back to sessions
            </Link>
          </div>
        </section>
      ) : !roomReady ? (
        <section className='rounded-xl border border-jpv-border bg-jpv-canvas p-6 text-center sm:p-8'>
          <h2 className='font-semibold text-jpv-ink'>Room temporarily unavailable</h2>
          <p className='mt-2 text-sm text-jpv-muted'>The session is live, but the room cannot be opened. Contact support if this continues.</p>
          <div className='mt-5'>
            <Link className='jpv-button-secondary' href={`/portal/community/${encodedSlug}/calls`}>
              Back to sessions
            </Link>
          </div>
        </section>
      ) : (
        <section className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8'>
          <LiveCallRoom sessionId={sessionId} sessionTitle={sessionTitle} />
        </section>
      )}
    </div>
  )
}
