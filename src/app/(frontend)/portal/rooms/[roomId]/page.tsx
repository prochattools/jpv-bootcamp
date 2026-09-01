import Link from 'next/link'
import { notFound } from 'next/navigation'

import LiveCallRoom from '@/components/portal/LiveCallRoom'
import { LiveSessionState } from '@/components/portal/LiveSessionState'
import { requirePortalAccess } from '@/lib/auth/requirePortalAccess'
import { findMemberRoom, roomSummary } from '@/lib/rooms/roomQueries'
import { getRoomParticipantCount } from '@/lib/rooms/participantCount'
import { liveSessionRelationshipId, isValidLiveSessionRoomName } from '@/lib/liveSessions/sessionLifecycle'
import type { PayloadDocument } from '@/lib/payloadCourse/accessService'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type PageProps = { params: Promise<{ roomId: string }> }

function dateLabel(value: unknown): string {
  const date = new Date(String(value ?? ''))
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeStyle: 'short' }).format(date)
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export default async function PortalRoomPage({ params }: PageProps) {
  const { roomId } = await params
  const { actor, payload } = await requirePortalAccess(`/portal/rooms/${encodeURIComponent(roomId)}`)
  let room: PayloadDocument | null = null
  if (actor.kind === 'member') {
    const entitled = await findMemberRoom(payload, roomId, actor.memberId)
    if (!entitled) notFound()
    room = entitled.document
  } else {
    const ownedRoom = await payload.findByID({ collection: 'live_sessions', id: roomId, depth: 1, overrideAccess: true }).catch((): null => null) as PayloadDocument | null
    if (!ownedRoom) notFound()
    if (liveSessionRelationshipId(ownedRoom.hostUser) === actor.administratorId) {
      room = ownedRoom
    } else {
      if (!actor.memberId) notFound()
      const entitled = await findMemberRoom(payload, roomId, actor.memberId)
      if (!entitled) notFound()
      room = entitled.document
    }
  }
  if (!room) notFound()

  const title = text(room.title) ?? 'Room'
  const status = text(room.status)
  const isArchived = room.archived === true
  const roomReady = isValidLiveSessionRoomName(room.roomName)
  const participantCount = status === 'live' && roomReady && typeof room.roomName === 'string' ? await getRoomParticipantCount(room.roomName) : null
  const summary = roomSummary(room, participantCount)
  const isClosed = status === 'completed' || status === 'cancelled'

  return (
    <div className='mx-auto max-w-5xl space-y-6'>
      <Link className='text-sm font-bold text-jpv-sunshine-ink hover:text-jpv-brand-deep' href='/portal/rooms'>← Rooms</Link>
      <header className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8'><p className='jpv-eyebrow'>Live learning</p><h1 className='mt-2 text-3xl font-semibold tracking-tight text-jpv-ink'>{title}</h1><p className='mt-3 text-sm text-jpv-muted'>{dateLabel(room.scheduledAt)}{summary?.participantCount === null ? ' · Participants unknown' : ` · ${summary?.participantCount ?? 0} participants`}</p><div className='mt-3'><LiveSessionState status={status} /></div></header>
      {isArchived ? <section className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 text-center shadow-jpv-card sm:p-8'><h2 className='font-semibold text-jpv-ink'>This Room is archived</h2><p className='mt-2 text-sm text-jpv-muted'>Its history is retained, but the Room is no longer available to join.</p></section> : isClosed ? <section className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 text-center shadow-jpv-card sm:p-8'><h2 className='font-semibold text-jpv-ink'>This Room has ended</h2><p className='mt-2 text-sm text-jpv-muted'>The Room is no longer available to join.</p></section> : status !== 'live' ? <section className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 text-center shadow-jpv-card sm:p-8'><h2 className='font-semibold text-jpv-ink'>Not started yet</h2><p className='mt-2 text-sm text-jpv-muted'>The host has not opened this Room yet. Come back when it goes live.</p></section> : !roomReady ? <section className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 text-center shadow-jpv-card sm:p-8'><h2 className='font-semibold text-jpv-ink'>Room temporarily unavailable</h2><p className='mt-2 text-sm text-jpv-muted'>The Room is live, but its realtime connection is unavailable. Contact support if this continues.</p></section> : <section className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-4 shadow-jpv-card sm:p-6'><LiveCallRoom sessionId={roomId} sessionTitle={title} /></section>}
    </div>
  )
}
