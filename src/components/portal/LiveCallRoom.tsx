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

function SpinnerIcon() {
  return (
    <svg
      aria-hidden='true'
      className='h-5 w-5 animate-spin'
      fill='none'
      viewBox='0 0 24 24'
    >
      <circle
        className='opacity-25'
        cx='12'
        cy='12'
        r='10'
        stroke='currentColor'
        strokeWidth='4'
      />
      <path
        className='opacity-75'
        d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
        fill='currentColor'
      />
    </svg>
  )
}

function CallStage({ token, wsUrl, roomName, sessionTitle }: {
  token: string
  wsUrl: string
  roomName: string
  sessionTitle: string
}) {
  return (
    <div className='flex flex-col gap-4'>
      <div className='flex items-center justify-between rounded-xl border border-jpv-border bg-jpv-canvas px-5 py-3'>
        <span className='text-sm font-semibold text-jpv-ink'>{sessionTitle}</span>
        <span className='inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800'>
          <span className='relative flex h-2 w-2'>
            <span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75' />
            <span className='relative inline-flex h-2 w-2 rounded-full bg-green-500' />
          </span>
          Live now
        </span>
      </div>

      <div
        className='overflow-hidden rounded-jpv-panel border border-jpv-border bg-neutral-900'
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

  if (state.phase === 'loading') {
    return (
      <div className='flex flex-col items-center gap-4 py-8 text-center'>
        <SpinnerIcon />
        <p className='text-sm font-medium text-jpv-muted'>Connecting…</p>
        <p className='text-xs text-jpv-muted'>Your browser will request camera and microphone access.</p>
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      {state.phase === 'error' && (
        <div className='jpv-notice jpv-notice-danger text-sm'>
          {errorMessage(state.reason)}
        </div>
      )}

      <div className='flex flex-col items-center gap-3 py-2'>
        <button
          className='jpv-button-primary min-h-[52px] w-full rounded-xl px-8 text-base font-semibold sm:w-auto sm:min-w-[200px]'
          disabled={false}
          onClick={joinCall}
          type='button'
        >
          {state.phase === 'error' ? 'Try again' : 'Join call'}
        </button>

        <p className='text-xs text-jpv-muted'>
          Your browser will request camera and microphone access when you join.
        </p>
      </div>
    </div>
  )
}
