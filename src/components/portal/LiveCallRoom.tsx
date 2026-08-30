'use client'

import { useCallback, useState } from 'react'
import { LiveKitRoom, VideoConference, RoomAudioRenderer } from '@livekit/components-react'
import '@livekit/components-styles'

import { LiveSessionState } from '@/components/portal/LiveSessionState'

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
      className='h-5 w-5 animate-spin motion-reduce:animate-none'
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
        <LiveSessionState compact status='live' />
      </div>

      <div className='jpv-livekit-shell overflow-hidden rounded-jpv-panel border border-jpv-border bg-neutral-900'>
        <LiveKitRoom
          serverUrl={wsUrl}
          token={token}
          connect={true}
          audio={true}
          video={true}
          data-lk-theme='default'
          className='h-full w-full'
        >
          <VideoConference />
          <RoomAudioRenderer />
        </LiveKitRoom>
      </div>

      <div className='rounded-jpv-card bg-jpv-surface p-4 text-xs leading-5 text-jpv-muted'>
        <p>
          <span className='font-semibold text-jpv-ink'>Connected to:</span> {roomName}
        </p>
        <p className='mt-1'>
          Use the room controls for your microphone and camera. Leaving this page disconnects you from the call.
        </p>
      </div>
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
    if (reason === 'room_archived') return 'This Room has been archived.'
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
      <div
        aria-live='polite'
        className='flex flex-col items-center gap-4 py-8 text-center'
        role='status'
      >
        <SpinnerIcon />
        <p className='text-sm font-medium text-jpv-muted'>Connecting…</p>
        <p className='text-xs text-jpv-muted'>Your browser will request camera and microphone access.</p>
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      {state.phase === 'error' && (
        <div aria-live='assertive' className='jpv-notice jpv-notice-danger text-sm' role='alert'>
          <p className='font-semibold text-jpv-ink'>Could not join the call</p>
          <p className='mt-1 text-jpv-muted'>{errorMessage(state.reason)}</p>
        </div>
      )}

      <div className='rounded-jpv-card bg-jpv-surface p-5 sm:p-6'>
        <h2 className='text-base font-semibold text-jpv-ink'>Before you join</h2>
        <ul className='mt-3 space-y-2 text-sm leading-6 text-jpv-muted'>
          <li>Use a stable internet connection and headphones when possible.</li>
          <li>Allow browser microphone and camera access when prompted.</li>
          <li>You can choose whether to enable your camera inside the room.</li>
        </ul>
      </div>

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
