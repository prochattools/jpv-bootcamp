'use client'

import { FormEvent, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type MemberOption = { id: string; label: string; email: string }
type Session = { id: string; title?: string; status?: string; scheduledAt?: string; audience?: string }

export function PortalLiveSessionAdmin({ members, sessions }: { members: MemberOption[]; sessions: Session[] }) {
  const router = useRouter()
  const [audience, setAudience] = useState<'all' | 'selected'>('selected')
  const [startNow, setStartNow] = useState(false)
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const scheduledAtRef = useRef<HTMLInputElement>(null)

  function toggleMember(memberId: string) {
    setSelectedMembers((current) => current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId])
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setMessage(null)
    try {
      const form = new FormData(event.currentTarget)
      const response = await fetch('/api/portal/live-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.get('title'),
          scheduledAt: form.get('scheduledAt'),
          startNow,
          capacity: form.get('capacity'),
          audience,
          targetMemberIds: selectedMembers,
        }),
      })
      const result = await response.json() as { ok?: boolean; message?: string; invitationWarning?: string }
      if (!response.ok || !result.ok) setMessage(result.message || 'Unable to create the session.')
      else {
        setMessage(result.invitationWarning || 'Session created and invitations queued.')
        event.currentTarget.reset()
        setStartNow(false)
        setAudience('selected')
        setSelectedMembers([])
        router.refresh()
      }
    } catch {
      setMessage('Unable to create the session. Please try again.')
    } finally {
      setPending(false)
    }
  }

  async function transition(id: string, status: 'live' | 'completed' | 'cancelled') {
    setPending(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/portal/live-sessions/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const result = await response.json() as { ok?: boolean; message?: string }
      setMessage(response.ok && result.ok ? `Session marked ${status}.` : result.message || 'Unable to update the session.')
      if (response.ok && result.ok) router.refresh()
    } catch {
      setMessage('Unable to update the session. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <section className='space-y-5 rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8'>
      <div>
        <p className='jpv-eyebrow'>Administrator tools</p>
        <h2 className='mt-2 text-2xl font-semibold text-jpv-ink'>Create a live session</h2>
        <p className='mt-2 text-sm leading-6 text-jpv-muted'>Schedule a room, invite members, then start it here when you are ready.</p>
      </div>
      <form className='grid gap-4 md:grid-cols-2' onSubmit={submit}>
        <label className='text-sm font-semibold text-jpv-ink'>Title <span className='font-normal text-jpv-muted'>(optional)</span><input className='mt-1.5 w-full rounded-jpv-control border border-jpv-border bg-jpv-canvas px-4 py-3 text-sm text-jpv-ink' name='title' placeholder='Live session' /></label>
        <div className='text-sm font-semibold text-jpv-ink'>Start time {!startNow ? <span aria-hidden='true' className='text-jpv-brand-deep'>*</span> : <span className='font-normal text-jpv-muted'>(optional when starting now)</span>}<div className='mt-1.5 flex flex-col gap-2 sm:flex-row'><input className='min-w-0 flex-1 rounded-jpv-control border border-jpv-border bg-jpv-canvas px-4 py-3 text-sm text-jpv-ink disabled:opacity-60' disabled={startNow} name='scheduledAt' ref={scheduledAtRef} required={!startNow} type='datetime-local' /><button className='jpv-button-secondary min-h-11 shrink-0' onClick={() => { setStartNow((current) => !current); if (!startNow && scheduledAtRef.current) scheduledAtRef.current.value = '' }} type='button'>{startNow ? 'Schedule for later' : 'Start now'}</button></div></div>
        <label className='text-sm font-semibold text-jpv-ink'>Capacity <span className='font-normal text-jpv-muted'>(optional)</span><input className='mt-1.5 w-full rounded-jpv-control border border-jpv-border bg-jpv-canvas px-4 py-3 text-sm text-jpv-ink' defaultValue='50' max='500' min='1' name='capacity' type='number' /></label>
        <label className='text-sm font-semibold text-jpv-ink'>Audience<select className='mt-1.5 w-full rounded-jpv-control border border-jpv-border bg-jpv-canvas px-4 py-3 text-sm text-jpv-ink' onChange={(event) => setAudience(event.target.value as typeof audience)} value={audience}><option value='all'>All active members</option><option value='selected'>Selected members</option></select></label>
        {audience === 'selected' ? <fieldset className='md:col-span-2'><legend className='text-sm font-semibold text-jpv-ink'>Invite members <span aria-hidden='true' className='text-jpv-brand-deep'>*</span></legend><div className='mt-2 grid max-h-48 gap-2 overflow-y-auto rounded-jpv-card border border-jpv-border p-3 sm:grid-cols-2'>{members.map((member) => <label className='flex items-center gap-2 text-sm text-jpv-ink' key={member.id}><input checked={selectedMembers.includes(member.id)} onChange={() => toggleMember(member.id)} type='checkbox' />{member.label} <span className='text-jpv-muted'>({member.email})</span></label>)}</div></fieldset> : null}
        <button className='jpv-button-primary min-h-11 md:col-span-2 md:w-fit' disabled={pending} type='submit'>{pending ? 'Saving…' : startNow ? 'Start and invite' : 'Schedule and invite'}</button>
      </form>
      {message ? <p aria-live='polite' className='text-sm text-jpv-muted'>{message}</p> : null}
      {sessions.length > 0 ? <div className='space-y-3 border-t border-jpv-border pt-5'><h3 className='font-semibold text-jpv-ink'>Manage sessions</h3>{sessions.map((session) => <div className='flex flex-wrap items-center justify-between gap-3 rounded-jpv-card border border-jpv-border p-4' key={session.id}><div><p className='font-semibold text-jpv-ink'>{session.title || 'Live session'}</p><p className='text-xs text-jpv-muted'>{session.status} · {session.scheduledAt ? new Date(session.scheduledAt).toLocaleString('en-GB') : 'No date'}</p></div><div className='flex flex-wrap gap-2'>{session.status === 'scheduled' ? <button className='jpv-button-primary min-h-10' disabled={pending} onClick={() => void transition(session.id, 'live')} type='button'>Start now</button> : null}{session.status === 'live' ? <button className='jpv-button-secondary min-h-10' disabled={pending} onClick={() => void transition(session.id, 'completed')} type='button'>End session</button> : null}{session.status === 'scheduled' ? <button className='jpv-button-secondary min-h-10' disabled={pending} onClick={() => void transition(session.id, 'cancelled')} type='button'>Cancel</button> : null}</div></div>)}</div> : null}
    </section>
  )
}
