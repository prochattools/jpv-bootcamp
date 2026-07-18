'use client'

import { useState } from 'react'

export default function AdminSessionsPage() {
  const [sessions, setSessions] = useState([
    {
      id: '1',
      title: 'Live Q&A Session',
      status: 'scheduled',
      scheduledAt: '2026-07-20T14:00:00Z',
      capacity: 50,
      roomName: 'course-101-module-1-lesson-1',
    },
  ])
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')

  async function createSession() {
    try {
      const res = await fetch('/api/admin/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          course: 'course-101',
          module: 'module-1',
          lesson: 'lesson-1',
          hostUserId: 'admin-1',
          scheduledAt,
          capacity: 50,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const session = await res.json()
      setSessions([...sessions, session])
      setTitle('')
      setScheduledAt('')
      setShowForm(false)
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  async function cancelSession(id: string) {
    try {
      const res = await fetch(`/api/admin/sessions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      })
      if (!res.ok) throw new Error(await res.text())
      setSessions(sessions.map(s => s.id === id ? { ...s, status: 'cancelled' } : s))
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
            <label className="block text-sm font-medium mb-1">Scheduled Time</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              required
              className="w-full p-2 border rounded"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-green-600 text-white rounded"
          >
            Create Session
          </button>
        </form>
      )}

      <div className="space-y-4">
        <h2 className="text-xl font-bold">Sessions</h2>
        {sessions.length === 0 ? (
          <p className="text-gray-600">No sessions scheduled</p>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className="p-4 border rounded flex justify-between items-start"
            >
              <div>
                <h3 className="font-bold">{session.title}</h3>
                <p className="text-sm text-gray-600">
                  {new Date(session.scheduledAt).toLocaleString()} · Cap: {session.capacity}
                </p>
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
              {session.status === 'scheduled' && (
                <button
                  onClick={() => cancelSession(session.id)}
                  className="px-4 py-2 bg-red-600 text-white rounded text-sm"
                >
                  Cancel
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
