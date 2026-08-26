'use client'

import { FormEvent, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { ComposerToolbar } from '@/components/community/ComposerToolbar'

export function CommunityCommentComposer({ spaceSlug, postId }: { spaceSlug: string; postId: string }) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setMessage(null)
    const form = new FormData(event.currentTarget)
    try {
      const response = await fetch('/api/portal/community/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spaceSlug, postId, body: form.get('body'), videoUrl: form.get('videoUrl') }),
      })
      const result = (await response.json()) as { ok?: boolean; message?: string }
      if (!response.ok || !result.ok) throw new Error(result.message || 'Unable to post your reply.')
      formRef.current?.reset()
      setMessage('Reply posted.')
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to post your reply.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form className='mt-5 space-y-4' onSubmit={submit} ref={formRef}>
      <div>
        <label className='block text-sm font-bold text-jpv-brand-deep' htmlFor='comment-body'>Your reply</label>
        <textarea className='mt-1.5 w-full rounded-jpv-control border border-jpv-border bg-jpv-canvas px-4 py-3 text-sm text-jpv-ink outline-none transition focus:border-jpv-green-deep focus:ring-2 focus:ring-jpv-green/25' id='comment-body' maxLength={10000} name='body' placeholder='Share your reply…' required rows={4} />
      </div>
      <ComposerToolbar textareaId='comment-body' />
      <input id='comment-video' name='videoUrl' type='hidden' />
      <button className='jpv-button-primary min-h-11 disabled:cursor-wait disabled:opacity-70' disabled={pending} type='submit'>
        {pending ? 'Posting…' : 'Submit reply'}
      </button>
      {message ? <p aria-live='polite' className='text-sm text-jpv-muted'>{message}</p> : null}
    </form>
  )
}
