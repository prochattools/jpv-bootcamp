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
  adminPinPostAction,
  adminUnpinPostAction,
  adminLockPostAction,
  adminUnlockPostAction,
  adminHidePostAction,
  adminUnhidePostAction,
  adminDeletePostAction,
  adminEditPostAction,
} from '@/lib/portalAdmin/communityAdminActions'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PostModerationPanelProps = {
  postId: string
  spaceId: string
  pinned: boolean
  locked: boolean
  hidden: boolean
  hasComments: boolean
  /** Optional: pre-fill the edit dialog with the current title */
  currentTitle?: string
  /** Optional: pre-fill the edit dialog with a plain-text representation of the body */
  currentBody?: string
}

type ActionResult = { ok: true; id?: string } | { ok: false; error: string }

function getError(res: ActionResult): string | null {
  return res.ok === false ? res.error : null
}

// ---------------------------------------------------------------------------
// Shared button style
// ---------------------------------------------------------------------------

const ADMIN_BTN =
  'min-h-8 rounded-jpv-action border border-jpv-border bg-jpv-surface px-3 py-1.5 text-xs font-bold text-jpv-muted transition hover:border-jpv-brand-deep hover:text-jpv-brand-deep disabled:opacity-50'

const INPUT_CLS =
  'w-full rounded-jpv-card border border-jpv-border bg-jpv-surface px-3 py-2 text-sm text-jpv-ink placeholder:text-jpv-muted focus:border-jpv-brand-deep focus:outline-none focus:ring-1 focus:ring-jpv-brand-deep'

const LABEL_CLS = 'block text-xs font-bold uppercase tracking-[0.12em] text-jpv-muted'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PostModerationPanel({
  postId,
  spaceId,
  pinned,
  locked,
  hidden,
  hasComments,
  currentTitle = '',
  currentBody = '',
}: PostModerationPanelProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Dialog open states
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  // Edit form state
  const [editTitle, setEditTitle] = useState(currentTitle)
  const [editBody, setEditBody] = useState(currentBody)
  const [editError, setEditError] = useState<string | null>(null)

  function showError(msg: string) {
    setError(msg)
    setTimeout(() => setError(null), 4000)
  }

  function run(fn: () => Promise<ActionResult>) {
    startTransition(async () => {
      const result = await fn()
      const err = getError(result)
      if (err) { showError(err) } else { router.refresh() }
    })
  }

  function handlePin() {
    if (pinned) {
      run(() => adminUnpinPostAction(postId, spaceId))
    } else {
      run(() => adminPinPostAction(postId, spaceId))
    }
  }

  function handleLock() {
    if (locked) {
      run(() => adminUnlockPostAction(postId, spaceId))
    } else {
      run(() => adminLockPostAction(postId, spaceId))
    }
  }

  function handleHide() {
    if (hidden) {
      run(() => adminUnhidePostAction(postId, spaceId))
    } else {
      run(() => adminHidePostAction(postId, spaceId))
    }
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await adminDeletePostAction(postId, true, spaceId)
      const err = getError(result)
      setDeleteOpen(false)
      if (err) { showError(err) } else { router.refresh() }
    })
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    setEditError(null)
    startTransition(async () => {
      const result = await adminEditPostAction(
        postId,
        { title: editTitle, body: editBody },
        spaceId,
      )
      const err = getError(result)
      if (err) {
        setEditError(err)
      } else {
        setEditOpen(false)
        router.refresh()
      }
    })
  }

  return (
    <div className='flex flex-col gap-2'>
      {/* Moderation buttons row */}
      <div className='flex flex-wrap items-center gap-2'>
        {/* Pin / Unpin */}
        <button
          className={ADMIN_BTN}
          disabled={isPending}
          onClick={handlePin}
          type='button'
        >
          {pinned ? 'Unpin' : 'Pin'}
        </button>

        {/* Lock / Unlock */}
        <button
          className={ADMIN_BTN}
          disabled={isPending}
          onClick={handleLock}
          type='button'
        >
          {locked ? 'Unlock' : 'Lock'}
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

        {/* Edit */}
        <button
          className={ADMIN_BTN}
          disabled={isPending}
          onClick={() => {
            setEditTitle(currentTitle)
            setEditBody(currentBody)
            setEditError(null)
            setEditOpen(true)
          }}
          type='button'
        >
          Edit
        </button>

        {/* Delete */}
        <button
          className={`${ADMIN_BTN} ${hasComments ? 'cursor-not-allowed opacity-40' : ''}`}
          disabled={isPending || hasComments}
          onClick={() => setDeleteOpen(true)}
          title={hasComments ? 'Cannot delete a post with comments — hide it instead' : undefined}
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
          <DialogTitle>Delete post?</DialogTitle>
          <DialogDescription>
            This action cannot be undone. The post and its metadata will be permanently removed.
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
          <DialogTitle>Edit post</DialogTitle>
          <form className='flex flex-col gap-4 pt-1' onSubmit={handleEditSubmit}>
            <div className='flex flex-col gap-1.5'>
              <label className={LABEL_CLS} htmlFor='edit-post-title'>
                Title
              </label>
              <input
                className={INPUT_CLS}
                id='edit-post-title'
                maxLength={300}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder='Post title'
                required
                type='text'
                value={editTitle}
              />
            </div>
            <div className='flex flex-col gap-1.5'>
              <label className={LABEL_CLS} htmlFor='edit-post-body'>
                Body
              </label>
              <textarea
                className={INPUT_CLS}
                id='edit-post-body'
                maxLength={50000}
                onChange={(e) => setEditBody(e.target.value)}
                placeholder='Post body'
                required
                rows={6}
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
