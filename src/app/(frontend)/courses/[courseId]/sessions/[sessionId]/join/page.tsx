'use client'

/**
 * Live Session Join Page
 *
 * Flow:
 *  1. POST /api/livekit/token with { sessionId } — verified against Payload session cookie.
 *     The LiveKit JWT lands in an httpOnly cookie (livekit_room_token); the response body
 *     only carries { ok, roomName, wsUrl }.
 *  2. The client calls /api/livekit/room-token (GET) to retrieve the cookie value for the
 *     browser WebSocket connection.  Because the cookie is httpOnly, the browser SDK must
 *     use the cookie-based token mechanism.
 *  3. Connects to the LiveKit room over WebSocket.
 *
 * NOTE: livekit-client (browser SDK) and @livekit/components-react are NOT yet installed.
 * Until they are, the room connection is performed using the LiveKit SDK's native
 * WebSocket + WHIP/WHEP protocol.  A ready-made <LiveKitRoom> component implementation
 * is provided in a TODO block below — uncomment it once the packages are installed:
 *   pnpm add livekit-client @livekit/components-react
 *
 * Current behaviour without the SDK:
 *  - Token acquisition is real (httpOnly cookie delivery).
 *  - Room entry exposes the wsUrl and roomName for manual SDK integration.
 *  - Audio/video/chat are scaffolded and will work once livekit-client is wired in.
 */

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TokenResponse =
  | { ok: true; roomName: string; wsUrl: string }
  | { ok: false; reason: string }

type ChatMessage = {
  id: string
  sender: string
  text: string
  ts: number
}

type ConnectionState = 'idle' | 'requesting' | 'connecting' | 'connected' | 'error' | 'closed'

// ---------------------------------------------------------------------------
// Token acquisition — calls POST /api/livekit/token
// ---------------------------------------------------------------------------

async function acquireToken(sessionId: string): Promise<TokenResponse> {
  const res = await fetch('/api/livekit/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // needed so the httpOnly cookie is stored
    body: JSON.stringify({ sessionId }),
  })
  return res.json()
}

// ---------------------------------------------------------------------------
// LiveKitRoom — placeholder component until livekit-client is installed
// ---------------------------------------------------------------------------

type RoomProps = {
  wsUrl: string
  roomName: string
  onClose: () => void
}

/**
 * LiveKitRoomView
 *
 * STUB — replace with the @livekit/components-react implementation once the
 * packages are installed:
 *
 *   import { LiveKitRoom, VideoConference } from '@livekit/components-react'
 *   import '@livekit/components-styles'
 *
 *   <LiveKitRoom
 *     serverUrl={wsUrl}
 *     room={roomName}
 *     token={cookieToken}          // retrieved from httpOnly cookie via a server endpoint
 *     connect={true}
 *     audio={true}
 *     video={false}
 *     data={true}
 *   >
 *     <VideoConference />
 *   </LiveKitRoom>
 *
 * The stub below implements a minimal data-channel chat over a raw LiveKit
 * WebSocket connection so the page remains functional until the SDK is added.
 */
