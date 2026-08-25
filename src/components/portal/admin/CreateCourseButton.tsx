'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { createCourseAction } from '@/lib/portalAdmin/courseAdminActions'

type ActionResult = { ok: true; id?: string } | { ok: false; error: string }

function getError(res: ActionResult): string | null {
  return res.ok === false ? res.error : null
}

const INPUT_CLS =
  'w-full rounded-jpv-card border border-jpv-border bg-jpv-surface px-3 py-2 text-sm text-jpv-ink placeholder:text-jpv-muted focus:border-jpv-brand-deep focus:outline-none focus:ring-1 focus:ring-jpv-brand-deep'
const LABEL_CLS = 'block text-xs font-bold uppercase tracking-[0.12em] text-jpv-muted'
const BTN_P = 'rounded-jpv-action bg-jpv-brand-deep px-4 py-2 text-sm font-bold text-jpv-canvas transition hover:bg-jpv-brand disabled:opacity-50'
const BTN_S = 'rounded-jpv-action border border-jpv-border bg-jpv-surface px-4 py-2 text-sm font-bold text-jpv-muted transition hover:border-jpv-brand-deep hover:text-jpv-brand-deep disabled:opacity-50'

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function CreateCourseButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [autoSlug, setAutoSlug] = useState(true)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result: ActionResult = await createCourseAction({
        title,
        slug: slug || slugify(title),
        status: 'draft',
      })
      const err = getError(result)
      if (err) {
        setError(err)
      } else {
        setOpen(false)
        setTitle('')
        setSlug('')
        setAutoSlug(true)
        router.refresh()
      }
    })
  }

  return (
    <Dialog onOpenChange={(v) => { setOpen(v); if (!v) setError(null) }} open={open}>
      <DialogTrigger asChild>
        <button className={BTN_P} type='button'>
          Create course
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Create new course</DialogTitle>
        <form className='flex flex-col gap-4 pt-2' onSubmit={handleSubmit}>
          <div className='flex flex-col gap-1.5'>
            <label className={LABEL_CLS} htmlFor='cc-title'>Title</label>
            <input
              autoFocus
              className={INPUT_CLS}
              id='cc-title'
              onChange={(e) => {
                setTitle(e.target.value)
                if (autoSlug) setSlug(slugify(e.target.value))
              }}
              placeholder='Course title'
              required
              value={title}
            />
          </div>
          <div className='flex flex-col gap-1.5'>
            <label className={LABEL_CLS} htmlFor='cc-slug'>Slug</label>
            <input
              className={INPUT_CLS}
              id='cc-slug'
              onChange={(e) => { setSlug(e.target.value); setAutoSlug(false) }}
              placeholder='course-slug'
              value={slug}
            />
          </div>
          {error && <p className='text-xs text-red-600'>{error}</p>}
          <div className='flex justify-end gap-2'>
            <button className={BTN_S} onClick={() => setOpen(false)} type='button'>Cancel</button>
            <button className={BTN_P} disabled={isPending || !title.trim()} type='submit'>
              {isPending ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
