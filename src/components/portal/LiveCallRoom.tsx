'use client'

import { useEffect, useState, useCallback } from 'react'
import { LiveKitRoom, VideoConference, RoomAudioRenderer } from '@livekit/components-react'
import '@livekit/components-styles'

type TokenState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'ready'; token: string; wsUrl: string; roomName: string }
  | { phase: 'error'; reason: string }

type Props = {
  sessionId: string
  sessionTitle: string
}

function CallStage({ token, wsUrl, roomName, sessionTitle }: {
  token: string
  wsUrl: string
  roomName: string
  sessionTitle: string
}) {
  return (
    <div className='flex flex-col gap-4'>
      <div className='flex items-center justify-between rounded-jpv-card border border-jpv-border bg-jpv-canvas px-5 py-3'>
        <span className='text-sm font-semibold text-jpv-ink'>{sessionTitle}</span>
        <span className='rounded-jpv-pill bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700'>
          Live now
        </span>
      </div>

      <div
        className='overflow-hidden rounded-jpv-panel border border-jpv-border bg-black'
        style={{ minHeight: '480px' }}
      >
        <LiveKitRoom
          serverUrl={wsUrl}
          token={token}
          connect={true}
          audio={true}
          video={false}
          data-lk-theme='default'
          className='h-full'
        >
          <VideoConference />
          <RoomAudioRenderer />
        </LiveKitRoom>
      </div>

      <p className='text-xs text-jpv-muted'>
        Room: {roomName} · Camera and microphone access required · Leave the page to disconnect
      </p>
    </div>
  )
}

export default function LiveCallRoom({ sessionId, sessionTitle }: Props) {
  const [state, setState] = useState<TokenState>({ phase: 'idle' })

  const joinCall = useCallback(async () => {
    setState({ phase: 'loading' })
    try {
      const res = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
        credentials: 'include',
      })
      const data: { ok: boolean; token?: string; wsUrl?: string; roomName?: string; reason?: string } = await res.json()
      if (!data.ok || !data.token || !data.wsUrl || !data.roomName) {
        const reason = data.reason ?? 'unknown_error'
        setState({ phase: 'error', reason })
        return
      }
      setState({ phase: 'ready', token: data.token, wsUrl: data.wsUrl, roomName: data.roomName })
    } catch {
      setState({ phase: 'error', reason: 'network_error' })
    }
  }, [sessionId])

  function errorMessage(reason: string): string {
    if (reason === 'session_not_live') return 'This call has not started yet. Refresh when the host opens the room.'
    if (reason === 'session_closed') return 'This call has ended.'
    if (reason === 'not_entitled') return 'You do not have access to this call. Check your space membership.'
    if (reason === 'unauthorized') return 'Sign in to join this call.'
    if (reason === 'server_misconfigured') return 'Live calls are not configured on this server. Contact support.'
    return `Could not join: ${reason}. Please try again.`
  }

  if (state.phase === 'ready') {
    return <CallStage token={state.token} wsUrl={state.wsUrl} roomName={state.roomName} sessionTitle={sessionTitle} />
  }

  return (
    <div className='space-y-4'>
      {state.phase === 'error' && (
        <div className='rounded-jpv-card border border-red-200 bg-red-50 p-4 text-sm text-red-700'>
          {errorMessage(state.reason)}
        </div>
      )}

      <button
        className='jpv-button-primary min-h-11 w-full sm:w-auto'
        disabled={state.phase === 'loading'}
        onClick={joinCall}
        type='button'
      >
        {state.phase === 'loading' ? 'Connecting…' : 'Join call'}
      </button>

      <p className='text-xs text-jpv-muted'>
        Your browser will request camera and microphone access when you join.
      </p>
    </div>
  )
}
