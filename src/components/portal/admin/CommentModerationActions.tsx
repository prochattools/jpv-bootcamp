'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog'
import {
  adminEditCommentAction,
  adminHideCommentAction,
  adminUnhideCommentAction,
  adminDeleteCommentAction,
} from '@/lib/portalAdmin/communityAdminActions'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActionResult = { ok: true; data: unknown } | { ok: false; message: string }

function getError(res: ActionResult): string | null {
  return res.ok === false ? res.message : null
}

type CommentModerationActionsProps = {
  commentId: string
  currentBody: string
  hidden: boolean
  postId: string
  spaceId: string
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const ADMIN_BTN =
  'min-h-8 rounded-jpv-action border border-jpv-border bg-jpv-surface px-3 py-1.5 text-xs font-bold text-jpv-muted transition hover:border-jpv-brand-deep hover:text-jpv-brand-deep disabled:opacity-50'

const INPUT_CLS =
  'w-full rounded-jpv-card border border-jpv-border bg-jpv-surface px-3 py-2 text-sm text-jpv-ink placeholder:text-jpv-muted focus:border-jpv-brand-deep focus:outline-none focus:ring-1 focus:ring-jpv-brand-deep'

const LABEL_CLS = 'block text-xs font-bold uppercase tracking-[0.12em] text-jpv-muted'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommentModerationActions({
  commentId,
  currentBody,
  hidden,
  postId,
  spaceId,
}: CommentModerationActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Dialog states
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  // Edit form state
  const [editBody, setEditBody] = useState(currentBody)
  const [editError, setEditError] = useState<string | null>(null)

  function showError(msg: string) {
    setError(msg)
    setTimeout(() => setError(null), 4000)
  }

  function handleHide() {
    startTransition(async () => {
      const result: ActionResult = hidden
        ? await adminUnhideCommentAction(commentId, postId, spaceId)
        : await adminHideCommentAction(commentId, postId, spaceId)
      const err = getError(result)
      if (err) { showError(err) } else { router.refresh() }
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const result: ActionResult = await adminDeleteCommentAction(commentId, true, postId, spaceId)
      const err = getError(result)
      setDeleteOpen(false)
      if (err) { showError(err) } else { router.refresh() }
    })
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    setEditError(null)
    startTransition(async () => {
      const result: ActionResult = await adminEditCommentAction(commentId, editBody, postId, spaceId)
      const err = getError(result)
      if (err) { setEditError(err) } else { setEditOpen(false); router.refresh() }
    })
  }

  return (
    <div className='flex flex-col gap-1'>
      {/* Action buttons */}
      <div className='flex flex-wrap items-center gap-1.5'>
        {/* Edit */}
        <button
          className={ADMIN_BTN}
          disabled={isPending}
          onClick={() => {
            setEditBody(currentBody)
            setEditError(null)
            setEditOpen(true)
          }}
          type='button'
        >
          Edit
        </button>

        {/* Hide / Unhide */}
        <button
          className={ADMIN_BTN}
          disabled={isPending}
          onClick={handleHide}
          type='button'
        >
          {hidden ? 'Unhide' : 'Hide'}
        </button>

        {/* Delete */}
        <button
          className={ADMIN_BTN}
          disabled={isPending}
          onClick={() => setDeleteOpen(true)}
          type='button'
        >
          Delete
        </button>
      </div>

      {/* Inline error toast */}
      {error && (
        <p className='text-xs text-red-600' role='alert'>
          {error}
        </p>
      )}

      {/* Delete confirm dialog */}
      <Dialog onOpenChange={setDeleteOpen} open={deleteOpen}>
        <DialogContent>
          <DialogTitle>Delete comment?</DialogTitle>
          <DialogDescription>
            This action cannot be undone. The comment will be permanently removed.
          </DialogDescription>
          <div className='flex justify-end gap-2 pt-2'>
            <DialogClose asChild>
              <button className={ADMIN_BTN} type='button'>
                Cancel
              </button>
            </DialogClose>
            <button
              className={`${ADMIN_BTN} border-red-400 text-red-600 hover:border-red-600 hover:text-red-700`}
              disabled={isPending}
              onClick={handleDelete}
              type='button'
            >
              {isPending ? 'Deleting…' : 'Yes, delete'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog onOpenChange={setEditOpen} open={editOpen}>
        <DialogContent>
          <DialogTitle>Edit comment</DialogTitle>
          <form className='flex flex-col gap-4 pt-1' onSubmit={handleEditSubmit}>
            <div className='flex flex-col gap-1.5'>
              <label className={LABEL_CLS} htmlFor='edit-comment-body'>
                Body
              </label>
              <textarea
                className={INPUT_CLS}
                id='edit-comment-body'
                maxLength={10000}
                onChange={(e) => setEditBody(e.target.value)}
                placeholder='Comment body'
                required
                rows={5}
                value={editBody}
              />
            </div>

            {editError && (
              <p className='text-xs text-red-600' role='alert'>
                {editError}
              </p>
            )}

            <div className='flex justify-end gap-2'>
              <DialogClose asChild>
                <button className={ADMIN_BTN} type='button'>
                  Cancel
                </button>
              </DialogClose>
              <button
                className={`${ADMIN_BTN} border-jpv-brand-deep text-jpv-brand-deep hover:bg-jpv-brand-deep hover:text-white`}
                disabled={isPending}
                type='submit'
              >
                {isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
