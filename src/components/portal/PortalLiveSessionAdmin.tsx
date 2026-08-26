'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

type Option = { id: string; label: string }
type MemberOption = Option & { email: string }
type Session = { id: string; title?: string; status?: string; scheduledAt?: string; audience?: string }

export function PortalLiveSessionAdmin({ courses, spaces, members, sessions }: { courses: Option[]; spaces: Option[]; members: MemberOption[]; sessions: Session[] }) {
  const router = useRouter()
  const [scope, setScope] = useState<'course' | 'space'>('course')
  const [audience, setAudience] = useState<'enrolled' | 'all' | 'selected'>('enrolled')
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  function toggleMember(memberId: string) {
    setSelectedMembers((current) => current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId])
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setMessage(null)
    const form = new FormData(event.currentTarget)
    const response = await fetch('/api/portal/live-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.get('title'),
        scheduledAt: form.get('scheduledAt'),
        capacity: form.get('capacity'),
        audience,
        targetMemberIds: selectedMembers,
        course: scope === 'course' ? form.get('course') : undefined,
        space: scope === 'space' ? form.get('space') : undefined,
      }),
    })
    const result = await response.json() as { ok?: boolean; message?: string; invitationWarning?: string }
    if (!response.ok || !result.ok) setMessage(result.message || 'Unable to create the session.')
    else {
      setMessage(result.invitationWarning || 'Session created and invitations queued.')
      event.currentTarget.reset()
      setSelectedMembers([])
      router.refresh()
    }
    setPending(false)
  }

  async function transition(id: string, status: 'live' | 'completed' | 'cancelled') {
    setPending(true)
    setMessage(null)
    const response = await fetch(`/api/portal/live-sessions/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const result = await response.json() as { ok?: boolean; message?: string }
    setMessage(response.ok && result.ok ? `Session marked ${status}.` : result.message || 'Unable to update the session.')
    if (response.ok && result.ok) router.refresh()
    setPending(false)
  }

  return (
    <section className='space-y-5 rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8'>
      <div>
        <p className='jpv-eyebrow'>Administrator tools</p>
        <h2 className='mt-2 text-2xl font-semibold text-jpv-ink'>Create a live session</h2>
        <p className='mt-2 text-sm leading-6 text-jpv-muted'>Schedule a room, invite members, then start it here when you are ready.</p>
      </div>
      <form className='grid gap-4 md:grid-cols-2' onSubmit={submit}>
        <label className='text-sm font-semibold text-jpv-ink'>Title<input className='mt-1.5 w-full rounded-jpv-control border border-jpv-border bg-jpv-canvas px-4 py-3 text-sm text-jpv-ink' name='title' required /></label>
        <label className='text-sm font-semibold text-jpv-ink'>Start time<input className='mt-1.5 w-full rounded-jpv-control border border-jpv-border bg-jpv-canvas px-4 py-3 text-sm text-jpv-ink' name='scheduledAt' required type='datetime-local' /></label>
        <label className='text-sm font-semibold text-jpv-ink'>Session linked to<select className='mt-1.5 w-full rounded-jpv-control border border-jpv-border bg-jpv-canvas px-4 py-3 text-sm text-jpv-ink' onChange={(event) => setScope(event.target.value as 'course' | 'space')} value={scope}><option value='course'>Course</option><option value='space'>Community space</option></select></label>
        <label className='text-sm font-semibold text-jpv-ink'>{scope === 'course' ? 'Course' : 'Community space'}<select className='mt-1.5 w-full rounded-jpv-control border border-jpv-border bg-jpv-canvas px-4 py-3 text-sm text-jpv-ink' name={scope} required><option value=''>Choose one</option>{(scope === 'course' ? courses : spaces).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
        <label className='text-sm font-semibold text-jpv-ink'>Capacity<input className='mt-1.5 w-full rounded-jpv-control border border-jpv-border bg-jpv-canvas px-4 py-3 text-sm text-jpv-ink' defaultValue='50' max='500' min='1' name='capacity' required type='number' /></label>
        <label className='text-sm font-semibold text-jpv-ink'>Audience<select className='mt-1.5 w-full rounded-jpv-control border border-jpv-border bg-jpv-canvas px-4 py-3 text-sm text-jpv-ink' onChange={(event) => setAudience(event.target.value as typeof audience)} value={audience}><option value='enrolled'>Enrolled members</option><option value='all'>All active members</option><option value='selected'>Selected members</option></select></label>
        {audience === 'selected' ? <fieldset className='md:col-span-2'><legend className='text-sm font-semibold text-jpv-ink'>Invite members</legend><div className='mt-2 grid max-h-48 gap-2 overflow-y-auto rounded-jpv-card border border-jpv-border p-3 sm:grid-cols-2'>{members.map((member) => <label className='flex items-center gap-2 text-sm text-jpv-ink' key={member.id}><input checked={selectedMembers.includes(member.id)} onChange={() => toggleMember(member.id)} type='checkbox' />{member.label} <span className='text-jpv-muted'>({member.email})</span></label>)}</div></fieldset> : null}
        <button className='jpv-button-primary min-h-11 md:col-span-2 md:w-fit' disabled={pending} type='submit'>{pending ? 'Saving…' : 'Schedule and invite'}</button>
      </form>
      {message ? <p aria-live='polite' className='text-sm text-jpv-muted'>{message}</p> : null}
      {sessions.length > 0 ? <div className='space-y-3 border-t border-jpv-border pt-5'><h3 className='font-semibold text-jpv-ink'>Manage sessions</h3>{sessions.map((session) => <div className='flex flex-wrap items-center justify-between gap-3 rounded-jpv-card border border-jpv-border p-4' key={session.id}><div><p className='font-semibold text-jpv-ink'>{session.title || 'Live session'}</p><p className='text-xs text-jpv-muted'>{session.status} · {session.scheduledAt ? new Date(session.scheduledAt).toLocaleString('en-GB') : 'No date'}</p></div><div className='flex flex-wrap gap-2'>{session.status === 'scheduled' ? <button className='jpv-button-primary min-h-10' disabled={pending} onClick={() => void transition(session.id, 'live')} type='button'>Start now</button> : null}{session.status === 'live' ? <button className='jpv-button-secondary min-h-10' disabled={pending} onClick={() => void transition(session.id, 'completed')} type='button'>End session</button> : null}{session.status === 'scheduled' ? <button className='jpv-button-secondary min-h-10' disabled={pending} onClick={() => void transition(session.id, 'cancelled')} type='button'>Cancel</button> : null}</div></div>)}</div> : null}
    </section>
  )
}
