import Link from 'next/link'

import { AdminGate } from '@/components/portal/AdminGate'
import { LiveSessionState } from '@/components/portal/LiveSessionState'
import { PortalRoomsAdmin } from '@/components/portal/PortalRoomsAdmin'
import { requirePortalAccess } from '@/lib/auth/requirePortalAccess'
import { listAdminRooms, listMemberRooms, roomSummary } from '@/lib/rooms/roomQueries'
import { getRoomParticipantCount } from '@/lib/rooms/participantCount'
import { liveSessionRelationshipId } from '@/lib/liveSessions/sessionLifecycle'
import type { PayloadDocument } from '@/lib/payloadCourse/accessService'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function dateLabel(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeStyle: 'short' }).format(date)
}

export default async function PortalRoomsPage() {
  const { actor, payload } = await requirePortalAccess('/portal/rooms')

  if (actor.kind === 'admin') {
    const [members, groups, categories, documents] = await Promise.all([
      payload.find({ collection: 'payload_members', where: { accountStatus: { equals: 'active' } }, limit: 1000, depth: 0, overrideAccess: true }),
      payload.find({ collection: 'payload_member_groups', where: { status: { equals: 'active' } }, limit: 500, depth: 1, overrideAccess: true }),
      payload.find({ collection: 'payload_room_categories', where: { status: { equals: 'active' } }, limit: 500, sort: 'sortOrder', depth: 0, overrideAccess: true }),
      listAdminRooms(payload),
    ])
    const rooms = await Promise.all(documents.map(async (document) => {
      const summary = roomSummary(document, document.status === 'live' && typeof document.roomName === 'string' ? await getRoomParticipantCount(document.roomName) : null)
      return summary ? {
        ...summary,
        categoryIds: (Array.isArray(document.categories) ? document.categories : []).map(liveSessionRelationshipId).filter((id): id is string => Boolean(id)),
        categoryNames: summary.categories,
        targetMemberIds: (Array.isArray(document.targetMemberIds) ? document.targetMemberIds : []).map(liveSessionRelationshipId).filter((id): id is string => Boolean(id)),
        targetGroupIds: (Array.isArray(document.targetGroupIds) ? document.targetGroupIds : []).map(liveSessionRelationshipId).filter((id): id is string => Boolean(id)),
      } : null
    })).then((items) => items.filter((item): item is NonNullable<typeof item> => Boolean(item)))

    return (
      <div className='space-y-6'>
        <header className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8'>
          <p className='jpv-eyebrow'>Live learning</p>
          <h1 className='mt-2 text-3xl font-semibold tracking-tight text-jpv-ink'>Rooms</h1>
          <p className='mt-3 max-w-3xl text-sm leading-6 text-jpv-muted'>Create and operate private member Rooms with clear audience grants, LiveKit video, and realtime chat.</p>
        </header>
        <AdminGate>
          <PortalRoomsAdmin
            categories={categories.docs.map((category) => ({ id: String(category.id), label: String(category.name ?? category.slug ?? 'Category') }))}
            groups={groups.docs.map((group) => ({ id: String(group.id), label: String(group.name ?? 'Member group'), memberCount: Array.isArray(group.members) ? group.members.length : 0 }))}
            members={members.docs.map((member) => ({ id: String(member.id), label: String(member.displayName ?? member.name ?? member.email ?? 'Member'), email: String(member.email ?? '') }))}
            rooms={rooms}
          />
        </AdminGate>
      </div>
    )
  }

  const rooms = await listMemberRooms(payload, actor.memberId)
  return (
    <div className='space-y-6'>
      <header className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8'>
        <p className='jpv-eyebrow'>Live learning</p>
        <h1 className='mt-2 text-3xl font-semibold tracking-tight text-jpv-ink'>Rooms</h1>
        <p className='mt-3 max-w-3xl text-sm leading-6 text-jpv-muted'>Rooms you are invited to appear here. Join becomes available when the host starts the Room.</p>
      </header>
      {rooms.length ? <section className='grid gap-4'>{rooms.map((room) => <article className='rounded-jpv-card border border-jpv-border bg-jpv-canvas p-5 shadow-jpv-card sm:p-6' key={room.id}><div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'><div className='min-w-0'><p className='jpv-eyebrow'>{room.courseTitle ?? room.spaceTitle ?? 'Member Room'}</p><h2 className='mt-2 text-xl font-semibold text-jpv-ink'>{room.title}</h2><p className='mt-2 text-sm text-jpv-muted'>{dateLabel(room.scheduledAt)}{room.categories.length ? ` · ${room.categories.join(' · ')}` : ''}</p><div className='mt-3'><LiveSessionState status={room.status} /></div></div>{room.canJoin ? <Link className='jpv-button-primary min-h-11 shrink-0' href={`/portal/rooms/${encodeURIComponent(room.id)}`}>Join Room</Link> : <span className='max-w-56 text-sm leading-6 text-jpv-muted'>{room.status === 'scheduled' ? 'The host has not opened this Room yet.' : 'This Room is not currently available.'}</span>}</div></article>)}</section> : <section className='rounded-jpv-card border border-dashed border-jpv-border bg-jpv-canvas p-6 text-sm text-jpv-muted sm:p-8'><h2 className='font-semibold text-jpv-ink'>No Rooms available</h2><p className='mt-2'>Rooms you are invited to or become eligible for will appear here when scheduled.</p></section>}
    </div>
  )
}
