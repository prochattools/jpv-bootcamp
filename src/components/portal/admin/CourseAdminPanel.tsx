'use client'

import { useRouter } from 'next/navigation'
import { cloneElement, isValidElement, useState, useTransition } from 'react'

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  archiveCourseAction,
  createLessonAction,
  createModuleAction,
  deleteCourseAction,
  deleteLessonAction,
  deleteModuleAction,
  reorderLessonsAction,
  reorderModulesAction,
  updateCourseAction,
  updateLessonAction,
  updateModuleAction,
} from '@/lib/portalAdmin/courseAdminActions'

// ---------- Types ----------

type ActionResult = { ok: true; data: unknown } | { ok: false; message: string }

function getError(res: ActionResult): string | null {
  return res.ok === false ? res.message : null
}

type Lesson = {
  id: string
  title: string
  slug: string | null
  summary: string | null
  estimatedDuration: string | null
  previewLesson: boolean
  sortOrder: number
  lockState: 'available' | 'locked' | 'coming_soon'
  bunnyVideoId: string | null
  downloadIds: string[]
  contentPlainText: string | null
  coverImageId: string | null
}

type Module = {
  id: string
  title: string
  description: string | null
  sortOrder: number
  lessons: Lesson[]
}

export type CourseAdminPanelProps = {
  courseId: string
  courseSlug: string
  title: string
  shortDescription: string | null
  status: 'draft' | 'published' | 'archived'
  visibility: string
  estimatedDuration: string | null
  featured: boolean
  modules: Module[]
  descriptionPlainText: string | null
  coverImageId: string | null
}

// ---------- Style constants ----------

const INPUT =
  'w-full rounded-jpv-card border border-jpv-border bg-jpv-surface px-3 py-2 text-sm text-jpv-ink placeholder:text-jpv-muted focus:border-jpv-brand-deep focus:outline-none focus:ring-1 focus:ring-jpv-brand-deep'
const LABEL = 'block text-xs font-bold uppercase tracking-[0.12em] text-jpv-muted'
const BTN_P =
  'rounded-jpv-action bg-jpv-brand-deep px-4 py-2 text-sm font-bold text-jpv-canvas transition hover:bg-jpv-brand disabled:opacity-50'
const BTN_S =
  'rounded-jpv-action border border-jpv-border bg-jpv-surface px-4 py-2 text-sm font-bold text-jpv-muted transition hover:border-jpv-brand-deep hover:text-jpv-brand-deep disabled:opacity-50'
const BTN_D =
  'rounded-jpv-action border border-jpv-border bg-jpv-surface px-4 py-2 text-sm font-bold text-jpv-muted transition hover:border-red-600 hover:text-red-600 disabled:opacity-50'
const ICON_BTN = ' px-2 py-1 text-xs'

// ---------- Micro helpers ----------

function toSlug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className={LABEL}>{label}</label>
      {children}
    </div>
  )
}

// ---------- ConfirmDeleteDialog ----------

