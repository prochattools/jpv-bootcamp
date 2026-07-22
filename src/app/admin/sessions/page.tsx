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
  hostUser?: string | { id: string; email?: string } | null
}

export default function AdminSessionsPage() {
  const [sessions, setSessions] = useState<LiveSession[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [course, setCourse] = useState('')
  const [hostUser, setHostUser] = useState('')
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
          // hostUser is the relationship field in live_sessions (payload_users ID)
          hostUser,
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
      setHostUser('')
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

  async function cancelSession(id: string) {
    try {
      const res = await fetch(`/api/admin/sessions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
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
            <label className="block text-sm font-medium mb-1">Host User ID</label>
            <input
              type="text"
              value={hostUser}
              onChange={(e) => setHostUser(e.target.value)}
              required
              className="w-full p-2 border rounded"
              placeholder="Payload admin user document ID"
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
            const courseTitle: string =
              session.course == null
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
                {(session.status === 'scheduled' || session.status === 'live') && (
                  <button
                    onClick={() => cancelSession(session.id)}
                    className="px-4 py-2 bg-red-600 text-white rounded text-sm"
                  >
                    Cancel
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
