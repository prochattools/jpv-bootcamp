'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  createSpaceAction,
  updateSpaceAction,
  archiveSpaceAction,
  restoreSpaceAction,
  deleteSpaceAction,
} from '@/lib/portalAdmin/communityAdminActions'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SpaceItem = {
  id: string
  name: string
  slug: string
  description: string
  visibility: 'public' | 'members' | 'private' | 'secret'
  status: string
}

type SpaceAdminPanelProps = {
  spaces: SpaceItem[]
}

type SpaceFormValues = {
  name: string
  slug: string
  description: string
  visibility: 'public' | 'members' | 'private' | 'secret'
}

const EMPTY_FORM: SpaceFormValues = {
  name: '',
  slug: '',
  description: '',
  visibility: 'members',
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
// Space form dialog (shared for create + edit)
// ---------------------------------------------------------------------------

type SpaceDialogProps = {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  initial: SpaceFormValues
  onSubmit: (values: SpaceFormValues) => Promise<{ ok: true; data: unknown } | { ok: false; message: string }>
  isPending: boolean
}

function SpaceFormDialog({
  open,
  onOpenChange,
  title,
  initial,
  onSubmit,
  isPending,
}: SpaceDialogProps) {
  const [values, setValues] = useState<SpaceFormValues>(initial)
  const [formError, setFormError] = useState<string | null>(null)

  // Reset form when dialog opens
  function handleOpenChange(v: boolean) {
    if (v) {
      setValues(initial)
      setFormError(null)
    }
    onOpenChange(v)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    const result = await onSubmit(values)
    if (result.ok === false) {
      setFormError(result.message ?? 'The request could not be completed.')
    }
  }

  function set<K extends keyof SpaceFormValues>(key: K, value: SpaceFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <form className='flex flex-col gap-4 pt-1' onSubmit={handleSubmit}>
          {/* Name */}
          <div className='flex flex-col gap-1.5'>
            <label className={LABEL_CLS} htmlFor='space-name'>
              Name
            </label>
            <input
              className={INPUT_CLS}
              id='space-name'
              maxLength={120}
              onChange={(e) => set('name', e.target.value)}
              placeholder='Space name'
              required
              type='text'
              value={values.name}
            />
          </div>

          {/* Slug */}
          <div className='flex flex-col gap-1.5'>
            <label className={LABEL_CLS} htmlFor='space-slug'>
              Slug
            </label>
            <input
              className={INPUT_CLS}
              id='space-slug'
              maxLength={100}
              onChange={(e) => set('slug', e.target.value)}
              placeholder='my-space'
              required
              type='text'
              value={values.slug}
            />
          </div>

          {/* Description */}
          <div className='flex flex-col gap-1.5'>
            <label className={LABEL_CLS} htmlFor='space-description'>
              Description
            </label>
            <textarea
              className={INPUT_CLS}
              id='space-description'
              maxLength={500}
              onChange={(e) => set('description', e.target.value)}
              placeholder='Optional description'
              rows={3}
              value={values.description}
            />
          </div>

          {/* Visibility */}
          <div className='flex flex-col gap-1.5'>
            <label className={LABEL_CLS} htmlFor='space-visibility'>
              Visibility
            </label>
            <select
              className={INPUT_CLS}
              id='space-visibility'
              onChange={(e) => set('visibility', e.target.value as SpaceFormValues['visibility'])}
              value={values.visibility}
            >
              <option value='members'>Members</option>
              <option value='public'>Public</option>
              <option value='private'>Private</option>
              <option value='secret'>Secret</option>
            </select>
          </div>

          {formError && (
            <p className='text-xs text-red-600' role='alert'>
              {formError}
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
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Delete confirmation dialog for spaces
// ---------------------------------------------------------------------------

function SpaceDeleteDialog({
  space,
  isPending,
  onDelete,
}: {
  space: SpaceItem
  isPending: boolean
  onDelete: (spaceId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState('')

  function handleOpenChange(v: boolean) {
    setOpen(v)
    if (!v) setConfirm('')
  }

  return (
    <>
      <button
        className={`${ADMIN_BTN} border-red-300 text-red-600 hover:border-red-600`}
        disabled={isPending}
        onClick={() => setOpen(true)}
        type='button'
      >
        Delete
      </button>
      <Dialog onOpenChange={handleOpenChange} open={open}>
        <DialogContent>
          <DialogTitle>Delete space?</DialogTitle>
          <p className='text-sm text-jpv-muted'>
            This is irreversible. The space must have no posts or memberships. Type <strong>DELETE</strong> to confirm.
          </p>
          <input
            className={INPUT_CLS}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder='DELETE'
            type='text'
            value={confirm}
          />
          <div className='flex justify-end gap-2 pt-2'>
            <DialogClose asChild>
              <button className={ADMIN_BTN} type='button'>Cancel</button>
            </DialogClose>
            <button
              className={`${ADMIN_BTN} border-red-400 text-red-600 hover:border-red-600 hover:text-red-700`}
              disabled={isPending || confirm !== 'DELETE'}
              onClick={() => { onDelete(space.id); setOpen(false) }}
              type='button'
            >
              Yes, delete
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function SpaceAdminPanel({ spaces }: SpaceAdminPanelProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<SpaceItem | null>(null)

  function showError(msg: string) {
    setError(msg)
    setTimeout(() => setError(null), 4000)
  }

  function handleCreate(values: SpaceFormValues): Promise<{ ok: true; data: unknown } | { ok: false; message: string }> {
    return new Promise((resolve) => {
      startTransition(async () => {
        const result = await createSpaceAction({
          name: values.name,
          slug: values.slug,
          description: values.description || undefined,
          visibility: values.visibility,
        })
        if (result.ok) {
          setCreateOpen(false)
          router.refresh()
        }
        resolve(result)
      })
    })
  }

  function handleUpdate(
    spaceId: string,
    values: SpaceFormValues,
  ): Promise<{ ok: true; data: unknown } | { ok: false; message: string }> {
    return new Promise((resolve) => {
      startTransition(async () => {
        const result = await updateSpaceAction(spaceId, {
          name: values.name,
          slug: values.slug,
          description: values.description || undefined,
          visibility: values.visibility,
        })
        if (result.ok) {
          setEditTarget(null)
          router.refresh()
        }
        resolve(result)
      })
    })
  }

  function handleArchive(spaceId: string) {
    startTransition(async () => {
      const result = await archiveSpaceAction(spaceId)
      if (result.ok === false) showError(result.message)
      else router.refresh()
    })
  }

  function handleRestore(spaceId: string) {
    startTransition(async () => {
      const result = await restoreSpaceAction(spaceId)
      if (result.ok === false) showError(result.message)
      else router.refresh()
    })
  }

  function handleDelete(spaceId: string) {
    startTransition(async () => {
      const result = await deleteSpaceAction(spaceId, true)
      if (result.ok === false) showError(result.message)
      else router.refresh()
    })
  }

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex items-center justify-between'>
        <h2 className='text-sm font-bold uppercase tracking-[0.12em] text-jpv-muted'>Spaces</h2>
        <button
          className={ADMIN_BTN}
          disabled={isPending}
          onClick={() => setCreateOpen(true)}
          type='button'
        >
          + Create Space
        </button>
      </div>

      {error && (
        <p className='text-xs text-red-600' role='alert'>
          {error}
        </p>
      )}

      {spaces.length === 0 ? (
        <p className='text-sm text-jpv-muted'>No spaces yet.</p>
      ) : (
        <ul className='flex flex-col divide-y divide-jpv-border rounded-jpv-card border border-jpv-border'>
          {spaces.map((space) => (
            <li
              className='flex items-center justify-between gap-3 px-4 py-3'
              key={space.id}
            >
              <div className='min-w-0'>
                <p className='truncate text-sm font-semibold text-jpv-ink'>{space.name}</p>
                <p className='text-xs text-jpv-muted'>
                  /{space.slug}
                  {space.status !== 'published' && space.status !== 'draft' && (
                    <span className='ml-2 rounded px-1 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-jpv-surface text-jpv-muted'>
                      {space.status}
                    </span>
                  )}
                </p>
              </div>
              <div className='flex shrink-0 items-center gap-2'>
                <button
                  className={ADMIN_BTN}
                  disabled={isPending}
                  onClick={() => setEditTarget(space)}
                  type='button'
                >
                  Edit
                </button>
                {space.status === 'archived' ? (
                  <button
                    className={ADMIN_BTN}
                    disabled={isPending}
                    onClick={() => handleRestore(space.id)}
                    type='button'
                  >
                    Restore
                  </button>
                ) : (
                  <button
                    className={ADMIN_BTN}
                    disabled={isPending}
                    onClick={() => handleArchive(space.id)}
                    type='button'
                  >
                    Archive
                  </button>
                )}
                <SpaceDeleteDialog
                  isPending={isPending}
                  onDelete={handleDelete}
                  space={space}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <SpaceFormDialog
        initial={EMPTY_FORM}
        isPending={isPending}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
        open={createOpen}
        title='Create Space'
      />

      {editTarget && (
        <SpaceFormDialog
          initial={{
            name: editTarget.name,
            slug: editTarget.slug,
            description: editTarget.description,
            visibility: editTarget.visibility,
          }}
          isPending={isPending}
          onOpenChange={(v) => {
            if (!v) setEditTarget(null)
          }}
          onSubmit={(values) => handleUpdate(editTarget.id, values)}
          open={!!editTarget}
          title={`Edit "${editTarget.name}"`}
        />
      )}
    </div>
  )
}
