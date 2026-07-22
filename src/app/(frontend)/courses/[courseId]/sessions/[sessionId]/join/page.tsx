'use client'

import { LiveKitRoom, VideoConference, Chat } from '@livekit/components-react'
import '@livekit/components-styles'
import { useState } from 'react'
import { useParams } from 'next/navigation'

type TokenOk = { ok: true; roomName: string; wsUrl: string; token: string }
type TokenError = { ok: false; reason: string }
type TokenResponse = TokenOk | TokenError

async function acquireToken(sessionId: string): Promise<TokenResponse> {
  const res = await fetch('/api/livekit/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ sessionId }),
  })
  return res.json()
}

const ERROR_MESSAGES: Record<string, string> = {
  unauthorized: 'You are not logged in. Please sign in and try again.',
  subscription_required: 'A pro or VIP subscription is required to join live sessions.',
  session_not_found: 'This session does not exist.',
  session_closed: 'This session has ended.',
  server_misconfigured: 'Server configuration error. Contact support.',
}

export default function LiveKitJoinPage() {
  const params = useParams()
  const sessionId = params.sessionId as string
  const [roomName, setRoomName] = useState<string | null>(null)
  const [wsUrl, setWsUrl] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<'idle' | 'requesting' | 'connected'>('idle')

  async function requestToken() {
    setState('requesting')
    setError(null)
    try {
      const data = await acquireToken(sessionId)
      if (data.ok === false) {
        setError(ERROR_MESSAGES[data.reason] ?? `Could not join: ${data.reason}`)
        setState('idle')
        return
      }
      setRoomName(data.roomName)
      setWsUrl(data.wsUrl)
      setToken(data.token)
      setState('connected')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error — please try again.')
      setState('idle')
    }
  }

  function handleDisconnect() {
    setState('idle')
    setRoomName(null)
    setWsUrl(null)
    setToken(null)
  }

  if (state === 'connected' && wsUrl && token && roomName) {
    return (
      <div className="h-screen w-full" data-lk-theme="default">
        <LiveKitRoom
          serverUrl={wsUrl}
          token={token}
          connect={true}
          audio={true}
          video={false}
          onDisconnected={handleDisconnect}
        >
          <VideoConference />
          <Chat />
        </LiveKitRoom>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Join Live Session</h1>
      <p className="text-sm text-gray-500 mb-6">Session ID: {sessionId}</p>

      <div className="space-y-4">
        {state === 'idle' && (
          <button
            onClick={requestToken}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            Join Session
          </button>
        )}

        {state === 'requesting' && (
          <p className="text-gray-500 text-sm">Verifying entitlement…</p>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
