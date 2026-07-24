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
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Admin: Live Sessions</h1>

      <button
        onClick={() => setShowForm(!showForm)}
        className="px-4 py-2 bg-blue-600 text-white rounded mb-6"
      >
        {showForm ? 'Cancel' : 'Schedule New Session'}
      </button>

      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            createSession()
          }}
          className="space-y-4 p-4 bg-gray-50 rounded mb-6"
        >
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full p-2 border rounded"
              placeholder="e.g., Weekly Q&A"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Course ID</label>
            <input
              type="text"
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              required
              className="w-full p-2 border rounded"
              placeholder="Payload course document ID"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Module ID (optional)</label>
            <input
              type="text"
              value={module}
              onChange={(e) => setModule(e.target.value)}
              className="w-full p-2 border rounded"
              placeholder="Payload module document ID"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Lesson ID (optional)</label>
            <input
              type="text"
              value={lesson}
              onChange={(e) => setLesson(e.target.value)}
              className="w-full p-2 border rounded"
              placeholder="Requires the related module ID"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Scheduled Time</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              required
              className="w-full p-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Capacity</label>
            <input
              type="number"
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              min={1}
              max={500}
              required
              className="w-full p-2 border rounded"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
          >
            {submitting ? 'Creating...' : 'Create Session'}
          </button>
        </form>
      )}

      <div className="space-y-4">
        <h2 className="text-xl font-bold">Sessions</h2>

        {loadError && (
          <div className="p-4 bg-red-100 text-red-800 rounded">{loadError}</div>
        )}

        {sessions.length === 0 && !loadError ? (
          <p className="text-gray-600">No sessions scheduled</p>
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
                className="p-4 border rounded flex justify-between items-start"
              >
                <div>
                  <h3 className="font-bold">{session.title}</h3>
                  <p className="text-sm text-gray-600">
                    {new Date(session.scheduledAt).toLocaleString()} &middot; Cap:{' '}
                    {session.capacity}
                  </p>
                  <p className="text-xs text-gray-500">Course: {courseTitle}</p>
                  {hostEmail && (
                    <p className="text-xs text-gray-500">Host: {hostEmail}</p>
                  )}
                  <p className="text-xs font-mono text-gray-500">{session.roomName}</p>
                  <p className="text-sm mt-2">
                    <span
                      className={`px-2 py-1 rounded text-white text-xs font-medium ${
                        session.status === 'scheduled'
                          ? 'bg-blue-600'
                          : session.status === 'live'
                            ? 'bg-green-600'
                            : 'bg-red-600'
                      }`}
                    >
                      {session.status.toUpperCase()}
                    </span>
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <a
                    className="px-3 py-2 border border-gray-300 rounded text-sm"
                    href={`/admin/collections/live_sessions/${session.id}`}
                  >
                    Edit
                  </a>
                  {session.status === 'scheduled' ? (
                    <button
                      onClick={() => updateSessionStatus(session.id, 'live')}
                      className="px-3 py-2 bg-green-600 text-white rounded text-sm"
                    >
                      Start
                    </button>
                  ) : null}
                  {session.status === 'live' && courseId ? (
                    <a
                      className="px-3 py-2 bg-blue-600 text-white rounded text-sm"
                      href={`/courses/${courseId}/sessions/${session.id}/join`}
                    >
                      Join as host
                    </a>
                  ) : null}
                  {session.status === 'live' ? (
                    <button
                      onClick={() => updateSessionStatus(session.id, 'completed')}
                      className="px-3 py-2 bg-gray-800 text-white rounded text-sm"
                    >
                      Complete
                    </button>
                  ) : null}
                  {(session.status === 'scheduled' || session.status === 'live') ? (
                    <button
                      onClick={() => updateSessionStatus(session.id, 'cancelled')}
                      className="px-3 py-2 bg-red-600 text-white rounded text-sm"
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
