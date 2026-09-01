'use client'

import { useEffect, useRef, useState, type MutableRefObject } from 'react'

import { ComposerToolbar } from '@/components/community/ComposerToolbar'

type UploadedMedia = {
  id: string
  url: string
  filename: string
  mimeType: string
}

type RichContentEditorProps = {
  id: string
  value: string
  onChange: (value: string) => void
  placeholder: string
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character)
}

function safeExternalUrl(value: string): string | null {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

function insertHtmlAtCursor(
  editor: HTMLElement | null,
  html: string,
  savedRange: MutableRefObject<Range | null>,
): void {
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
}

function saveSelection(editor: HTMLElement | null, savedRange: MutableRefObject<Range | null>): void {
  const selection = window.getSelection()
  if (!selection?.rangeCount || !editor) return
  const range = selection.getRangeAt(0)
  if (editor.contains(range.commonAncestorContainer)) savedRange.current = range.cloneRange()
}

export function RichContentEditor({ id, value, onChange, placeholder }: RichContentEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const savedRange = useRef<Range | null>(null)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) editorRef.current.innerHTML = value
  }, [value])

  function handleInput() {
    onChange(editorRef.current?.innerHTML ?? '')
    setMessage(null)
    saveSelection(editorRef.current, savedRange)
  }

  async function upload(file: File): Promise<UploadedMedia | null> {
    const formData = new FormData()
    formData.append('file', file)
    setUploading(true)
    setMessage(null)
    try {
      const response = await fetch('/api/portal/announcements/media', { method: 'POST', body: formData })
      const result = await response.json() as { ok?: boolean; message?: string; media?: UploadedMedia }
      if (!response.ok || !result.ok || !result.media?.url) throw new Error(result.message || 'Unable to upload this file.')
      return result.media
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to upload this file.')
      return null
    } finally {
      setUploading(false)
    }
  }

  function notifyEditorChanged() {
    onChange(editorRef.current?.innerHTML ?? '')
    saveSelection(editorRef.current, savedRange)
  }

  async function insertUploadedFile(file: File) {
    const media = await upload(file)
    if (!media) return
    const filename = escapeHtml(media.filename)
    if (media.mimeType.startsWith('image/')) {
      insertHtmlAtCursor(
        editorRef.current,
        `<p><img src="${escapeHtml(media.url)}" alt="${filename}" data-lexical-upload-id="${escapeHtml(media.id)}" data-lexical-upload-relation-to="payload_media"></p>`,
        savedRange,
      )
    } else {
      insertHtmlAtCursor(
        editorRef.current,
        `<p><a href="${escapeHtml(media.url)}" target="_blank" rel="noreferrer noopener">${filename}</a></p>`,
        savedRange,
      )
    }
    notifyEditorChanged()
  }

  function insertLink(url: string) {
    const safeUrl = safeExternalUrl(url)
    if (!safeUrl) {
      setMessage('Use a valid http or https link.')
      return
    }
    insertHtmlAtCursor(editorRef.current, `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noreferrer noopener">${escapeHtml(safeUrl)}</a>&nbsp;`, savedRange)
    notifyEditorChanged()
  }

  function format(command: 'bold' | 'italic' | 'formatBlock') {
    editorRef.current?.focus()
    if (command === 'formatBlock') document.execCommand(command, false, '<h2>')
    else document.execCommand(command)
    notifyEditorChanged()
  }

  function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    const files = Array.from(event.clipboardData.files)
    if (!files.length) return
    event.preventDefault()
    void Promise.all(files.map((file) => insertUploadedFile(file)))
  }

  return (
    <div className='space-y-2'>
      <div
        aria-label={placeholder}
        className='min-h-48 rounded-jpv-control border border-jpv-border bg-jpv-canvas px-4 py-3 text-sm leading-6 text-jpv-ink outline-none focus-within:border-jpv-brand-deep [&_a]:text-jpv-brand-deep [&_a]:underline [&_h1]:mt-4 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:text-lg [&_h3]:font-semibold [&_img]:my-3 [&_img]:max-h-72 [&_img]:max-w-full [&_img]:rounded-lg [&_li]:ml-5 [&_li]:list-disc [&_ol]:ml-5 [&_ol]:list-decimal [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-jpv-border [&_td]:p-2 [&_th]:border [&_th]:border-jpv-border [&_th]:bg-jpv-surface [&_th]:p-2'
        contentEditable
        data-placeholder={placeholder}
        id={id}
        onBlur={() => saveSelection(editorRef.current, savedRange)}
        onInput={handleInput}
        onKeyUp={() => saveSelection(editorRef.current, savedRange)}
        onMouseUp={() => saveSelection(editorRef.current, savedRange)}
        onPaste={handlePaste}
        ref={editorRef}
        role='textbox'
        suppressContentEditableWarning
      />
      <div className='flex flex-wrap items-center gap-1'>
        <button aria-label='Bold' className='rounded-md border border-jpv-border px-2 py-1 text-xs font-bold text-jpv-ink hover:bg-jpv-surface' onClick={() => format('bold')} type='button'>B</button>
        <button aria-label='Italic' className='rounded-md border border-jpv-border px-2 py-1 text-xs italic text-jpv-ink hover:bg-jpv-surface' onClick={() => format('italic')} type='button'>I</button>
        <button aria-label='Heading' className='rounded-md border border-jpv-border px-2 py-1 text-xs font-semibold text-jpv-ink hover:bg-jpv-surface' onClick={() => format('formatBlock')} type='button'>H2</button>
        <ComposerToolbar
          onInsertFile={(file) => insertUploadedFile(file)}
          onInsertImage={(file) => insertUploadedFile(file)}
          onInsertLink={insertLink}
          onInsertVideo={(url) => insertLink(url)}
          onInsertVideoFile={(file) => insertUploadedFile(file)}
          textareaId={id}
        />
      </div>
      {uploading ? <p className='text-xs text-jpv-muted'>Uploading…</p> : null}
      {message ? <p aria-live='polite' className='text-xs text-red-600'>{message}</p> : null}
      <p className='text-xs leading-5 text-jpv-muted'>Paste formatted text, links, tables, images, or files here. Use the toolbar for quick formatting and uploads.</p>
    </div>
  )
}
