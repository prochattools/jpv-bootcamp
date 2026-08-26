'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'

const ACCEPTED_COVER_TYPES = 'image/jpeg,image/png,image/webp,image/gif'

function errorMessage(reason: string): string {
  switch (reason) {
    case 'file_too_large':
      return 'Choose an image smaller than 8 MB.'
    case 'unsupported_type':
      return 'Choose a JPG, PNG, WebP, or GIF image.'
    case 'account_ineligible':
      return 'Your account cannot change the cover image right now.'
    case 'empty_file':
      return 'The selected image is empty.'
    default:
      return 'Unable to update the cover image right now.'
  }
}

export function MemberCoverImageForm({
  currentCover,
}: {
  currentCover: { url: string; alt: string } | null
}) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  async function uploadCover() {
    const file = fileInputRef.current?.files?.[0]
    if (!file) {
      setStatus('error')
      setMessage('Choose an image first.')
      return
    }

    setStatus('saving')
    setMessage(null)
    const formData = new FormData()
    formData.set('file', file)

    try {
      const response = await fetch('/api/portal/account/cover', {
        method: 'POST',
        body: formData,
      })
      const body = await response.json() as { ok?: boolean; reason?: string }
      if (!response.ok || !body.ok) {
        setStatus('error')
        setMessage(errorMessage(body.reason ?? 'unexpected'))
        return
      }
      if (fileInputRef.current) fileInputRef.current.value = ''
      setStatus('idle')
      setMessage('Cover image updated.')
      router.refresh()
    } catch {
      setStatus('error')
      setMessage(errorMessage('unexpected'))
    }
  }

  async function removeCover() {
    setStatus('saving')
    setMessage(null)
    try {
      const response = await fetch('/api/portal/account/cover', { method: 'DELETE' })
      const body = await response.json() as { ok?: boolean; reason?: string }
      if (!response.ok || !body.ok) {
        setStatus('error')
        setMessage(errorMessage(body.reason ?? 'unexpected'))
        return
      }
      setStatus('idle')
      setMessage('Cover image removed from your profile. The original media file remains preserved.')
      router.refresh()
    } catch {
      setStatus('error')
      setMessage(errorMessage('unexpected'))
    }
  }

  return (
    <div className='space-y-4'>
      <div className='overflow-hidden rounded-jpv-panel border border-jpv-border bg-jpv-surface'>
        {currentCover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentCover.url}
            alt={currentCover.alt}
            className='h-40 w-full object-cover sm:h-52'
          />
        ) : (
          <div className='flex h-40 items-center justify-center px-6 text-center text-sm text-jpv-muted sm:h-52'>
            No cover image yet. Legacy cover photos will appear here after migration.
          </div>
        )}
      </div>

      <div className='grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end'>
        <label className='text-sm font-medium text-jpv-ink'>
          Cover image
          <input
            ref={fileInputRef}
            type='file'
            accept={ACCEPTED_COVER_TYPES}
            className='mt-2 block w-full text-sm text-jpv-muted file:mr-4 file:rounded-jpv-control file:border-0 file:bg-jpv-surface file:px-4 file:py-2 file:font-semibold file:text-jpv-ink'
          />
          <span className='mt-1 block text-xs font-normal text-jpv-muted'>JPG, PNG, WebP, or GIF. Maximum 8 MB.</span>
        </label>
        <button
          type='button'
          onClick={uploadCover}
          disabled={status === 'saving'}
          className='jpv-button-primary min-h-11 disabled:cursor-not-allowed disabled:opacity-60'
        >
          {status === 'saving' ? 'Saving…' : currentCover ? 'Replace cover' : 'Upload cover'}
        </button>
        {currentCover ? (
          <button
            type='button'
            onClick={removeCover}
            disabled={status === 'saving'}
            className='jpv-button-secondary min-h-11 disabled:cursor-not-allowed disabled:opacity-60'
          >
            Remove
          </button>
        ) : null}
      </div>

      {message ? (
        <p className={status === 'error' ? 'jpv-notice jpv-notice-danger' : 'jpv-notice'} aria-live='polite'>
          {message}
        </p>
      ) : null}
    </div>
  )
}
