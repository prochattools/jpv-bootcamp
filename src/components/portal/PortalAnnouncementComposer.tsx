'use client'

import { useRef, useState, type FormEvent, type MutableRefObject } from 'react'
import { useRouter } from 'next/navigation'

import { ComposerToolbar } from '@/components/community/ComposerToolbar'

type Option = { id: string; label: string }

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character)
}

function safeExternalUrl(value: string): string | null {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

function insertHtmlAtCursor(editor: HTMLElement | null, html: string, savedRange: MutableRefObject<Range | null>) {
  if (!editor) return
  editor.focus()
  const selection = window.getSelection()
  const range = savedRange.current ?? (selection?.rangeCount ? selection.getRangeAt(0) : null) ?? document.createRange()
  if (!savedRange.current && (!selection?.rangeCount || !editor.contains(range.commonAncestorContainer))) {
    range.selectNodeContents(editor)
    range.collapse(false)
  }
  range.deleteContents()
  range.insertNode(range.createContextualFragment(html))
  range.collapse(false)
  selection?.removeAllRanges()
  selection?.addRange(range)
  savedRange.current = range.cloneRange()
  editor.dispatchEvent(new Event('input', { bubbles: true }))
}

export function PortalAnnouncementComposer({ members, groups }: { members: Option[]; groups: Option[] }) {
  const router = useRouter()
  const editorRef = useRef<HTMLDivElement>(null)
  const savedRange = useRef<Range | null>(null)
  const [audience, setAudience] = useState<'all' | 'selected' | 'groups'>('all')
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])
  const [bodyHtml, setBodyHtml] = useState('')
  const [pending, setPending] = useState(false)
  const [published, setPublished] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  function saveSelection() {
    const selection = window.getSelection()
    if (!selection?.rangeCount || !editorRef.current) return
    const range = selection.getRangeAt(0)
    if (editorRef.current.contains(range.commonAncestorContainer)) savedRange.current = range.cloneRange()
  }

  function handleEditorInput() {
    setBodyHtml(editorRef.current?.innerHTML ?? '')
    setPublished(false)
    setMessage(null)
    saveSelection()
  }

  async function uploadMedia(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    try {
      const response = await fetch('/api/portal/announcements/media', { method: 'POST', body: formData })
      const result = await response.json() as { ok?: boolean; message?: string; media?: { id: string; url: string; filename: string; mimeType: string } }
      if (!response.ok || !result.ok || !result.media?.url) throw new Error(result.message || 'Unable to upload this media.')
      if (result.media.mimeType.startsWith('video/')) {
        insertHtmlAtCursor(editorRef.current, `<p><a href="${escapeHtml(result.media.url)}" target="_blank" rel="noreferrer noopener">Watch video: ${escapeHtml(result.media.filename)}</a></p>`, savedRange)
      } else {
        insertHtmlAtCursor(editorRef.current, `<p><img src="${escapeHtml(result.media.url)}" alt="${escapeHtml(result.media.filename)}" data-lexical-upload-id="${escapeHtml(result.media.id)}" data-lexical-upload-relation-to="payload_media"></p>`, savedRange)
      }
      setBodyHtml(editorRef.current?.innerHTML ?? '')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to upload this media.')
    }
  }

  function insertLink(url: string, label: string) {
    const safeUrl = safeExternalUrl(url)
    if (!safeUrl) {
      setMessage('Use a valid http or https link.')
      return
    }
    insertHtmlAtCursor(editorRef.current, `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noreferrer noopener">${escapeHtml(label || safeUrl)}</a>&nbsp;`, savedRange)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const title = String(form.get('title') ?? '').trim()
    const excerpt = String(form.get('excerpt') ?? '').trim()
    const contentText = editorRef.current?.textContent?.trim() ?? ''
    if (!title || !contentText) {
      setMessage('Title and announcement text are required.')
      return
    }
    if (audience === 'selected' && selectedMembers.length === 0) {
      setMessage('Select at least one recipient.')
      return
    }
    if (audience === 'groups' && selectedGroups.length === 0) {
      setMessage('Select at least one member group.')
      return
    }

    setPending(true)
    setMessage(null)
    try {
      const response = await fetch('/api/portal/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, excerpt, bodyHtml, audience, targetMemberIds: selectedMembers, targetGroupIds: selectedGroups }),
      })
      const result = await response.json() as { ok?: boolean; message?: string; notificationWarning?: string }
      if (!response.ok || !result.ok) {
        setMessage(result.message || 'Unable to publish announcement.')
        return
      }
      setPublished(true)
      setMessage(result.notificationWarning || 'Announcement published and notifications queued.')
      event.currentTarget.reset()
      if (editorRef.current) editorRef.current.innerHTML = ''
      setBodyHtml('')
      setSelectedMembers([])
      setSelectedGroups([])
      setAudience('all')
      savedRange.current = null
      router.refresh()
    } catch {
      setMessage('Unable to publish announcement. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <section className='space-y-5 rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8'>
      <div>
        <p className='jpv-eyebrow'>Administrator tools</p>
        <h2 className='mt-2 text-2xl font-semibold text-jpv-ink'>Publish an update</h2>
        <p className='mt-2 text-sm text-jpv-muted'>Members will see it in Updates, receive a notification, and receive an email.</p>
      </div>
      <form className='grid gap-4' onChange={() => { if (published) setPublished(false) }} onInput={() => { if (published) setPublished(false) }} onSubmit={submit}>
        <label className='text-sm font-semibold text-jpv-ink'>Title<input className='mt-1.5 w-full rounded-jpv-control border border-jpv-border bg-jpv-canvas px-4 py-3 text-sm text-jpv-ink' name='title' required /></label>
        <label className='text-sm font-semibold text-jpv-ink'>Short summary <span className='font-normal text-jpv-muted'>(optional)</span><input className='mt-1.5 w-full rounded-jpv-control border border-jpv-border bg-jpv-canvas px-4 py-3 text-sm text-jpv-ink' name='excerpt' /></label>
        <div>
          <label className='text-sm font-semibold text-jpv-ink' htmlFor='portal-announcement-editor'>Announcement</label>
          <div
            aria-label='Announcement text'
            className='mt-1.5 min-h-40 rounded-jpv-control border border-jpv-border bg-jpv-canvas px-4 py-3 text-sm leading-6 text-jpv-ink outline-none focus-within:border-jpv-brand-deep'
            contentEditable
            data-placeholder='Write an announcement with text, links, images, or videos…'
            id='portal-announcement-editor'
            onBlur={saveSelection}
            onInput={handleEditorInput}
            onKeyUp={saveSelection}
            onMouseUp={saveSelection}
            ref={editorRef}
            role='textbox'
            suppressContentEditableWarning
          />
          <div className='mt-2'>
            <ComposerToolbar
              onInsertImage={(file) => uploadMedia(file)}
              onInsertLink={(url) => insertLink(url, url)}
              onInsertVideo={(url) => insertLink(url, `Watch video: ${url}`)}
              onInsertVideoFile={(file) => uploadMedia(file)}
              textareaId='portal-announcement-editor'
            />
          </div>
        </div>
        <label className='text-sm font-semibold text-jpv-ink'>Recipients<select className='mt-1.5 w-full rounded-jpv-control border border-jpv-border bg-jpv-canvas px-4 py-3 text-sm text-jpv-ink' onChange={(event) => setAudience(event.target.value as typeof audience)} value={audience}><option value='all'>All active members</option><option value='selected'>Selected members</option><option value='groups'>Member groups</option></select></label>
        {audience === 'selected' ? <fieldset><legend className='text-sm font-semibold text-jpv-ink'>Select members <span aria-hidden='true' className='text-jpv-brand-deep'>*</span></legend><div className='mt-2 grid max-h-48 gap-2 overflow-y-auto rounded-jpv-card border border-jpv-border p-3 sm:grid-cols-2'>{members.map((member) => <label className='flex items-center gap-2 text-sm text-jpv-ink' key={member.id}><input checked={selectedMembers.includes(member.id)} onChange={() => setSelectedMembers((current) => current.includes(member.id) ? current.filter((id) => id !== member.id) : [...current, member.id])} type='checkbox' />{member.label}</label>)}</div></fieldset> : null}
        {audience === 'groups' ? <fieldset><legend className='text-sm font-semibold text-jpv-ink'>Select groups <span aria-hidden='true' className='text-jpv-brand-deep'>*</span></legend><div className='mt-2 grid max-h-48 gap-2 overflow-y-auto rounded-jpv-card border border-jpv-border p-3 sm:grid-cols-2'>{groups.map((group) => <label className='flex items-center gap-2 text-sm text-jpv-ink' key={group.id}><input checked={selectedGroups.includes(group.id)} onChange={() => setSelectedGroups((current) => current.includes(group.id) ? current.filter((id) => id !== group.id) : [...current, group.id])} type='checkbox' />{group.label}</label>)}</div></fieldset> : null}
        <button className='jpv-button-primary min-h-11 w-fit' disabled={pending} type='submit'>{pending ? 'Publishing…' : published ? 'Published' : 'Publish update'}</button>
      </form>
      {message ? <p aria-live='polite' className='text-sm text-jpv-muted'>{message}</p> : null}
    </section>
  )
}
