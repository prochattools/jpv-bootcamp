'use client'

import { FormEvent, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import {
  archiveRoomAction,
  createRoomAction,
  deleteRoomCategoryAction,
  deleteRoomAction,
  setRoomCategoryAction,
  transitionRoomAction,
  updateRoomAction,
} from '@/app/(frontend)/portal/rooms/actions'
import type { RoomInput } from '@/lib/rooms/roomCommands'

type Option = { id: string; label: string; email?: string; isAdministrator?: boolean; memberCount?: number; status?: 'active' | 'archived'; description?: string | null }
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
  allCategories: Option[]
  rooms: Room[]
}

const inputClass = 'mt-1.5 w-full rounded-jpv-control border border-jpv-border bg-jpv-canvas px-4 py-3 text-sm text-jpv-ink'

function dateLabel(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(date)
}

function audienceLabel(value: string): string {
  if (value === 'all') return 'All active members and administrators'
  if (value === 'selected') return 'Selected members'
  if (value === 'groups') return 'Member groups'
  return 'Linked enrolments'
}

export function PortalRoomsAdmin({ members, groups, categories, allCategories, rooms }: Props) {
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
  const [categoryPending, setCategoryPending] = useState(false)
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [categoryName, setCategoryName] = useState('')
  const [categoryDescription, setCategoryDescription] = useState('')
  const [categoryStatus, setCategoryStatus] = useState<'active' | 'archived'>('active')

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
    setCategoryPending(true)
    const result = await setRoomCategoryAction(editingCategoryId ?? 'new', {
      name: String(form.get('name') ?? ''),
      description: String(form.get('description') ?? ''),
      status: String(form.get('status') ?? 'active') as 'active' | 'archived',
    })
    setCategoryPending(false)
    setCategoryMessage(result.ok ? 'Category created.' : ('message' in result ? result.message : 'The request could not be completed.'))
    if (result.ok) {
      event.currentTarget.reset()
      setEditingCategoryId(null)
      setCategoryName('')
      setCategoryDescription('')
      setCategoryStatus('active')
      setCategoryMessage(editingCategoryId ? 'Category updated.' : 'Category created.')
      router.refresh()
    }
  }

  function editCategory(category: Option) {
    setEditingCategoryId(category.id)
    setCategoryName(category.label)
    setCategoryDescription(category.description ?? '')
    setCategoryStatus(category.status ?? 'active')
    setCategoryMessage(null)
  }

  async function archiveCategory(category: Option) {
    setCategoryPending(true)
    setCategoryMessage(null)
    const result = await setRoomCategoryAction(category.id, { name: category.label, description: category.description ?? '', status: 'archived' })
    setCategoryPending(false)
    setCategoryMessage(result.ok ? 'Category archived.' : ('message' in result ? result.message : 'The request could not be completed.'))
    if (result.ok) router.refresh()
  }

  async function deleteCategory(category: Option) {
    if (!window.confirm(`Delete “${category.label}”? Categories assigned to Rooms must be archived instead.`)) return
    setCategoryPending(true)
    setCategoryMessage(null)
    const result = await deleteRoomCategoryAction(category.id, true)
    setCategoryPending(false)
    setCategoryMessage(result.ok ? 'Category deleted.' : ('message' in result ? result.message : 'The request could not be completed.'))
    if (result.ok) router.refresh()
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
            <label className='text-sm font-semibold text-jpv-ink'>Audience<select className={inputClass} onChange={(event) => setAudience(event.target.value as RoomInput['audience'])} value={audience}><option value='all'>All active members and administrators</option><option value='selected'>Specific members</option><option value='groups'>One or more member groups</option><option value='enrolled'>Linked course or community space</option></select></label>
            {audience === 'selected' ? <fieldset className='mt-4 rounded-jpv-card border border-jpv-border p-3'><legend className='px-1 text-xs font-semibold uppercase tracking-[0.12em] text-jpv-muted'>Select members</legend><div className='grid max-h-44 gap-2 overflow-y-auto sm:grid-cols-2'>{members.map((member) => <label className='flex items-start gap-2 text-sm text-jpv-ink' key={member.id}><input checked={selectedMembers.includes(member.id)} onChange={() => setSelectedMembers((current) => current.includes(member.id) ? current.filter((id) => id !== member.id) : [...current, member.id])} type='checkbox' /> <span className='min-w-0'><span className='flex flex-wrap items-center gap-1.5'><span>{member.label}</span>{member.isAdministrator ? <span className='rounded-full bg-jpv-surface px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-jpv-brand-deep'>Admin</span> : null}</span>{member.email ? <span className='block truncate text-xs font-normal text-jpv-muted'>{member.email}</span> : null}</span></label>)}</div></fieldset> : null}
            {audience === 'groups' ? <fieldset className='mt-4 rounded-jpv-card border border-jpv-border p-3'><legend className='px-1 text-xs font-semibold uppercase tracking-[0.12em] text-jpv-muted'>Select groups</legend><div className='grid gap-2 sm:grid-cols-2'>{groups.map((group) => <label className='flex items-center gap-2 text-sm text-jpv-ink' key={group.id}><input checked={selectedGroups.includes(group.id)} onChange={() => setSelectedGroups((current) => current.includes(group.id) ? current.filter((id) => id !== group.id) : [...current, group.id])} type='checkbox' /><span>{group.label}<span className='ml-1 text-xs text-jpv-muted'>({group.memberCount ?? 0})</span></span></label>)}</div></fieldset> : null}
            {audience === 'enrolled' ? <p className='mt-3 rounded-jpv-card bg-jpv-surface p-3 text-xs leading-5 text-jpv-muted'>Use the linked course or community-space fields in the Payload admin for legacy enrolled Rooms. New member-portal Rooms default to all active members.</p> : null}
          </div>
          <fieldset><legend className='text-sm font-semibold text-jpv-ink'>Categories <span className='font-normal text-jpv-muted'>(optional)</span></legend><div className='mt-2 flex flex-wrap gap-2'>{categories.length ? categories.map((category) => <label className='inline-flex min-h-10 items-center gap-2 rounded-full border border-jpv-border px-3 text-sm text-jpv-ink' key={category.id}><input checked={selectedCategories.includes(category.id)} onChange={() => setSelectedCategories((current) => current.includes(category.id) ? current.filter((id) => id !== category.id) : [...current, category.id])} type='checkbox' />{category.label}</label>) : <span className='text-sm text-jpv-muted'>No categories yet.</span>}</div></fieldset>
          <button className='jpv-button-primary min-h-11' disabled={pending} type='submit'>{pending ? 'Saving…' : 'Create Room'}</button>
          {message ? <p aria-live='polite' className='text-sm text-jpv-muted'>{message}</p> : null}
        </form>

        <aside className='space-y-5 rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8'>
          <div>
            <p className='jpv-eyebrow'>Taxonomy</p>
            <h2 className='mt-2 text-xl font-semibold text-jpv-ink'>Room categories</h2>
            <p className='mt-2 text-sm leading-6 text-jpv-muted'>Categories help admins filter history. They never grant access.</p>
          </div>
          <div className='max-h-64 space-y-2 overflow-y-auto'>
            {allCategories.length ? allCategories.map((category) => <div className='rounded-jpv-card border border-jpv-border bg-jpv-surface p-3' key={category.id}>
              <div className='flex items-start justify-between gap-2'>
                <div className='min-w-0'>
                  <p className='font-semibold text-jpv-ink'>{category.label}</p>
                  <p className='mt-1 text-xs text-jpv-muted'>{category.status === 'archived' ? 'Archived' : 'Active'}{category.description ? ` · ${category.description}` : ''}</p>
                </div>
                <div className='flex shrink-0 gap-1'>
                  <button className='text-xs font-semibold text-jpv-brand-deep underline' onClick={() => editCategory(category)} type='button'>Edit</button>
                  {category.status !== 'archived' ? <button className='text-xs font-semibold text-jpv-muted underline' disabled={categoryPending} onClick={() => void archiveCategory(category)} type='button'>Archive</button> : <button className='text-xs font-semibold text-red-700 underline' disabled={categoryPending} onClick={() => void deleteCategory(category)} type='button'>Delete</button>}
                </div>
              </div>
            </div>) : <p className='text-sm text-jpv-muted'>No categories yet.</p>}
          </div>
          <form className='space-y-3 border-t border-jpv-border pt-5' onSubmit={createCategory}>
            <h3 className='font-semibold text-jpv-ink'>{editingCategoryId && editingCategoryId !== 'new' ? 'Edit category' : 'New category'}</h3>
            <label className='text-sm font-semibold text-jpv-ink'>Name<input className={inputClass} name='name' onChange={(event) => setCategoryName(event.target.value)} placeholder='Office hours' required value={categoryName} /></label>
            <label className='text-sm font-semibold text-jpv-ink'>Description <span className='font-normal text-jpv-muted'>(optional)</span><textarea className={inputClass} name='description' onChange={(event) => setCategoryDescription(event.target.value)} placeholder='What is this category for?' rows={2} value={categoryDescription} /></label>
            <label className='text-sm font-semibold text-jpv-ink'>Status<select className={inputClass} name='status' onChange={(event) => setCategoryStatus(event.target.value as 'active' | 'archived')} value={categoryStatus}><option value='active'>Active</option><option value='archived'>Archived</option></select></label>
            <p className='text-xs leading-5 text-jpv-muted'>The category URL identifier is generated automatically.</p>
            <div className='flex flex-wrap gap-2'><button className='jpv-button-secondary min-h-11' disabled={categoryPending} type='submit'>{categoryPending ? 'Saving…' : editingCategoryId && editingCategoryId !== 'new' ? 'Save changes' : 'Add category'}</button>{editingCategoryId ? <button className='jpv-button-secondary min-h-11' onClick={() => { setEditingCategoryId(null); setCategoryName(''); setCategoryDescription(''); setCategoryStatus('active') }} type='button'>Cancel</button> : null}</div>
            {categoryMessage ? <p aria-live='polite' className='text-xs text-jpv-muted'>{categoryMessage}</p> : null}
          </form>
        </aside>
      </div>

      <section className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8'>
        <div className='flex flex-col gap-3 border-b border-jpv-border pb-5 sm:flex-row sm:items-end sm:justify-between'><div><p className='jpv-eyebrow'>Room history</p><h2 className='mt-2 text-2xl font-semibold text-jpv-ink'>Manage Rooms</h2></div><div className='flex flex-col gap-2 sm:flex-row'><label className='sr-only' htmlFor='room-search'>Search Rooms</label><input className='rounded-jpv-control border border-jpv-border bg-jpv-canvas px-3 py-2 text-sm text-jpv-ink' id='room-search' onChange={(event) => setFilter(event.target.value)} placeholder='Search title or category' value={filter} /><select aria-label='Filter Rooms' className='rounded-jpv-control border border-jpv-border bg-jpv-canvas px-3 py-2 text-sm text-jpv-ink' onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}><option value='active'>Active</option><option value='all'>All history</option><option value='scheduled'>Scheduled</option><option value='live'>Live</option><option value='completed'>Completed</option><option value='cancelled'>Cancelled</option><option value='archived'>Archived</option></select></div></div>
        <div className='mt-5 space-y-3'>
          {visibleRooms.length ? visibleRooms.map((room) => <article className='rounded-jpv-card border border-jpv-border p-4' key={room.id}><div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'><div className='min-w-0'><div className='flex flex-wrap items-center gap-2'><h3 className='font-semibold text-jpv-ink'>{room.title}</h3><span className='rounded-full bg-jpv-surface px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-jpv-muted'>{room.status}</span>{room.archived ? <span className='rounded-full bg-jpv-surface px-2 py-1 text-[11px] font-semibold text-jpv-muted'>Archived</span> : null}</div><p className='mt-2 text-sm text-jpv-muted'>{dateLabel(room.scheduledAt)} · {audienceLabel(room.audience)} · {room.participantCount === null ? 'Participants unknown' : `${room.participantCount}/${room.capacity} participants`}</p><div className='mt-2 flex flex-wrap gap-1.5'>{room.categoryNames.map((name) => <span className='rounded-full border border-jpv-border px-2 py-1 text-[11px] text-jpv-muted' key={name}>{name}</span>)}</div></div><div className='flex flex-wrap gap-2'>{room.status === 'scheduled' && !room.archived ? <button className='jpv-button-primary min-h-10' disabled={pending} onClick={() => void transition(room, 'live')} type='button'>Start</button> : null}{room.status === 'live' && !room.archived ? <button className='jpv-button-secondary min-h-10' disabled={pending} onClick={() => void transition(room, 'completed')} type='button'>End</button> : null}{room.status === 'scheduled' && !room.archived ? <button className='jpv-button-secondary min-h-10' disabled={pending} onClick={() => void transition(room, 'cancelled')} type='button'>Cancel</button> : null}{!room.archived ? <button className='jpv-button-secondary min-h-10' disabled={pending} onClick={() => void archive(room)} type='button'>Archive</button> : null}{room.status === 'scheduled' && !room.archived ? <button className='jpv-button-secondary min-h-10' disabled={pending} onClick={() => void remove(room)} type='button'>Delete</button> : null}</div></div><details className='mt-4 border-t border-jpv-border pt-3'><summary className='cursor-pointer text-sm font-semibold text-jpv-brand-deep'>Edit audience</summary><form className='mt-3 space-y-3' onSubmit={(event) => { event.preventDefault(); void editAudience(room, new FormData(event.currentTarget)) }}><select className={inputClass} defaultValue={room.audience} name='audience'><option value='all'>All active members</option><option value='selected'>Specific members</option><option value='groups'>Member groups</option><option value='enrolled'>Linked enrolments</option></select><div className='grid gap-2 sm:grid-cols-2'>{members.map((member) => <label className='flex items-start gap-2 text-sm text-jpv-ink' key={member.id}><input className='mt-0.5' defaultChecked={room.targetMemberIds.includes(member.id)} name='targetMemberIds' type='checkbox' value={member.id} /><span className='min-w-0'><span className='flex flex-wrap items-center gap-1.5'><span>{member.label}</span>{member.isAdministrator ? <span className='rounded-full bg-jpv-surface px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-jpv-brand-deep'>Admin</span> : null}</span>{member.email ? <span className='block truncate text-xs text-jpv-muted'>{member.email}</span> : null}</span></label>)}</div><div className='grid gap-2 sm:grid-cols-2'>{groups.map((group) => <label className='text-sm text-jpv-ink' key={group.id}><input className='mr-2' defaultChecked={room.targetGroupIds.includes(group.id)} name='targetGroupIds' type='checkbox' value={group.id} />{group.label}</label>)}</div><button className='jpv-button-secondary min-h-10' disabled={pending} type='submit'>Save audience</button></form></details></article>) : <p className='rounded-jpv-card border border-dashed border-jpv-border p-6 text-sm text-jpv-muted'>No Rooms match this view.</p>}
        </div>
      </section>
    </section>
  )
}
