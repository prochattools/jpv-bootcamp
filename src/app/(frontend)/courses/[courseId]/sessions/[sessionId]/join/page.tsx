'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'

export default function LiveKitJoinPage() {
  const params = useParams()
  const sessionId = params.sessionId as string
  const [role, setRole] = useState<'student' | 'host'>('student')
  const [token, setToken] = useState<string | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [roomName, setRoomName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function requestToken() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, role }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`)
        return
      }
      setToken(data.token)
      setUrl(data.url)
      setRoomName(data.roomName)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Join Live Session</h1>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'student' | 'host')}
            disabled={loading || token !== null}
            className="block w-full p-2 border rounded"
          >
            <option value="student">Student</option>
            <option value="host">Host</option>
          </select>
        </div>

        <button
          onClick={requestToken}
          disabled={loading || token !== null}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        >
          {loading ? 'Requesting...' : 'Request Token'}
        </button>

        {error && <div className="p-4 bg-red-100 text-red-800 rounded">{error}</div>}

        {token && (
          <div className="space-y-2 p-4 bg-gray-50 rounded">
            <div>
              <p className="text-sm font-medium">Room Name</p>
              <p className="font-mono text-sm break-all">{roomName}</p>
            </div>
            <div>
              <p className="text-sm font-medium">LiveKit URL</p>
              <p className="font-mono text-sm break-all">{url}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Token (first 50 chars)</p>
              <p className="font-mono text-xs break-all">{token.substring(0, 50)}...</p>
            </div>
            <p className="text-xs text-gray-600">Token TTL: 15 minutes from request</p>
          </div>
        )}
      </div>
    </div>
  )
}
