'use client'

import { useState } from 'react'

function BookmarkIcon() {
  return <svg aria-hidden='true' className='h-4 w-4' fill='none' viewBox='0 0 24 24'><path d='M5 5v14l7-4 7 4V5H5Z' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.75' /></svg>
}

function ShareIcon() {
  return <svg aria-hidden='true' className='h-4 w-4' fill='none' viewBox='0 0 24 24'><path d='M4 12v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4M16 6l-4-4-4 4M12 2v13' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.75' /></svg>
}

async function copyLink(url: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url)
    return
  }

  const input = document.createElement('textarea')
  input.value = url
  input.setAttribute('readonly', '')
  input.style.position = 'fixed'
  input.style.opacity = '0'
  document.body.appendChild(input)
  input.select()
  const copied = document.execCommand('copy')
  input.remove()
  if (!copied) throw new Error('Unable to copy this link.')
}

export function ShareBookmarkActions({ postId, initialBookmarked }: { postId: string; initialBookmarked: boolean }) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function toggleBookmark() {
    if (pending) return
    setPending(true)
    setMessage(null)
    const previous = bookmarked
    setBookmarked(!previous)
    try {
      const response = await fetch('/api/portal/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId }),
      })
      const result = await response.json() as { ok?: boolean; bookmarked?: boolean; message?: string }
      if (!response.ok || !result.ok) throw new Error(result.message || 'Unable to update this bookmark.')
      setBookmarked(Boolean(result.bookmarked))
      setMessage(result.bookmarked ? 'Bookmarked' : 'Bookmark removed')
    } catch (error) {
      setBookmarked(previous)
      setMessage(error instanceof Error ? error.message : 'Unable to update this bookmark.')
    } finally {
      setPending(false)
    }
  }

  async function share() {
    setMessage(null)
    const url = window.location.href
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: document.title, url })
        setMessage('Link shared')
      } else {
        await copyLink(url)
        setMessage('Link copied')
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setMessage(error instanceof Error ? error.message : 'Unable to share this post.')
    }
  }

  return (
    <div aria-live='polite' className='flex flex-wrap items-center gap-2'>
      <button aria-pressed={bookmarked} className='inline-flex min-h-11 items-center gap-2 rounded-jpv-pill border border-jpv-border bg-jpv-surface px-4 py-2 text-xs font-semibold text-jpv-muted transition hover:text-jpv-ink disabled:opacity-60' disabled={pending} onClick={() => void toggleBookmark()} type='button'>
        <BookmarkIcon />
        {bookmarked ? 'Bookmarked' : 'Bookmark'}
      </button>
      <button aria-label='Share post' className='inline-flex min-h-11 items-center gap-2 rounded-jpv-pill border border-jpv-border bg-jpv-surface px-4 py-2 text-xs font-semibold text-jpv-muted transition hover:text-jpv-ink' onClick={() => void share()} type='button'>
        <ShareIcon />
        Share
      </button>
      {message ? <span className='text-xs text-jpv-muted'>{message}</span> : null}
    </div>
  )
}
