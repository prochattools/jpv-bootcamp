'use client'

import { FormEvent, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import {
  archiveRoomAction,
  createRoomAction,
  deleteRoomAction,
  setRoomCategoryAction,
  transitionRoomAction,
  updateRoomAction,
} from '@/app/(frontend)/portal/rooms/actions'
import type { RoomInput } from '@/lib/rooms/roomCommands'

type Option = { id: string; label: string; email?: string; memberCount?: number }
type Room = {
  id: string
  title: string
  status: string
  scheduledAt: string
  capacity: number
  audience: string
  categoryIds: string[]
  categoryNames: string[]
  targetMemberIds: string[]
  targetGroupIds: string[]
  archived: boolean
  participantCount: number | null
  updatedAt: string | null
}

type Props = {
  members: Option[]
  groups: Option[]
  categories: Option[]
  rooms: Room[]
}

const inputClass = 'mt-1.5 w-full rounded-jpv-control border border-jpv-border bg-jpv-canvas px-4 py-3 text-sm text-jpv-ink'

function dateLabel(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(date)
}

function audienceLabel(value: string): string {
  if (value === 'all') return 'All active members'
  if (value === 'selected') return 'Selected members'
  if (value === 'groups') return 'Member groups'
  return 'Linked enrolments'
}

export function PortalRoomsAdmin({ members, groups, categories, rooms }: Props) {
  const router = useRouter()
  const [audience, setAudience] = useState<RoomInput['audience']>('all')
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [startNow, setStartNow] = useState(false)
  const [filter, setFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [categoryMessage, setCategoryMessage] = useState<string | null>(null)

  const visibleRooms = useMemo(() => rooms.filter((room) => {
    const matchesText = !filter.trim() || room.title.toLowerCase().includes(filter.trim().toLowerCase()) || room.categoryNames.some((name) => name.toLowerCase().includes(filter.trim().toLowerCase()))
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? !room.archived && ['scheduled', 'live'].includes(room.status) : room.status === statusFilter || (statusFilter === 'archived' && room.archived))
    return matchesText && matchesStatus
  }), [filter, rooms, statusFilter])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setMessage(null)
    const form = new FormData(event.currentTarget)
    const result = await createRoomAction({
      title: String(form.get('title') ?? ''),
      scheduledAt: String(form.get('scheduledAt') ?? ''),
      capacity: String(form.get('capacity') ?? '50'),
      audience: audience ?? 'all',
      targetMemberIds: selectedMembers,
      targetGroupIds: selectedGroups,
      categoryIds: selectedCategories,
      startNow: form.get('startNow') === 'on',
    })
    setPending(false)
    if (!result.ok) {
      setMessage('message' in result ? result.message : 'The request could not be completed.')
      return
    }
    setMessage(result.data.warnings?.length ? `Room created. ${result.data.warnings.join(' ')}` : 'Room created and invitations queued.')
    event.currentTarget.reset()
    setAudience('all')
    setStartNow(false)
    setSelectedMembers([])
    setSelectedGroups([])
    setSelectedCategories([])
    router.refresh()
  }

  async function transition(room: Room, status: 'live' | 'completed' | 'cancelled') {
    setPending(true)
    setMessage(null)
    const result = await transitionRoomAction(room.id, status, room.updatedAt)
    setPending(false)
    setMessage(result.ok ? `Room marked ${status}.` : ('message' in result ? result.message : 'The request could not be completed.'))
    if (result.ok) router.refresh()
  }

  async function archive(room: Room) {
    setPending(true)
    setMessage(null)
    const result = await archiveRoomAction(room.id, room.updatedAt)
    setPending(false)
    setMessage(result.ok ? 'Room archived; its history and access ledger remain available.' : ('message' in result ? result.message : 'The request could not be completed.'))
    if (result.ok) router.refresh()
  }

  async function remove(room: Room) {
    if (!window.confirm(`Delete the scheduled Room “${room.title}”? This is only allowed before invitations or lifecycle activity exist.`)) return
    setPending(true)
    setMessage(null)
    const result = await deleteRoomAction(room.id, true)
    setPending(false)
    setMessage(result.ok ? 'Room deleted.' : ('message' in result ? result.message : 'The request could not be completed.'))
    if (result.ok) router.refresh()
  }

  async function editAudience(room: Room, form: FormData) {
    setPending(true)
    setMessage(null)
    const result = await updateRoomAction(room.id, {
      audience: String(form.get('audience') ?? 'all') as RoomInput['audience'],
      targetMemberIds: form.getAll('targetMemberIds').map(String),
      targetGroupIds: form.getAll('targetGroupIds').map(String),
      expectedUpdatedAt: room.updatedAt,
    })
    setPending(false)
    setMessage(result.ok ? 'Audience saved. New invitations were queued once.' : ('message' in result ? result.message : 'The request could not be completed.'))
    if (result.ok) router.refresh()
  }

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCategoryMessage(null)
    const form = new FormData(event.currentTarget)
    const result = await setRoomCategoryAction('new', { name: String(form.get('name') ?? ''), slug: String(form.get('slug') ?? '') })
    setCategoryMessage(result.ok ? 'Category created.' : ('message' in result ? result.message : 'The request could not be completed.'))
    if (result.ok) {
      event.currentTarget.reset()
      router.refresh()
    }
  }

  const total = rooms.length
  const live = rooms.filter((room) => room.status === 'live' && !room.archived).length
  const scheduled = rooms.filter((room) => room.status === 'scheduled' && !room.archived).length
  const archived = rooms.filter((room) => room.archived).length

  return (
    <section className='space-y-6'>
      <div className='grid gap-3 sm:grid-cols-4'>
        {[
          ['Total Rooms', total],
          ['Live now', live],
          ['Scheduled', scheduled],
          ['Archived', archived],
        ].map(([label, value]) => (
          <div className='rounded-jpv-card border border-jpv-border bg-jpv-canvas p-4 shadow-jpv-card' key={String(label)}>
            <p className='text-xs font-semibold uppercase tracking-[0.14em] text-jpv-muted'>{label}</p>
            <p className='mt-2 text-2xl font-semibold text-jpv-ink'>{value}</p>
          </div>
        ))}
      </div>

      <div className='grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]'>
        <form className='space-y-5 rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8' onSubmit={submit}>
          <div>
            <p className='jpv-eyebrow'>Administrator tools</p>
            <h2 className='mt-2 text-2xl font-semibold text-jpv-ink'>Create a Room</h2>
            <p className='mt-2 text-sm leading-6 text-jpv-muted'>A Room is private by entitlement, realtime by LiveKit, and visible to members only after its audience grant is reconciled.</p>
          </div>
          <div className='grid gap-4 sm:grid-cols-2'>
            <label className='text-sm font-semibold text-jpv-ink sm:col-span-2'>Room title<input className={inputClass} name='title' placeholder='Weekly Q&A' required /></label>
            <label className='text-sm font-semibold text-jpv-ink'>Scheduled start<input className={inputClass} disabled={startNow} name='scheduledAt' required={!startNow} type='datetime-local' /></label>
            <label className='text-sm font-semibold text-jpv-ink'>Capacity<input className={inputClass} defaultValue='50' max='500' min='1' name='capacity' required type='number' /></label>
          </div>
          <label className='flex min-h-11 items-center gap-3 text-sm font-semibold text-jpv-ink'><input checked={startNow} name='startNow' onChange={(event) => setStartNow(event.target.checked)} type='checkbox' /> Start Room immediately after creation</label>
          <div>
            <label className='text-sm font-semibold text-jpv-ink'>Audience<select className={inputClass} onChange={(event) => setAudience(event.target.value as RoomInput['audience'])} value={audience}><option value='all'>All active members</option><option value='selected'>Specific members</option><option value='groups'>One or more member groups</option><option value='enrolled'>Linked course or community space</option></select></label>
            {audience === 'selected' ? <fieldset className='mt-4 rounded-jpv-card border border-jpv-border p-3'><legend className='px-1 text-xs font-semibold uppercase tracking-[0.12em] text-jpv-muted'>Select members</legend><div className='grid max-h-44 gap-2 overflow-y-auto sm:grid-cols-2'>{members.map((member) => <label className='flex items-start gap-2 text-sm text-jpv-ink' key={member.id}><input checked={selectedMembers.includes(member.id)} onChange={() => setSelectedMembers((current) => current.includes(member.id) ? current.filter((id) => id !== member.id) : [...current, member.id])} type='checkbox' /> <span>{member.label}<span className='block text-xs font-normal text-jpv-muted'>{member.email}</span></span></label>)}</div></fieldset> : null}
            {audience === 'groups' ? <fieldset className='mt-4 rounded-jpv-card border border-jpv-border p-3'><legend className='px-1 text-xs font-semibold uppercase tracking-[0.12em] text-jpv-muted'>Select groups</legend><div className='grid gap-2 sm:grid-cols-2'>{groups.map((group) => <label className='flex items-center gap-2 text-sm text-jpv-ink' key={group.id}><input checked={selectedGroups.includes(group.id)} onChange={() => setSelectedGroups((current) => current.includes(group.id) ? current.filter((id) => id !== group.id) : [...current, group.id])} type='checkbox' /><span>{group.label}<span className='ml-1 text-xs text-jpv-muted'>({group.memberCount ?? 0})</span></span></label>)}</div></fieldset> : null}
            {audience === 'enrolled' ? <p className='mt-3 rounded-jpv-card bg-jpv-surface p-3 text-xs leading-5 text-jpv-muted'>Use the linked course or community-space fields in the Payload admin for legacy enrolled Rooms. New member-portal Rooms default to all active members.</p> : null}
          </div>
          <fieldset><legend className='text-sm font-semibold text-jpv-ink'>Categories <span className='font-normal text-jpv-muted'>(optional)</span></legend><div className='mt-2 flex flex-wrap gap-2'>{categories.length ? categories.map((category) => <label className='inline-flex min-h-10 items-center gap-2 rounded-full border border-jpv-border px-3 text-sm text-jpv-ink' key={category.id}><input checked={selectedCategories.includes(category.id)} onChange={() => setSelectedCategories((current) => current.includes(category.id) ? current.filter((id) => id !== category.id) : [...current, category.id])} type='checkbox' />{category.label}</label>) : <span className='text-sm text-jpv-muted'>No categories yet.</span>}</div></fieldset>
          <button className='jpv-button-primary min-h-11' disabled={pending} type='submit'>{pending ? 'Saving…' : 'Create Room'}</button>
          {message ? <p aria-live='polite' className='text-sm text-jpv-muted'>{message}</p> : null}
        </form>

        <aside className='space-y-5 rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8'>
          <div><p className='jpv-eyebrow'>Taxonomy</p><h2 className='mt-2 text-xl font-semibold text-jpv-ink'>Room categories</h2><p className='mt-2 text-sm leading-6 text-jpv-muted'>Categories help admins filter history. They never grant access.</p></div>
          <div className='flex flex-wrap gap-2'>{categories.map((category) => <span className='rounded-full bg-jpv-surface px-3 py-1.5 text-xs font-semibold text-jpv-ink' key={category.id}>{category.label}</span>)}</div>
          <form className='space-y-3 border-t border-jpv-border pt-5' onSubmit={createCategory}><label className='text-sm font-semibold text-jpv-ink'>New category<input className={inputClass} name='name' placeholder='Office hours' required /></label><label className='text-sm font-semibold text-jpv-ink'>Slug <span className='font-normal text-jpv-muted'>(optional)</span><input className={inputClass} name='slug' placeholder='office-hours' /></label><button className='jpv-button-secondary min-h-11' type='submit'>Add category</button>{categoryMessage ? <p aria-live='polite' className='text-xs text-jpv-muted'>{categoryMessage}</p> : null}</form>
        </aside>
      </div>

      <section className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8'>
        <div className='flex flex-col gap-3 border-b border-jpv-border pb-5 sm:flex-row sm:items-end sm:justify-between'><div><p className='jpv-eyebrow'>Room history</p><h2 className='mt-2 text-2xl font-semibold text-jpv-ink'>Manage Rooms</h2></div><div className='flex flex-col gap-2 sm:flex-row'><label className='sr-only' htmlFor='room-search'>Search Rooms</label><input className='rounded-jpv-control border border-jpv-border bg-jpv-canvas px-3 py-2 text-sm text-jpv-ink' id='room-search' onChange={(event) => setFilter(event.target.value)} placeholder='Search title or category' value={filter} /><select aria-label='Filter Rooms' className='rounded-jpv-control border border-jpv-border bg-jpv-canvas px-3 py-2 text-sm text-jpv-ink' onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}><option value='active'>Active</option><option value='all'>All history</option><option value='scheduled'>Scheduled</option><option value='live'>Live</option><option value='completed'>Completed</option><option value='cancelled'>Cancelled</option><option value='archived'>Archived</option></select></div></div>
        <div className='mt-5 space-y-3'>
          {visibleRooms.length ? visibleRooms.map((room) => <article className='rounded-jpv-card border border-jpv-border p-4' key={room.id}><div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'><div className='min-w-0'><div className='flex flex-wrap items-center gap-2'><h3 className='font-semibold text-jpv-ink'>{room.title}</h3><span className='rounded-full bg-jpv-surface px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-jpv-muted'>{room.status}</span>{room.archived ? <span className='rounded-full bg-jpv-surface px-2 py-1 text-[11px] font-semibold text-jpv-muted'>Archived</span> : null}</div><p className='mt-2 text-sm text-jpv-muted'>{dateLabel(room.scheduledAt)} · {audienceLabel(room.audience)} · {room.participantCount === null ? 'Participants unknown' : `${room.participantCount}/${room.capacity} participants`}</p><div className='mt-2 flex flex-wrap gap-1.5'>{room.categoryNames.map((name) => <span className='rounded-full border border-jpv-border px-2 py-1 text-[11px] text-jpv-muted' key={name}>{name}</span>)}</div></div><div className='flex flex-wrap gap-2'>{room.status === 'scheduled' && !room.archived ? <button className='jpv-button-primary min-h-10' disabled={pending} onClick={() => void transition(room, 'live')} type='button'>Start</button> : null}{room.status === 'live' && !room.archived ? <button className='jpv-button-secondary min-h-10' disabled={pending} onClick={() => void transition(room, 'completed')} type='button'>End</button> : null}{room.status === 'scheduled' && !room.archived ? <button className='jpv-button-secondary min-h-10' disabled={pending} onClick={() => void transition(room, 'cancelled')} type='button'>Cancel</button> : null}{!room.archived ? <button className='jpv-button-secondary min-h-10' disabled={pending} onClick={() => void archive(room)} type='button'>Archive</button> : null}{room.status === 'scheduled' && !room.archived ? <button className='jpv-button-secondary min-h-10' disabled={pending} onClick={() => void remove(room)} type='button'>Delete</button> : null}</div></div><details className='mt-4 border-t border-jpv-border pt-3'><summary className='cursor-pointer text-sm font-semibold text-jpv-brand-deep'>Edit audience</summary><form className='mt-3 space-y-3' onSubmit={(event) => { event.preventDefault(); void editAudience(room, new FormData(event.currentTarget)) }}><select className={inputClass} defaultValue={room.audience} name='audience'><option value='all'>All active members</option><option value='selected'>Specific members</option><option value='groups'>Member groups</option><option value='enrolled'>Linked enrolments</option></select><div className='grid gap-2 sm:grid-cols-2'>{members.map((member) => <label className='text-sm text-jpv-ink' key={member.id}><input className='mr-2' defaultChecked={room.targetMemberIds.includes(member.id)} name='targetMemberIds' type='checkbox' value={member.id} />{member.label}</label>)}</div><div className='grid gap-2 sm:grid-cols-2'>{groups.map((group) => <label className='text-sm text-jpv-ink' key={group.id}><input className='mr-2' defaultChecked={room.targetGroupIds.includes(group.id)} name='targetGroupIds' type='checkbox' value={group.id} />{group.label}</label>)}</div><button className='jpv-button-secondary min-h-10' disabled={pending} type='submit'>Save audience</button></form></details></article>) : <p className='rounded-jpv-card border border-dashed border-jpv-border p-6 text-sm text-jpv-muted'>No Rooms match this view.</p>}
        </div>
      </section>
    </section>
  )
}