function ConfirmDeleteDialog({ label, onDelete }: { label: string; onDelete: () => Promise<ActionResult> }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function submit() {
    if (confirm !== 'DELETE') return
    startTransition(async () => {
      const res = await onDelete()
      const resErr = getError(res); if (resErr) { setError(resErr); return }
      setOpen(false); router.refresh()
    })
  }

  return (
    <>
      <button className={BTN_D + ICON_BTN} type='button' onClick={() => { setOpen(true); setConfirm(''); setError(null) }}>{label}</button>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setConfirm(''); setError(null) } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirm Delete</DialogTitle></DialogHeader>
          <p className="text-sm text-jpv-muted">Irreversible. Type <strong>DELETE</strong> to confirm.</p>
          <Field label="Confirmation">
            <input className={INPUT} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="DELETE" />
          </Field>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <button className={BTN_S} onClick={() => setOpen(false)}>Cancel</button>
            <button className={BTN_D} disabled={confirm !== 'DELETE' || isPending} onClick={submit}>
              {isPending ? 'Deleting...' : 'Delete'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ---------- EditCourseDialog ----------

function EditCourseDialog(props: Omit<CourseAdminPanelProps, 'modules'>) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    title: props.title,
    slug: props.courseSlug,
    shortDescription: props.shortDescription ?? '',
    status: props.status,
    visibility: props.visibility,
    estimatedDuration: props.estimatedDuration ?? '',
    featured: props.featured,
    descriptionText: props.descriptionPlainText ?? '',
    coverImageId: props.coverImageId ?? '',
  })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  function submit() {
    setError(null)
    startTransition(async () => {
      const res = await updateCourseAction(props.courseId, {
        title: form.title, slug: form.slug, shortDescription: form.shortDescription,
        status: form.status as 'draft' | 'published' | 'archived',
        visibility: form.visibility as 'public' | 'members' | 'restricted',
        estimatedDuration: form.estimatedDuration, featured: form.featured,
        descriptionText: form.descriptionText || undefined,
        coverImage: form.coverImageId || null,
      })
      const resErr = getError(res); if (resErr) { setError(resErr); return }
      setSuccess(true); setTimeout(() => { setOpen(false); setSuccess(false); router.refresh() }, 600)
    })
  }

  return (
    <>
      <button className={BTN_S} onClick={() => setOpen(true)}>Edit Course</button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
        <DialogHeader><DialogTitle>Edit Course</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Title"><input className={INPUT} value={form.title} onChange={set('title')} /></Field>
          <Field label="Slug"><input className={INPUT} value={form.slug} onChange={set('slug')} /></Field>
          <Field label="Short Description">
            <textarea className={INPUT} rows={3} value={form.shortDescription} onChange={set('shortDescription')} />
          </Field>
          <Field label="Description">
            <textarea className={INPUT} rows={4} value={form.descriptionText} onChange={set('descriptionText')} placeholder="Full course description" />
          </Field>
          <Field label="Cover Image ID">
            <input className={INPUT} value={form.coverImageId} onChange={set('coverImageId')} placeholder="Media document ID" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <select className={INPUT} value={form.status} onChange={set('status')}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </Field>
            <Field label="Visibility">
              <select className={INPUT} value={form.visibility} onChange={set('visibility')}>
                <option value="public">Public</option>
                <option value="members">Members</option>
                <option value="restricted">Restricted</option>
              </select>
            </Field>
          </div>
          <Field label="Estimated Duration">
            <input className={INPUT} value={form.estimatedDuration} onChange={set('estimatedDuration')} placeholder="e.g. 4 weeks" />
          </Field>
          <label className="flex items-center gap-2 text-sm text-jpv-ink">
            <input type="checkbox" checked={form.featured} onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))} />
            Featured course
          </label>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-600">Saved!</p>}
        <DialogFooter>
          <button className={BTN_S} onClick={() => setOpen(false)}>Cancel</button>
          <button className={BTN_P} disabled={isPending} onClick={submit}>{isPending ? 'Saving...' : 'Save'}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}

// ---------- ModuleFormDialog (add + edit) ----------

