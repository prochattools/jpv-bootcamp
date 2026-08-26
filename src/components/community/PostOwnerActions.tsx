'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  editCommunityPost,
  deleteCommunityPost,
  editCommunityComment,
  deleteCommunityComment,
} from '@/app/(frontend)/portal/community/actions'

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden='true' className={className} fill='none' viewBox='0 0 24 24'>
      <path d='M16.474 5.408l2.118 2.117m-.756-3.982L12.109 9.27a2.118 2.118 0 0 0-.58 1.082L11 13l2.648-.53c.41-.082.786-.283 1.082-.579l5.727-5.727a1.853 1.853 0 1 0-2.621-2.621z' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.75' />
      <path d='M19 15v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.75' />
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden='true' className={className} fill='none' viewBox='0 0 24 24'>
      <path d='M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.75' />
    </svg>
  )
}

type PostOwnerActionsProps = {
  postId: string
  spaceSlug: string
  postTitle: string
  postBody: string
}

export function PostOwnerActions({ postId, spaceSlug, postTitle, postBody }: PostOwnerActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    startTransition(async () => {
      const result = await deleteCommunityPost(spaceSlug, postId)
      if (result.ok) {
        router.push(`/portal/community/${encodeURIComponent(spaceSlug)}`)
        router.refresh()
      }
    })
  }

  async function handleEditSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await editCommunityPost(spaceSlug, postId, formData)
      if (result.ok) {
        setEditing(false)
        router.refresh()
      }
    })
  }

  if (editing) {
    return (
      <form action={handleEditSubmit} className='mt-4 space-y-3 rounded-lg border border-jpv-border bg-jpv-surface p-4'>
        <input
          className='w-full rounded-jpv-control border border-jpv-border bg-jpv-canvas px-3 py-2 text-sm text-jpv-ink'
          defaultValue={postTitle}
          maxLength={160}
          name='title'
          required
        />
        <textarea
          className='w-full rounded-jpv-control border border-jpv-border bg-jpv-canvas px-3 py-2 text-sm text-jpv-ink'
          defaultValue={postBody}
          maxLength={10000}
          name='body'
          required
          rows={5}
        />
        <div className='flex gap-2'>
          <button className='jpv-button-primary min-h-9 px-4 text-sm' disabled={isPending} type='submit'>
            Save
          </button>
          <button className='jpv-button-secondary min-h-9 px-4 text-sm' onClick={() => setEditing(false)} type='button'>
            Cancel
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className='flex items-center gap-1'>
      <button
        aria-label='Edit post'
        className='rounded-md p-1.5 text-jpv-muted transition hover:bg-jpv-surface hover:text-jpv-ink'
        onClick={() => setEditing(true)}
        type='button'
      >
        <PencilIcon className='h-4 w-4' />
      </button>
      <button
        aria-label={confirmDelete ? 'Confirm delete' : 'Delete post'}
        className={`rounded-md p-1.5 transition ${confirmDelete ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'text-jpv-muted hover:bg-jpv-surface hover:text-red-600'}`}
        disabled={isPending}
        onClick={handleDelete}
        type='button'
      >
        <TrashIcon className='h-4 w-4' />
      </button>
      {confirmDelete && (
        <button
          className='ml-1 text-xs text-jpv-muted hover:text-jpv-ink'
          onClick={() => setConfirmDelete(false)}
          type='button'
        >
          Cancel
        </button>
      )}
    </div>
  )
}

type CommentOwnerActionsProps = {
  commentId: string
  postId: string
  spaceSlug: string
  commentBody: string
}

export function CommentOwnerActions({ commentId, postId, spaceSlug, commentBody }: CommentOwnerActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    startTransition(async () => {
      const result = await deleteCommunityComment(spaceSlug, postId, commentId)
      if (result.ok) {
        router.refresh()
      }
    })
  }

  async function handleEditSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await editCommunityComment(spaceSlug, postId, commentId, formData)
      if (result.ok) {
        setEditing(false)
        router.refresh()
      }
    })
  }

  if (editing) {
    return (
      <form action={handleEditSubmit} className='mt-3 space-y-3 rounded-lg border border-jpv-border bg-jpv-surface p-3'>
        <textarea
          className='w-full rounded-jpv-control border border-jpv-border bg-jpv-canvas px-3 py-2 text-sm text-jpv-ink'
          defaultValue={commentBody}
          maxLength={10000}
          name='body'
          required
          rows={3}
        />
        <div className='flex gap-2'>
          <button className='jpv-button-primary min-h-9 px-4 text-sm' disabled={isPending} type='submit'>
            Save
          </button>
          <button className='jpv-button-secondary min-h-9 px-4 text-sm' onClick={() => setEditing(false)} type='button'>
            Cancel
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className='flex items-center gap-1'>
      <button
        aria-label='Edit comment'
        className='rounded-md p-1.5 text-jpv-muted transition hover:bg-jpv-surface hover:text-jpv-ink'
        onClick={() => setEditing(true)}
        type='button'
      >
        <PencilIcon className='h-3.5 w-3.5' />
      </button>
      <button
        aria-label={confirmDelete ? 'Confirm delete' : 'Delete comment'}
        className={`rounded-md p-1.5 transition ${confirmDelete ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'text-jpv-muted hover:bg-jpv-surface hover:text-red-600'}`}
        disabled={isPending}
        onClick={handleDelete}
        type='button'
      >
        <TrashIcon className='h-3.5 w-3.5' />
      </button>
      {confirmDelete && (
        <button
          className='ml-1 text-xs text-jpv-muted hover:text-jpv-ink'
          onClick={() => setConfirmDelete(false)}
          type='button'
        >
          Cancel
        </button>
      )}
    </div>
  )
}
