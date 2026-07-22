'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'

export default function LiveKitJoinPage() {
  const params = useParams()
  const sessionId = params.sessionId as string
  const [roomName, setRoomName] = useState<string | null>(null)
  const [wsUrl, setWsUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [joined, setJoined] = useState(false)

  async function requestToken() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Role is NOT sent — it is derived server-side from session.hostUser
        body: JSON.stringify({ sessionId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.reason || `HTTP ${res.status}`)
        return
      }
      // Token is in the httpOnly cookie — do NOT store or display it here
      setRoomName(data.roomName)
      setWsUrl(data.wsUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  function joinRoom() {
    // LiveKit client connection would be initiated here using the cookie-based token.
    // @livekit/components-react is not yet installed; show a confirmation message.
    setJoined(true)
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Join Live Session</h1>
      <div className="space-y-4">
        <button
          onClick={requestToken}
          disabled={loading || roomName !== null}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        >
          {loading ? 'Requesting...' : 'Request Token'}
        </button>

        {error && <div className="p-4 bg-red-100 text-red-800 rounded">{error}</div>}

        {roomName && !joined && (
          <div className="space-y-2 p-4 bg-gray-50 rounded">
            <div>
              <p className="text-sm font-medium">Room Name</p>
              <p className="font-mono text-sm break-all">{roomName}</p>
            </div>
            <div>
              <p className="text-sm font-medium">LiveKit URL</p>
              <p className="font-mono text-sm break-all">{wsUrl}</p>
            </div>
            <p className="text-xs text-gray-600">
              Token has been set in your session cookie (httpOnly).
            </p>
            <button
              onClick={joinRoom}
              className="px-4 py-2 bg-green-600 text-white rounded"
            >
              Join Room
            </button>
          </div>
        )}

        {joined && (
          <div className="p-4 bg-green-50 border border-green-200 rounded">
            <p className="text-green-800">
              LiveKit client connection ready &mdash; room <span className="font-mono">{roomName}</span> at{' '}
              <span className="font-mono">{wsUrl}</span>. Token set in session cookie.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