function ModuleFormDialog({
  trigger, dialogTitle, initialTitle = '', initialDescription = '', onSubmit,
}: {
  trigger: React.ReactNode
  dialogTitle: string
  initialTitle?: string
  initialDescription?: string
  onSubmit: (title: string, description: string) => Promise<ActionResult>
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(initialTitle)
  const [description, setDescription] = useState(initialDescription)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function submit() {
    setError(null)
    startTransition(async () => {
      const res = await onSubmit(title, description)
      const resErr = getError(res); if (resErr) { setError(resErr); return }
      setOpen(false); router.refresh()
    })
  }

  return (
    <>
      {isValidElement(trigger) ? cloneElement(trigger as React.ReactElement<React.HTMLAttributes<HTMLButtonElement>>, { onClick: () => setOpen(true) }) : trigger}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setError(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{dialogTitle}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label="Title"><input className={INPUT} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
            <Field label="Description (optional)">
              <textarea className={INPUT} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <button className={BTN_S} onClick={() => setOpen(false)}>Cancel</button>
            <button className={BTN_P} disabled={isPending} onClick={submit}>{isPending ? 'Saving...' : 'Save'}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ---------- LessonFormDialog (add + edit) ----------

function LessonFormDialog({
  trigger, dialogTitle, moduleId, lessonId,
  initialTitle = '', initialSlug = '', initialSummary = '',
  initialDuration = '', initialLockState = 'available' as Lesson['lockState'], initialPreview = false,
  initialContent = '', initialCoverImageId = '', initialBunnyVideoId = '', initialDownloadIds = '',
}: {
  trigger: React.ReactNode
  dialogTitle: string
  moduleId: string
  lessonId?: string
  initialTitle?: string
  initialSlug?: string
  initialSummary?: string
  initialDuration?: string
  initialLockState?: Lesson['lockState']
  initialPreview?: boolean
  initialContent?: string
  initialCoverImageId?: string
  initialBunnyVideoId?: string
  initialDownloadIds?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    title: initialTitle, slug: initialSlug, summary: initialSummary,
    estimatedDuration: initialDuration, lockState: initialLockState, previewLesson: initialPreview,
    contentText: initialContent, coverImageId: initialCoverImageId,
    bunnyVideoId: initialBunnyVideoId, downloadIds: initialDownloadIds,
  })
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  function onTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const t = e.target.value
    setForm((f) => ({ ...f, title: t, slug: f.slug === toSlug(f.title) ? toSlug(t) : f.slug }))
  }

  function submit() {
    setError(null)
    startTransition(async () => {
      const downloads = form.downloadIds.split('\n').map(s => s.trim()).filter(Boolean)
      const payload = {
        title: form.title, slug: form.slug, summary: form.summary,
        estimatedDuration: form.estimatedDuration, lockState: form.lockState, previewLesson: form.previewLesson,
        contentText: form.contentText || undefined,
        coverImage: form.coverImageId || null,
        bunnyVideo: form.bunnyVideoId || null,
        downloads: downloads.length > 0 ? downloads : undefined,
      }
      const res = lessonId
        ? await updateLessonAction(lessonId, payload)
        : await createLessonAction({ moduleId, ...payload })
      const resErr = getError(res); if (resErr) { setError(resErr); return }
      setOpen(false); router.refresh()
    })
  }

  return (
    <>
      {isValidElement(trigger) ? cloneElement(trigger as React.ReactElement<React.HTMLAttributes<HTMLButtonElement>>, { onClick: () => setOpen(true) }) : trigger}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setError(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{dialogTitle}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label="Title"><input className={INPUT} value={form.title} onChange={onTitleChange} /></Field>
            <Field label="Slug"><input className={INPUT} value={form.slug} onChange={set('slug')} /></Field>
            <Field label="Summary (optional)">
              <textarea className={INPUT} rows={2} value={form.summary} onChange={set('summary')} />
            </Field>
            <Field label="Content">
              <textarea className={INPUT} rows={4} value={form.contentText} onChange={set('contentText')} placeholder="Lesson content (plain text)" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Duration">
                <input className={INPUT} value={form.estimatedDuration} onChange={set('estimatedDuration')} placeholder="e.g. 15 min" />
              </Field>
              <Field label="Lock State">
                <select className={INPUT} value={form.lockState} onChange={set('lockState')}>
                  <option value="available">Available</option>
                  <option value="locked">Locked</option>
                  <option value="coming_soon">Coming Soon</option>
                </select>
              </Field>
            </div>
            <Field label="Bunny Video ID">
              <input className={INPUT} value={form.bunnyVideoId} onChange={set('bunnyVideoId')} placeholder="Bunny video ID" />
            </Field>
            <Field label="Cover Image ID">
              <input className={INPUT} value={form.coverImageId} onChange={set('coverImageId')} placeholder="Media document ID" />
            </Field>
            <Field label="Download IDs (one per line)">
              <textarea className={INPUT} rows={3} value={form.downloadIds} onChange={set('downloadIds')} placeholder="One media ID per line" />
            </Field>
            <label className="flex items-center gap-2 text-sm text-jpv-ink">
              <input type="checkbox" checked={form.previewLesson} onChange={(e) => setForm((f) => ({ ...f, previewLesson: e.target.checked }))} />
              Preview lesson (public preview)
            </label>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <button className={BTN_S} onClick={() => setOpen(false)}>Cancel</button>
            <button className={BTN_P} disabled={isPending} onClick={submit}>{isPending ? 'Saving...' : 'Save'}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ---------- LessonRow ----------

function LessonRow({ lesson, moduleId, isFirst, isLast, allIds }: {
  lesson: Lesson; moduleId: string; isFirst: boolean; isLast: boolean; allIds: string[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function move(dir: 'up' | 'down') {
    const ids = [...allIds]
    const i = ids.indexOf(lesson.id)
    if (dir === 'up' && i > 0) [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]]
    if (dir === 'down' && i < ids.length - 1) [ids[i], ids[i + 1]] = [ids[i + 1], ids[i]]
    startTransition(async () => { await reorderLessonsAction(moduleId, ids); router.refresh() })
  }

  return (
    <div className="flex items-center gap-2 rounded-jpv-card border border-jpv-border bg-jpv-canvas px-3 py-2 text-sm">
      <span className="flex-1 text-jpv-ink">{lesson.title}</span>
      <span className="rounded bg-jpv-surface px-1.5 py-0.5 text-xs text-jpv-muted">{lesson.lockState}</span>
      <button className={BTN_S + ICON_BTN} disabled={isFirst || isPending} onClick={() => move('up')}>↑</button>
      <button className={BTN_S + ICON_BTN} disabled={isLast || isPending} onClick={() => move('down')}>↓</button>
      <LessonFormDialog
        trigger={<button className={BTN_S + ICON_BTN}>Edit</button>}
        dialogTitle="Edit Lesson"
        moduleId={moduleId}
        lessonId={lesson.id}
        initialTitle={lesson.title}
        initialSlug={lesson.slug ?? ''}
        initialSummary={lesson.summary ?? ''}
        initialDuration={lesson.estimatedDuration ?? ''}
        initialLockState={lesson.lockState}
        initialPreview={lesson.previewLesson}
        initialContent={lesson.contentPlainText ?? ''}
        initialCoverImageId={lesson.coverImageId ?? ''}
        initialBunnyVideoId={lesson.bunnyVideoId ?? ''}
        initialDownloadIds={(lesson.downloadIds ?? []).join('\n')}
      />
      <ConfirmDeleteDialog label="Del" onDelete={() => deleteLessonAction(lesson.id, true)} />
    </div>
  )
}

// ---------- ModuleRow ----------

function ModuleRow({ mod, courseId, isFirst, isLast, allModuleIds }: {
  mod: Module; courseId: string; isFirst: boolean; isLast: boolean; allModuleIds: string[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const lessonIds = mod.lessons.map((l) => l.id)

  function move(dir: 'up' | 'down') {
    const ids = [...allModuleIds]
    const i = ids.indexOf(mod.id)
    if (dir === 'up' && i > 0) [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]]
    if (dir === 'down' && i < ids.length - 1) [ids[i], ids[i + 1]] = [ids[i + 1], ids[i]]
    startTransition(async () => { await reorderModulesAction(courseId, ids); router.refresh() })
  }

  return (
    <div className="rounded-jpv-card border border-jpv-border bg-jpv-surface p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex-1 font-semibold text-jpv-ink">{mod.title}</span>
        <button className={BTN_S + ICON_BTN} disabled={isFirst || isPending} onClick={() => move('up')}>↑</button>
        <button className={BTN_S + ICON_BTN} disabled={isLast || isPending} onClick={() => move('down')}>↓</button>
        <ModuleFormDialog
          trigger={<button className={BTN_S + ICON_BTN}>Edit</button>}
          dialogTitle="Edit Module"
          initialTitle={mod.title}
          initialDescription={mod.description ?? ''}
          onSubmit={(title, description) => updateModuleAction(mod.id, { title, description })}
        />
        <LessonFormDialog
          trigger={<button className={BTN_S + ICON_BTN}>+ Lesson</button>}
          dialogTitle="Add Lesson"
          moduleId={mod.id}
        />
        {mod.lessons.length === 0 && (
          <ConfirmDeleteDialog label="Del" onDelete={() => deleteModuleAction(mod.id, true)} />
        )}
      </div>
      {mod.lessons.length > 0 && (
        <div className="space-y-1 pl-2">
          {mod.lessons.map((lesson, i) => (
            <LessonRow
              key={lesson.id}
              lesson={lesson}
              moduleId={mod.id}
              isFirst={i === 0}
              isLast={i === mod.lessons.length - 1}
              allIds={lessonIds}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------- CourseAdminPanel (main export) ----------

export function CourseAdminPanel(props: CourseAdminPanelProps) {
  const { courseId, modules } = props
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const moduleIds = modules.map((m) => m.id)

  function handlePublish() {
    startTransition(async () => { await updateCourseAction(courseId, { status: 'published' }); router.refresh() })
  }
  function handleArchive() {
    startTransition(async () => { await archiveCourseAction(courseId); router.refresh() })
  }

  return (
    <div className="rounded-jpv-card border border-jpv-border bg-jpv-surface/60 p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-[0.12em] text-jpv-brand-deep">Admin</span>
        <EditCourseDialog {...props} />
        <ModuleFormDialog
          trigger={<button className={BTN_S}>+ Module</button>}
          dialogTitle="Add Module"
          onSubmit={(title, description) => createModuleAction({ courseId, title, description })}
        />
        {props.status !== 'published' && (
          <button className={BTN_P} disabled={isPending} onClick={handlePublish}>
            {isPending ? 'Saving...' : 'Publish'}
          </button>
        )}
        {props.status !== 'archived' && (
          <button className={BTN_D} disabled={isPending} onClick={handleArchive}>Archive</button>
        )}
        {modules.length === 0 && (
          <ConfirmDeleteDialog label="Delete Course" onDelete={() => deleteCourseAction(courseId, true)} />
        )}
      </div>
      {modules.length > 0 && (
        <div className="space-y-2">
          {modules.map((mod, i) => (
            <ModuleRow
              key={mod.id}
              mod={mod}
              courseId={courseId}
              isFirst={i === 0}
              isLast={i === modules.length - 1}
              allModuleIds={moduleIds}
            />
          ))}
        </div>
      )}
    </div>
  )
}