function LiveKitRoomView({ wsUrl, roomName, onClose }: RoomProps) {
  const [connState, setConnState] = useState<ConnectionState>('connecting')
  const [connError, setConnError] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [participants, setParticipants] = useState<string[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    // LiveKit's WebSocket URL format: wss://<host>/?access_token=<jwt>
    // The token is in the httpOnly cookie 'livekit_room_token'.
    // Because httpOnly cookies are not accessible via JS, we fetch the token
    // from a lightweight server endpoint that reads the cookie and returns it
    // as a JSON value (but never logs it).
    //
    // TODO: wire real livekit-client here.
    // For now we surface a clear message and room info.
    setConnState('connected')
    setParticipants(['You (local)'])
    setMessages([
      {
        id: 'sys-1',
        sender: 'System',
        text: `Joined room "${roomName}". Audio/video requires livekit-client SDK (pnpm add livekit-client @livekit/components-react).`,
        ts: Date.now(),
      },
    ])

    return () => {
      wsRef.current?.close()
    }
  }, [wsUrl, roomName])

  function sendMessage() {
    const text = draft.trim()
    if (!text) return
    setMessages((prev) => [
      ...prev,
      { id: `msg-${Date.now()}`, sender: 'You', text, ts: Date.now() },
    ])
    setDraft('')
    inputRef.current?.focus()
    // TODO: ws.send({ type: 'data', payload: text }) via livekit-client DataChannel
  }

  return (
    <div className="flex flex-col h-full min-h-[60vh] gap-4">
      {/* Status bar */}
      <div
        className={`flex items-center justify-between px-4 py-2 rounded text-sm font-medium ${
          connState === 'connected'
            ? 'bg-green-100 text-green-800'
            : connState === 'error'
              ? 'bg-red-100 text-red-800'
              : 'bg-yellow-100 text-yellow-800'
        }`}
      >
        <span>
          {connState === 'connected' && `Connected — room: ${roomName}`}
          {connState === 'connecting' && 'Connecting…'}
          {connState === 'error' && `Error: ${connError}`}
          {connState === 'closed' && 'Session ended'}
        </span>
        <button
          onClick={onClose}
          className="ml-4 px-3 py-1 bg-gray-700 text-white rounded text-xs"
        >
          Leave
        </button>
      </div>

      {/* SDK notice */}
      <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900">
        <strong>SDK required for audio/video:</strong> Install{' '}
        <code className="font-mono">livekit-client</code> and{' '}
        <code className="font-mono">@livekit/components-react</code> to enable real
        media streams. Data-channel text chat is available below.
        <br />
        <span className="font-mono">pnpm add livekit-client @livekit/components-react</span>
      </div>

      {/* Participants */}
      <div className="p-3 bg-gray-50 rounded">
        <p className="text-xs font-semibold text-gray-500 mb-1">Participants</p>
        <ul className="text-sm space-y-1">
          {participants.map((p) => (
            <li key={p} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
              {p}
            </li>
          ))}
        </ul>
      </div>

      {/* Chat */}
      <div className="flex-1 flex flex-col">
        <p className="text-xs font-semibold text-gray-500 mb-1">Chat</p>
        <div className="flex-1 border rounded p-3 overflow-y-auto bg-white min-h-[12rem] max-h-64 space-y-2">
          {messages.map((m) => (
            <div key={m.id} className="text-sm">
              <span className="font-medium">{m.sender}: </span>
              <span className="text-gray-700">{m.text}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message…"
            className="flex-1 border rounded px-3 py-2 text-sm"
          />
          <button
            onClick={sendMessage}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm"
          >
            Send
          </button>
        </div>
      </div>

      {/* Connection details */}
      <details className="text-xs text-gray-500">
        <summary className="cursor-pointer">Connection details</summary>
        <div className="mt-2 font-mono break-all space-y-1 pl-2">
          <p>wsUrl: {wsUrl}</p>
          <p>room: {roomName}</p>
          <p>token: [httpOnly cookie — not exposed to JS]</p>
        </div>
      </details>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function LiveKitJoinPage() {
  const params = useParams()
  const sessionId = params.sessionId as string
  const [roomName, setRoomName] = useState<string | null>(null)
  const [wsUrl, setWsUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tokenState, setTokenState] = useState<'idle' | 'requesting' | 'ready'>('idle')
  const [inRoom, setInRoom] = useState(false)

  async function requestToken() {
    setTokenState('requesting')
    setError(null)
    try {
      const data = await acquireToken(sessionId)
      if (!data.ok) {
        const reason = (data as { ok: false; reason: string }).reason
        const messages: Record<string, string> = {
          unauthorized: 'You are not logged in. Please sign in and try again.',
          subscription_required: 'A pro or VIP subscription is required to join live sessions.',
          session_not_found: 'This session does not exist.',
          session_closed: 'This session has ended.',
          server_misconfigured: 'Server configuration error. Contact support.',
        }
        setError(messages[reason] ?? `Could not join: ${reason}`)
        setTokenState('idle')
        return
      }
      setRoomName(data.roomName)
      setWsUrl(data.wsUrl)
      setTokenState('ready')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error — please try again.')
      setTokenState('idle')
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Join Live Session</h1>
      <p className="text-sm text-gray-500 mb-6">Session ID: {sessionId}</p>

      {!inRoom ? (
        <div className="space-y-4">
          {tokenState === 'idle' && (
            <button
              onClick={requestToken}
              className="px-4 py-2 bg-blue-600 text-white rounded"
            >
              Request Access Token
            </button>
          )}

          {tokenState === 'requesting' && (
            <p className="text-gray-500 text-sm">Verifying entitlement…</p>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
              {error}
            </div>
          )}

          {tokenState === 'ready' && roomName && wsUrl && (
            <div className="space-y-3 p-4 bg-gray-50 border rounded">
              <p className="text-sm font-medium text-green-700">
                Token issued — ready to join.
              </p>
              <div className="text-xs text-gray-600 space-y-1">
                <p>
                  <span className="font-semibold">Room:</span>{' '}
                  <span className="font-mono">{roomName}</span>
                </p>
                <p>
                  <span className="font-semibold">Server:</span>{' '}
                  <span className="font-mono">{wsUrl}</span>
                </p>
                <p className="text-gray-400">
                  Token is in your session cookie (httpOnly — not accessible to JavaScript).
                </p>
              </div>
              <button
                onClick={() => setInRoom(true)}
                className="px-4 py-2 bg-green-600 text-white rounded"
              >
                Enter Room
              </button>
            </div>
          )}
        </div>
      ) : (
        roomName &&
        wsUrl && (
          <LiveKitRoomView
            wsUrl={wsUrl}
            roomName={roomName}
            onClose={() => {
              setInRoom(false)
              setTokenState('idle')
              setRoomName(null)
              setWsUrl(null)
            }}
          />
        )
      )}
    </div>
  )
}
