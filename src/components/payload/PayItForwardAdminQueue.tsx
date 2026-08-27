'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type Member = { id: string | number; email?: string | null }
type Application = {
  id: string
  name: string
  email: string | null
  phone: string
  message: string | null
  createdAt: string
}
type QueueData = { applications: Application[]; members: Member[]; available: number }

function formatDate(value: string): string {
  return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function PayItForwardAdminQueue() {
  const [data, setData] = useState<QueueData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    fetch('/api/admin/pay-it-forward/queue', { credentials: 'same-origin' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load sponsored requests.')
        return response.json() as Promise<QueueData>
      })
      .then((next) => { if (active) setData(next) })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Unable to load sponsored requests.') })
    return () => { active = false }
  }, [])

  return (
    <section style={{ margin: '2rem 0', maxWidth: 1280 }}>
      <div style={{ background: 'var(--jpv-canvas)', border: '1px solid var(--jpv-border)', borderRadius: 'var(--jpv-radius-panel)', boxShadow: 'var(--jpv-shadow)', padding: '1.5rem' }}>
        <div style={{ alignItems: 'flex-start', display: 'flex', gap: '1rem', justifyContent: 'space-between' }}>
          <div>
            <p style={{ color: 'var(--jpv-brand-deep)', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', margin: 0, textTransform: 'uppercase' }}>Membership support</p>
            <h2 style={{ color: 'var(--jpv-ink)', fontSize: 22, fontWeight: 700, margin: '0.35rem 0 0' }}>Sponsored membership requests</h2>
			<p style={{ color: 'var(--jpv-muted)', fontSize: 14, margin: '0.45rem 0 0' }}>Review an application and send a standard Stripe membership checkout to a new or existing member account. The funded first month is applied after checkout is completed.</p>
          </div>
          <div style={{ background: 'color-mix(in srgb, var(--jpv-sunshine) 18%, var(--jpv-canvas))', border: '1px solid var(--jpv-border)', borderRadius: 16, minWidth: 150, padding: '0.75rem 1rem', textAlign: 'center' }}>
            <div style={{ color: 'var(--jpv-brand-deep)', fontSize: 30, fontWeight: 800, lineHeight: 1 }}>{data?.available ?? '—'}</div>
            <div style={{ color: 'var(--jpv-muted)', fontSize: 12, marginTop: 5 }}>funded seats available</div>
          </div>
        </div>

        {error ? <p style={{ background: 'var(--jpv-danger-surface)', border: '1px solid var(--jpv-danger)', borderRadius: 10, color: 'var(--jpv-danger-ink)', margin: '1.25rem 0 0', padding: '0.8rem' }}>{error}</p> : null}
        {data && data.applications.length === 0 ? <p style={{ border: '1px dashed var(--jpv-border)', borderRadius: 12, color: 'var(--jpv-muted)', margin: '1.25rem 0 0', padding: '1rem' }}>No applications are waiting for review.</p> : null}
        {data && data.applications.length > 0 ? (
          <div style={{ display: 'grid', gap: 12, marginTop: '1.25rem' }}>
            {data.applications.map((application) => {
              const matchingMember = data.members.find((member) => member.email && application.email && member.email.toLowerCase() === application.email.toLowerCase())
              return (
                <article key={application.id} style={{ border: '1px solid var(--jpv-border)', borderRadius: 14, padding: '1rem' }}>
                  <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 0.8fr)' }}>
                    <div>
                      <h3 style={{ color: 'var(--jpv-ink)', fontSize: 16, fontWeight: 700, margin: 0 }}>{application.name}</h3>
                      <p style={{ color: 'var(--jpv-muted)', fontSize: 13, margin: '0.3rem 0 0' }}>{application.email ?? 'No email'} · {application.phone || 'No phone'}</p>
                      <p style={{ color: 'var(--jpv-muted)', fontSize: 12, margin: '0.3rem 0 0' }}>Applied {formatDate(application.createdAt)}</p>
                      {application.message ? <p style={{ background: 'var(--jpv-surface)', borderRadius: 8, color: 'var(--jpv-ink)', fontSize: 13, margin: '0.75rem 0 0', padding: '0.65rem' }}>{application.message}</p> : null}
                    </div>
                    <form action='/api/admin/pay-it-forward/grant' method='post' style={{ display: 'grid', gap: 8 }}>
                      <input name='applicationId' type='hidden' value={application.id} />
                      <label style={{ color: 'var(--jpv-ink)', fontSize: 12, fontWeight: 700 }} htmlFor={`mode-${application.id}`}>Grant to</label>
                      <select defaultValue={matchingMember ? 'existing' : 'new'} id={`mode-${application.id}`} name='mode' style={{ background: 'var(--jpv-canvas)', border: '1px solid var(--jpv-border)', borderRadius: 8, color: 'var(--jpv-ink)', minHeight: 40, padding: '0 0.65rem' }}>
                        <option value='new'>New member account</option>
                        <option value='existing'>Existing member account</option>
                      </select>
                      <label style={{ color: 'var(--jpv-ink)', fontSize: 12, fontWeight: 700 }} htmlFor={`member-${application.id}`}>Existing member (optional)</label>
                      <select defaultValue={matchingMember ? String(matchingMember.id) : ''} id={`member-${application.id}`} name='memberId' style={{ background: 'var(--jpv-canvas)', border: '1px solid var(--jpv-border)', borderRadius: 8, color: 'var(--jpv-ink)', minHeight: 40, padding: '0 0.65rem' }}>
                        <option value=''>Select an existing member</option>
                        {data.members.map((member) => <option key={String(member.id)} value={String(member.id)}>{String(member.email ?? member.id)}</option>)}
                      </select>
                      <button disabled={data.available < 1} style={{ background: data.available < 1 ? 'var(--jpv-muted)' : 'var(--jpv-brand-deep)', border: 0, borderRadius: 8, color: 'white', cursor: data.available < 1 ? 'not-allowed' : 'pointer', fontWeight: 700, minHeight: 42, padding: '0 1rem' }} type='submit'>
										{data.available < 1 ? 'No funded seat available' : 'Send checkout link'}
                      </button>
                    </form>
                  </div>
                </article>
              )
            })}
          </div>
        ) : null}
        <p style={{ color: 'var(--jpv-muted)', fontSize: 12, margin: '1rem 0 0' }}><Link href='/admin/collections/payload_members' style={{ color: 'var(--jpv-brand-deep)', fontWeight: 700 }}>Manage member accounts</Link> · Granting is guarded, one-seat-at-a-time, and idempotent.</p>
      </div>
    </section>
  )
}
