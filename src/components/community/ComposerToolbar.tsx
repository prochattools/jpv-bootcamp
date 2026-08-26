'use client'

import { useRef, useState } from 'react'

function ImageIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden='true' className={className} fill='none' viewBox='0 0 24 24'>
      <rect height='16' rx='2' stroke='currentColor' strokeWidth='1.75' width='18' x='3' y='4' />
      <circle cx='8.5' cy='9.5' r='1.5' stroke='currentColor' strokeWidth='1.75' />
      <path d='M21 15l-5-5L5 20' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.75' />
    </svg>
  )
}

function VideoIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden='true' className={className} fill='none' viewBox='0 0 24 24'>
      <rect height='14' rx='2' stroke='currentColor' strokeWidth='1.75' width='16' x='2' y='5' />
      <path d='M10 9l5 3-5 3V9z' fill='currentColor' />
    </svg>
  )
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden='true' className={className} fill='none' viewBox='0 0 24 24'>
      <path d='M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.75' />
      <path d='M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.75' />
    </svg>
  )
}

function PollIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden='true' className={className} fill='none' viewBox='0 0 24 24'>
      <path d='M18 20V10M12 20V4M6 20v-6' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.75' />
    </svg>
  )
}

function EmojiIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden='true' className={className} fill='none' viewBox='0 0 24 24'>
      <circle cx='12' cy='12' r='9' stroke='currentColor' strokeWidth='1.75' />
      <path d='M8 14s1.5 2 4 2 4-2 4-2' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.75' />
      <circle cx='9' cy='10' fill='currentColor' r='1' />
      <circle cx='15' cy='10' fill='currentColor' r='1' />
    </svg>
  )
}

type ComposerToolbarProps = {
  textareaId: string
  onInsertVideo?: (url: string) => void
  onInsertLink?: (url: string) => void
  onInsertImage?: (file: File) => void
}

export function ComposerToolbar({ textareaId, onInsertVideo, onInsertLink, onInsertImage }: ComposerToolbarProps) {
  const [showVideoInput, setShowVideoInput] = useState(false)
  const [showLinkInput, setShowLinkInput] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleVideoSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const urlInput = form.elements.namedItem('videoUrl') as HTMLInputElement
    const url = urlInput.value.trim()
    if (url && onInsertVideo) {
      onInsertVideo(url)
    }
    setShowVideoInput(false)
  }

  function handleLinkSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const urlInput = form.elements.namedItem('linkUrl') as HTMLInputElement
    const url = urlInput.value.trim()
    if (url && onInsertLink) {
      onInsertLink(url)
    }
    setShowLinkInput(false)
  }

  function handleImageClick() {
    fileInputRef.current?.click()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file && onInsertImage) {
      onInsertImage(file)
    }
    e.target.value = ''
  }

  function insertTextAtCursor(text: string) {
    const textarea = document.getElementById(textareaId) as HTMLTextAreaElement | null
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const before = textarea.value.slice(0, start)
    const after = textarea.value.slice(end)
    textarea.value = before + text + after
    textarea.selectionStart = textarea.selectionEnd = start + text.length
    textarea.focus()
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
  }

  return (
    <div className='space-y-2'>
      <div className='flex items-center gap-1 rounded-lg border border-jpv-border bg-jpv-surface px-2 py-1.5'>
        <button
          aria-label='Add image'
          className='rounded-md p-1.5 text-jpv-muted transition hover:bg-jpv-canvas hover:text-jpv-ink'
          onClick={handleImageClick}
          type='button'
        >
          <ImageIcon className='h-5 w-5' />
        </button>
        <button
          aria-label='Add video'
          className={`rounded-md p-1.5 transition ${showVideoInput ? 'bg-jpv-canvas text-jpv-ink' : 'text-jpv-muted hover:bg-jpv-canvas hover:text-jpv-ink'}`}
          onClick={() => { setShowVideoInput(!showVideoInput); setShowLinkInput(false) }}
          type='button'
        >
          <VideoIcon className='h-5 w-5' />
        </button>
        <button
          aria-label='Add link'
          className={`rounded-md p-1.5 transition ${showLinkInput ? 'bg-jpv-canvas text-jpv-ink' : 'text-jpv-muted hover:bg-jpv-canvas hover:text-jpv-ink'}`}
          onClick={() => { setShowLinkInput(!showLinkInput); setShowVideoInput(false) }}
          type='button'
        >
          <LinkIcon className='h-5 w-5' />
        </button>
        <button
          aria-label='Add poll (coming soon)'
          className='rounded-md p-1.5 text-jpv-muted/50 cursor-not-allowed'
          disabled
          title='Polls coming soon'
          type='button'
        >
          <PollIcon className='h-5 w-5' />
        </button>
        <button
          aria-label='Add emoji'
          className='rounded-md p-1.5 text-jpv-muted transition hover:bg-jpv-canvas hover:text-jpv-ink'
          onClick={() => insertTextAtCursor('😊')}
          type='button'
        >
          <EmojiIcon className='h-5 w-5' />
        </button>
        <input
          accept='image/*'
          className='hidden'
          onChange={handleFileChange}
          ref={fileInputRef}
          type='file'
        />
      </div>

      {showVideoInput && (
        <form className='flex gap-2' onSubmit={handleVideoSubmit}>
          <input
            autoFocus
            className='flex-1 rounded-jpv-control border border-jpv-border bg-jpv-canvas px-3 py-1.5 text-sm text-jpv-ink'
            name='videoUrl'
            placeholder='Paste YouTube, Vimeo, or video URL…'
            type='url'
          />
          <button className='jpv-button-primary min-h-8 px-3 text-xs' type='submit'>Insert</button>
          <button className='text-xs text-jpv-muted hover:text-jpv-ink' onClick={() => setShowVideoInput(false)} type='button'>Cancel</button>
        </form>
      )}

      {showLinkInput && (
        <form className='flex gap-2' onSubmit={handleLinkSubmit}>
          <input
            autoFocus
            className='flex-1 rounded-jpv-control border border-jpv-border bg-jpv-canvas px-3 py-1.5 text-sm text-jpv-ink'
            name='linkUrl'
            placeholder='Paste URL…'
            type='url'
          />
          <button className='jpv-button-primary min-h-8 px-3 text-xs' type='submit'>Insert</button>
          <button className='text-xs text-jpv-muted hover:text-jpv-ink' onClick={() => setShowLinkInput(false)} type='button'>Cancel</button>
        </form>
      )}
    </div>
  )
}
