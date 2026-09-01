'use client'

import { FormEvent, startTransition, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { ComposerToolbar } from '@/components/community/ComposerToolbar'
import { MentionTextarea } from '@/components/community/MentionTextarea'
import { readResponseJson } from '@/components/community/readResponseJson'

export function LessonCommentComposer({
  courseSlug,
  lessonSlug,
  parentId,
  placeholder = 'Share a question, insight, or response about this lesson.',
  submitLabel = 'Post comment',
}: {
  courseSlug: string
  lessonSlug: string
  parentId?: string
  placeholder?: string
  submitLabel?: string
}) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [body, setBody] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setMessage(null)

    try {
      const response = await fetch(
        `/api/portal/courses/${encodeURIComponent(courseSlug)}/lessons/${encodeURIComponent(lessonSlug)}/comments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body, parentId: parentId ?? null }),
        },
      )
      const result = await readResponseJson<{ ok?: boolean; message?: string }>(response)
      if (!response.ok || !result?.ok) throw new Error(result?.message || 'Unable to post your comment.')
      formRef.current?.reset()
      setBody('')
      setMessage('Comment posted.')
      const main = document.querySelector('main')
      const mainScrollTop = main?.scrollTop ?? 0
      const windowScrollY = window.scrollY
      startTransition(() => router.refresh())
      requestAnimationFrame(() => {
        if (main) main.scrollTop = mainScrollTop
        window.scrollTo({ top: windowScrollY, behavior: 'auto' })
      })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to post your comment.')
    } finally {
      setPending(false)
    }
  }

  const textareaId = parentId ? `lesson-reply-${parentId}` : 'lesson-discussion-body'

  return (
    <form className='space-y-3' onSubmit={submit} ref={formRef}>
      <label className='block text-sm font-semibold text-jpv-ink' htmlFor={textareaId}>
        {parentId ? `Reply to this comment` : 'Add to the discussion'}
      </label>
      <MentionTextarea
        className='min-h-28 w-full rounded-xl border border-jpv-border bg-jpv-canvas px-4 py-3 text-sm text-jpv-ink outline-none focus:border-jpv-brand'
        id={textareaId}
        maxLength={10_000}
        name='body'
        onValueChange={setBody}
        placeholder={placeholder}
        required
        rows={4}
        value={body}
      />
      <ComposerToolbar textareaId={textareaId} />
      <button className='jpv-button-primary min-h-11 disabled:cursor-wait disabled:opacity-70' disabled={pending} type='submit'>
        {pending ? 'Posting…' : submitLabel}
      </button>
      {message ? <p aria-live='polite' className='text-sm text-jpv-muted'>{message}</p> : null}
    </form>
  )
}
