'use client'

import Link from 'next/link'
import { useRef, useState, useTransition, type FormEvent } from 'react'

import {
  archivePortalAnnouncementAction,
  deletePortalAnnouncementAction,
  getPortalAnnouncementAction,
  updatePortalAnnouncementAction,
} from '@/app/(frontend)/portal/content/actions'
import type {
  PortalAdminUpdateSummary,
  PortalAnnouncementUpdateInput,
} from '@/lib/portalAdmin/announcementCommands'

type Props = {
  updates: PortalAdminUpdateSummary[]
}

function formatDate(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function audienceLabel(audience: PortalAdminUpdateSummary['audience']): string {
  if (audience === 'groups') return 'Member groups'
  if (audience === 'selected') return 'Selected members'
  return 'All active members'
}

export function PortalAnnouncementManagement({ updates: initialUpdates }: Props) {
  const [updates, setUpdates] = useState(initialUpdates)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingBody, setEditingBody] = useState<{ id: string; html: string } | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const editorRef = useRef<HTMLDivElement>(null)
  const editingUpdate = updates.find((update) => update.id === editingId) ?? null

  function beginEdit(update: PortalAdminUpdateSummary) {
    setEditingId(update.id)
    setEditingBody(null)
    setMessage(null)
    startTransition(async () => {
      const result = await getPortalAnnouncementAction(update.id)
      if ('message' in result) {
        setMessage(result.message)
        return
      }
      setEditingBody({ id: update.id, html: result.data?.bodyHtml ?? '' })
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditingBody(null)
    setMessage(null)
  }

  function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingUpdate) return
    const form = new FormData(event.currentTarget)
    const input: PortalAnnouncementUpdateInput = {
      title: String(form.get('title') ?? ''),
      excerpt: String(form.get('excerpt') ?? ''),
      bodyHtml: editorRef.current?.innerHTML ?? '',
      expectedUpdatedAt: editingUpdate.updatedAt,
    }
    setMessage(null)
    startTransition(async () => {
      const result = await updatePortalAnnouncementAction(editingUpdate.id, input)
      if ('message' in result) {
        setMessage(result.message)
        return
      }
      setUpdates((current) => current.map((update) => update.id === result.data.id ? result.data : update))
      setEditingId(null)
      setMessage('Update saved.')
    })
  }

  function archive(update: PortalAdminUpdateSummary) {
    if (!window.confirm(`Archive ${update.title}? Members will no longer see it as a published update.`)) return
    setMessage(null)
    startTransition(async () => {
      const result = await archivePortalAnnouncementAction(update.id, update.updatedAt)
      if ('message' in result) {
        setMessage(result.message)
        return
      }
      setUpdates((current) => current.map((item) => item.id === result.data.id ? result.data : item))
      setMessage('Update archived.')
    })
  }

  function remove(update: PortalAdminUpdateSummary) {
    if (!window.confirm(`Permanently delete ${update.title}? This cannot be undone.`)) return
    setMessage(null)
    startTransition(async () => {
      const result = await deletePortalAnnouncementAction(update.id, true, update.updatedAt)
      if ('message' in result) {
        setMessage(result.message)
        return
      }
      setUpdates((current) => current.filter((item) => item.id !== update.id))
      if (editingId === update.id) cancelEdit()
      setMessage('Update deleted.')
    })
  }

  return (
    <section className='space-y-5 rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8'>
      <div className='flex flex-wrap items-end justify-between gap-3'>
        <div>
          <p className='jpv-eyebrow'>Administrator tools</p>
          <h2 className='mt-2 text-2xl font-semibold text-jpv-ink'>Manage updates</h2>
          <p className='mt-2 text-sm leading-6 text-jpv-muted'>All updates are shown here, including targeted, draft, and archived updates.</p>
        </div>
        <span className='rounded-full bg-jpv-surface px-3 py-1.5 text-xs font-semibold text-jpv-muted'>{updates.length} update{updates.length === 1 ? '' : 's'}</span>
      </div>

      {updates.length === 0 ? <p className='rounded-jpv-card border border-dashed border-jpv-border p-6 text-sm text-jpv-muted'>No updates have been posted yet.</p> : (
        <div className='space-y-3'>
          {updates.map((update) => {
            const publishedDate = formatDate(update.publishedAt)
            const updatedDate = formatDate(update.updatedAt)
            return (
              <article className='rounded-jpv-card border border-jpv-border bg-jpv-canvas p-4 sm:p-5' key={update.id}>
                <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
                  <div className='min-w-0'>
                    <div className='flex flex-wrap items-center gap-2'>
                      <h3 className='text-lg font-semibold text-jpv-ink'>{update.title}</h3>
                      <span className='rounded-full bg-jpv-surface px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-jpv-muted'>{update.status}</span>
                    </div>
                    {update.excerpt ? <p className='mt-2 text-sm leading-6 text-jpv-muted'>{update.excerpt}</p> : null}
                    <p className='mt-2 text-xs text-jpv-muted'>{audienceLabel(update.audience)}{publishedDate ? ` · Published ${publishedDate}` : ''}{updatedDate ? ` · Updated ${updatedDate}` : ''}</p>
                  </div>
                  <div className='flex flex-wrap gap-2'>
                    {update.slug && update.status === 'published' ? <Link className='jpv-button-secondary min-h-10' href={`/portal/posts/${encodeURIComponent(update.slug)}`}>View</Link> : null}
                    <button className='jpv-button-secondary min-h-10' disabled={pending} onClick={() => beginEdit(update)} type='button'>Edit</button>
                    {update.status !== 'archived' ? <button className='jpv-button-secondary min-h-10' disabled={pending} onClick={() => archive(update)} type='button'>Archive</button> : null}
                    <button className='min-h-10 rounded-jpv-control border border-red-300 px-3 text-sm font-semibold text-red-700' disabled={pending} onClick={() => remove(update)} type='button'>Delete</button>
                  </div>
                </div>

                {editingId === update.id && editingUpdate && editingBody?.id === update.id ? (
                  <form className='mt-4 space-y-4 border-t border-jpv-border pt-4' onSubmit={saveEdit}>
                    <div className='grid gap-4 sm:grid-cols-2'>
                      <label className='text-sm font-semibold text-jpv-ink'>Title<input className='mt-1.5 w-full rounded-jpv-control border border-jpv-border bg-jpv-canvas px-3 py-2.5 text-sm text-jpv-ink' defaultValue={editingUpdate.title} name='title' required /></label>
                      <label className='text-sm font-semibold text-jpv-ink'>Short summary <span className='font-normal text-jpv-muted'>(optional)</span><input className='mt-1.5 w-full rounded-jpv-control border border-jpv-border bg-jpv-canvas px-3 py-2.5 text-sm text-jpv-ink' defaultValue={editingUpdate.excerpt ?? ''} name='excerpt' /></label>
                    </div>
                    <div>
                      <label className='text-sm font-semibold text-jpv-ink' htmlFor={`edit-update-${update.id}`}>Update text</label>
                      <div
                        aria-label='Update text'
                        className='mt-1.5 min-h-36 rounded-jpv-control border border-jpv-border bg-jpv-canvas px-3 py-2.5 text-sm leading-6 text-jpv-ink focus-within:border-jpv-brand-deep focus-visible:ring-2 focus-visible:ring-jpv-focus focus-visible:ring-offset-2 [&_a]:text-jpv-brand-deep [&_a]:underline [&_img]:my-2 [&_img]:max-h-64 [&_img]:max-w-full [&_img]:object-contain'
                        contentEditable
                        dangerouslySetInnerHTML={{ __html: editingBody.html }}
                        id={`edit-update-${update.id}`}
                        ref={editorRef}
                        role='textbox'
                        suppressContentEditableWarning
                      />
                    </div>
                    <div className='flex flex-wrap gap-2'>
                      <button className='jpv-button-primary min-h-10' disabled={pending} type='submit'>{pending ? 'Saving…' : 'Save update'}</button>
                      <button className='jpv-button-secondary min-h-10' disabled={pending} onClick={cancelEdit} type='button'>Cancel</button>
                    </div>
                  </form>
                ) : editingId === update.id ? <p className='mt-4 border-t border-jpv-border pt-4 text-sm text-jpv-muted'>Loading update…</p> : null}
              </article>
            )
          })}
        </div>
      )}
      {message ? <p aria-live='polite' className='text-sm text-jpv-muted'>{message}</p> : null}
    </section>
  )
}
