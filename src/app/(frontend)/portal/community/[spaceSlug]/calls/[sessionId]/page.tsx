import Link from 'next/link'
import { notFound } from 'next/navigation'

import { requirePortalMember } from '@/lib/auth/requirePortalMember'
import { getMemberCommunitySpaceDetail } from '@/lib/payloadCourse/communityPortal'
import {
  isValidLiveSessionRoomName,
  liveSessionRelationshipId,
} from '@/lib/liveSessions/sessionLifecycle'
import LiveCallRoom from '@/components/portal/LiveCallRoom'

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
    <div className='space-y-6'>
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
        {isLive && (
          <p className='mt-3 inline-flex rounded-jpv-pill bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700'>
            Live now
          </p>
        )}
        {!isLive && sessionStatus === 'scheduled' && (
          <p className='mt-3 inline-flex rounded-jpv-pill bg-jpv-surface px-3 py-1 text-xs font-semibold text-jpv-ink'>
            Scheduled
          </p>
        )}
      </header>

      {isClosed ? (
        <section className='rounded-jpv-card border border-jpv-border bg-jpv-canvas p-6'>
          <p className='text-sm text-jpv-muted'>This call has ended.</p>
        </section>
      ) : !isLive ? (
        <section className='rounded-jpv-card border border-jpv-border bg-jpv-canvas p-6'>
          <h2 className='text-lg font-semibold text-jpv-ink'>Not started yet</h2>
          <p className='mt-2 text-sm text-jpv-muted'>
            The host has not opened this room yet. Come back when the call goes live.
          </p>
        </section>
      ) : !roomReady ? (
        <section className='rounded-jpv-card border border-jpv-border bg-jpv-canvas p-6'>
          <p className='text-sm text-jpv-muted'>Room configuration is unavailable. Contact support.</p>
        </section>
      ) : (
        <section className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8'>
          <h2 className='mb-5 text-xl font-semibold text-jpv-ink'>Join call</h2>
          <LiveCallRoom sessionId={sessionId} sessionTitle={sessionTitle} />
        </section>
      )}
    </div>
  )
}
