'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'

import {
  deleteLessonDiscussionComment,
  editLessonDiscussionComment,
} from '@/app/(frontend)/portal/courses/[courseSlug]/lessons/[lessonSlug]/actions'

function PencilIcon() {
  return (
    <svg aria-hidden='true' className='h-3.5 w-3.5' fill='none' viewBox='0 0 24 24'>
      <path d='M16.474 5.408l2.118 2.117m-.756-3.982L12.109 9.27a2.118 2.118 0 0 0-.58 1.082L11 13l2.648-.53c.41-.082.786-.283 1.082-.579l5.727-5.727a1.853 1.853 0 1 0-2.621-2.621z' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.75' />
      <path d='M19 15v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.75' />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg aria-hidden='true' className='h-3.5 w-3.5' fill='none' viewBox='0 0 24 24'>
      <path d='M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.75' />
    </svg>
  )
}

export function LessonCommentOwnerActions({
  commentId,
  courseSlug,
  lessonSlug,
  initialBody,
}: {
  commentId: string
  courseSlug: string
  lessonSlug: string
  initialBody: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  function save(body: string) {
    setError(null)
    startTransition(async () => {
      const result = await editLessonDiscussionComment(courseSlug, lessonSlug, commentId, body)
      if (!result.ok) {
        setError(result.error ?? 'Unable to update this comment.')
        return
      }
      setEditing(false)
      router.refresh()
    })
  }

  function remove() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await deleteLessonDiscussionComment(courseSlug, lessonSlug, commentId)
      if (!result.ok) {
        setError(result.error ?? 'Unable to remove this comment.')
        setConfirmDelete(false)
        return
      }
      router.refresh()
    })
  }

  if (editing) {
    return (
      <div className='mt-3 space-y-2'>
        <textarea
          aria-label='Edit lesson comment'
          className='min-h-24 w-full rounded-jpv-control border border-jpv-border bg-jpv-canvas px-3 py-2 text-sm text-jpv-ink'
          defaultValue={initialBody}
          disabled={isPending}
          maxLength={10_000}
          ref={bodyRef}
        />
        <div className='flex flex-wrap gap-2'>
          <button className='jpv-button-primary min-h-9 px-4 text-sm' disabled={isPending} onClick={() => save(bodyRef.current?.value ?? initialBody)} type='button'>
            Save
          </button>
          <button className='jpv-button-secondary min-h-9 px-4 text-sm' disabled={isPending} onClick={() => setEditing(false)} type='button'>Cancel</button>
        </div>
        {error ? <p className='jpv-notice jpv-notice-danger px-3 py-2 text-sm' role='alert'>{error}</p> : null}
      </div>
    )
  }

  return (
    <div className='flex flex-wrap items-center gap-1'>
      <button aria-label='Edit lesson comment' className='rounded-md p-1.5 text-jpv-muted transition hover:bg-jpv-surface hover:text-jpv-ink' disabled={isPending} onClick={() => { setError(null); setEditing(true) }} type='button'><PencilIcon /></button>
      <button aria-label={confirmDelete ? 'Confirm remove lesson comment' : 'Remove lesson comment'} className={`rounded-md p-1.5 transition ${confirmDelete ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'text-jpv-muted hover:bg-jpv-surface hover:text-red-600'}`} disabled={isPending} onClick={remove} type='button'><TrashIcon /></button>
      {confirmDelete ? <button className='px-1 text-xs text-jpv-muted hover:text-jpv-ink' disabled={isPending} onClick={() => setConfirmDelete(false)} type='button'>Cancel</button> : null}
      {error ? <p className='basis-full text-xs text-red-600' role='alert'>{error}</p> : null}
    </div>
  )
}
