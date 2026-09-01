'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { RichContentEditor } from '@/components/portal/admin/RichContentEditor'
import { createCourseAction } from '@/lib/portalAdmin/courseAdminActions'

type ActionResult = { ok: true; data: { coursePath?: string | null } } | { ok: false; message: string }

const INPUT_CLS =
  'w-full rounded-jpv-card border border-jpv-border bg-jpv-surface px-3 py-2 text-sm text-jpv-ink placeholder:text-jpv-muted focus:border-jpv-brand-deep focus:outline-none focus:ring-1 focus:ring-jpv-brand-deep'
const LABEL_CLS = 'block text-xs font-bold uppercase tracking-[0.12em] text-jpv-muted'
const BTN_P = 'rounded-jpv-action bg-jpv-brand-deep px-4 py-2 text-sm font-bold text-jpv-canvas transition hover:bg-jpv-brand disabled:opacity-50'
const BTN_S = 'rounded-jpv-action border border-jpv-border bg-jpv-surface px-4 py-2 text-sm font-bold text-jpv-muted transition hover:border-jpv-brand-deep hover:text-jpv-brand-deep disabled:opacity-50'

export function CreateCourseButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [shortDescription, setShortDescription] = useState('')
  const [estimatedDuration, setEstimatedDuration] = useState('')
  const [descriptionHtml, setDescriptionHtml] = useState('')
  const [step, setStep] = useState<1 | 2>(1)

  function reset() {
    setError(null)
    setTitle('')
    setShortDescription('')
    setEstimatedDuration('')
    setDescriptionHtml('')
    setStep(1)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result: ActionResult = await createCourseAction({
        title,
        shortDescription,
        estimatedDuration,
        descriptionHtml,
        status: 'draft',
      })
      if (result.ok === false) {
        setError(result.message)
      } else {
        setOpen(false)
        const coursePath = result.data.coursePath
        reset()
        if (coursePath) router.push(coursePath)
        else router.refresh()
      }
    })
  }

  return (
    <Dialog onOpenChange={(v) => { setOpen(v); if (!v) reset() }} open={open}>
      <DialogTrigger asChild>
        <button className={BTN_P} type='button'>
          Create course
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Create new course</DialogTitle>
        <form className='flex flex-col gap-4 pt-2' onSubmit={handleSubmit}>
          <p className='text-sm leading-6 text-jpv-muted'>Start with the basics. You can add modules and lessons immediately after the course is created.</p>
          {step === 1 ? <>
            <div className='flex flex-col gap-1.5'>
              <label className={LABEL_CLS} htmlFor='cc-title'>Course title</label>
              <input
                autoFocus
                className={INPUT_CLS}
                id='cc-title'
                onChange={(e) => setTitle(e.target.value)}
                placeholder='e.g. Property Investment Foundations'
                required
                value={title}
              />
            </div>
            <div className='flex flex-col gap-1.5'>
              <label className={LABEL_CLS} htmlFor='cc-short-description'>Short description</label>
              <textarea className={INPUT_CLS} id='cc-short-description' onChange={(e) => setShortDescription(e.target.value)} placeholder='What will members learn?' rows={3} value={shortDescription} />
            </div>
            <div className='flex flex-col gap-1.5'>
              <label className={LABEL_CLS} htmlFor='cc-duration'>Estimated duration</label>
              <input className={INPUT_CLS} id='cc-duration' onChange={(e) => setEstimatedDuration(e.target.value)} placeholder='e.g. 6 weeks' value={estimatedDuration} />
            </div>
          </> : <div className='space-y-2'>
            <label className={LABEL_CLS} htmlFor='cc-description'>Course description</label>
            <RichContentEditor id='cc-description' onChange={setDescriptionHtml} placeholder='Add the course description…' value={descriptionHtml} />
          </div>}
          {error && <p className='text-xs text-red-600'>{error}</p>}
          <div className='flex justify-end gap-2'>
            <button className={BTN_S} onClick={() => setOpen(false)} type='button'>Cancel</button>
            {step === 2 ? <button className={BTN_S} onClick={() => setStep(1)} type='button'>Back</button> : null}
            {step === 1 ? <button className={BTN_P} disabled={!title.trim()} onClick={() => { setError(null); setStep(2) }} type='button'>Next</button> : <button className={BTN_P} disabled={isPending || !title.trim()} type='submit'>{isPending ? 'Creating…' : 'Create course'}</button>}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
