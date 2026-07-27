'use client'

import { useState, useEffect } from 'react'

type LiveSession = {
  id: string
  title: string
  status: string
  scheduledAt: string
  capacity: number
  roomName: string
  course?: string | { id: string; title?: string } | null
  module?: string | { id: string; title?: string } | null
  lesson?: string | { id: string; title?: string } | null
  hostUser?: string | { id: string; email?: string } | null
}

export default function AdminSessionsPage() {
  const [sessions, setSessions] = useState<LiveSession[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [course, setCourse] = useState('')
  const [module, setModule] = useState('')
  const [lesson, setLesson] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [capacity, setCapacity] = useState(50)
  const [submitting, setSubmitting] = useState(false)

  async function loadSessions() {
    setLoadError(null)
    try {
      const res = await fetch('/api/admin/sessions')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setSessions(data.sessions ?? [])
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load sessions')
    }
  }

  useEffect(() => {
    loadSessions()
  }, [])

  async function createSession() {
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          course,
          module: module || undefined,
          lesson: lesson || undefined,
          scheduledAt,
          capacity,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      setTitle('')
      setCourse('')
      setModule('')
      setLesson('')
      setScheduledAt('')
      setCapacity(50)
      setShowForm(false)
      await loadSessions()
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setSubmitting(false)
    }
  }

  async function updateSessionStatus(
    id: string,
    status: 'live' | 'completed' | 'cancelled',
  ) {
    try {
      const res = await fetch(`/api/admin/sessions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      await loadSessions()
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <section className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">Operator</p>
        <h1 className="text-2xl font-semibold text-neutral-950">Live Sessions</h1>
      </section>

      <div className="mt-6">
        <button
          onClick={() => setShowForm(!showForm)}
          className="jpv-button-primary min-h-11"
          type="button"
        >
          {showForm ? 'Cancel' : 'Schedule New Session'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            createSession()
          }}
          className="mt-6 space-y-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
        >
          <h2 className="text-lg font-semibold text-neutral-950">New session</h2>
          <div>
            <label className="block text-sm font-medium text-neutral-900" htmlFor="session-title">Title</label>
            <input
              id="session-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="mt-1 w-full min-h-11 rounded border border-neutral-300 px-3 py-2 text-sm"
              placeholder="e.g., Weekly Q&A"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-900" htmlFor="session-course">Course ID</label>
            <input
              id="session-course"
              type="text"
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              required
              className="mt-1 w-full min-h-11 rounded border border-neutral-300 px-3 py-2 text-sm"
              placeholder="Payload course document ID"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-900" htmlFor="session-module">Module ID <span className="font-normal text-neutral-500">(optional)</span></label>
            <input
              id="session-module"
              type="text"
              value={module}
              onChange={(e) => setModule(e.target.value)}
              className="mt-1 w-full min-h-11 rounded border border-neutral-300 px-3 py-2 text-sm"
              placeholder="Payload module document ID"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-900" htmlFor="session-lesson">Lesson ID <span className="font-normal text-neutral-500">(optional)</span></label>
            <input
              id="session-lesson"
              type="text"
              value={lesson}
              onChange={(e) => setLesson(e.target.value)}
              className="mt-1 w-full min-h-11 rounded border border-neutral-300 px-3 py-2 text-sm"
              placeholder="Requires the related module ID"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-900" htmlFor="session-scheduled-at">Scheduled Time</label>
            <input
              id="session-scheduled-at"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              required
              className="mt-1 w-full min-h-11 rounded border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-900" htmlFor="session-capacity">Capacity</label>
            <input
              id="session-capacity"
              type="number"
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              min={1}
              max={500}
              required
              className="mt-1 w-full min-h-11 rounded border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="jpv-button-primary min-h-11 disabled:opacity-50"
          >
            {submitting ? 'Creating…' : 'Create Session'}
          </button>
        </form>
      )}

      <div className="mt-8 space-y-4">
        <h2 className="text-xl font-semibold text-neutral-950">Sessions</h2>

        {loadError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{loadError}</div>
        )}

        {sessions.length === 0 && !loadError ? (
          <p className="text-sm text-neutral-500">No sessions scheduled</p>
        ) : (
          sessions.map((session) => {
            const hostEmail =
              session.hostUser && typeof session.hostUser === 'object'
                ? session.hostUser.email
                : null
            const courseId = session.course == null
              ? null
              : typeof session.course === 'object'
                ? String(session.course.id)
                : String(session.course)
            const courseTitle: string = session.course == null
              ? '—'
              : typeof session.course === 'object'
                ? (session.course.title ?? String(session.course.id))
                : String(session.course)

            return (
              <div
                key={session.id}
                className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0">
                  <h3 className="font-semibold text-neutral-950">{session.title}</h3>
                  <p className="mt-1 text-sm text-neutral-600">
                    {new Date(session.scheduledAt).toLocaleString()} · Cap: {session.capacity}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">Course: {courseTitle}</p>
                  {hostEmail ? (
                    <p className="text-xs text-neutral-500">Host: {hostEmail}</p>
                  ) : null}
                  <p className="mt-1 break-all text-xs font-mono text-neutral-400">{session.roomName}</p>
                  <p className="mt-3">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold text-white ${
                        session.status === 'scheduled'
                          ? 'bg-blue-600'
                          : session.status === 'live'
                            ? 'bg-emerald-600'
                            : 'bg-neutral-500'
                      }`}
                    >
                      {session.status.toUpperCase()}
                    </span>
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <a
                    className="jpv-button-secondary min-h-11 px-3 text-sm"
                    href={`/admin/collections/live_sessions/${session.id}`}
                  >
                    Edit
                  </a>
                  {session.status === 'scheduled' ? (
                    <button
                      onClick={() => updateSessionStatus(session.id, 'live')}
                      className="jpv-button-primary min-h-11 px-3 text-sm"
                      type="button"
                    >
                      Start
                    </button>
                  ) : null}
                  {session.status === 'live' && courseId ? (
                    <a
                      className="jpv-button-primary min-h-11 px-3 text-sm"
                      href={`/courses/${courseId}/sessions/${session.id}/join`}
                    >
                      Join as host
                    </a>
                  ) : null}
                  {session.status === 'live' ? (
                    <button
                      onClick={() => updateSessionStatus(session.id, 'completed')}
                      className="jpv-button-secondary min-h-11 px-3 text-sm"
                      type="button"
                    >
                      Complete
                    </button>
                  ) : null}
                  {(session.status === 'scheduled' || session.status === 'live') ? (
                    <button
                      onClick={() => updateSessionStatus(session.id, 'cancelled')}
                      className="min-h-11 rounded-jpv-action border border-jpv-danger px-3 text-sm font-semibold text-jpv-danger hover:bg-jpv-danger-surface"
                      type="button"
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
