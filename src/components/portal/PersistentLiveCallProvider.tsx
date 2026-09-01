'use client'

import Link from 'next/link'
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Room } from 'livekit-client'
import { RoomAudioRenderer, RoomContext } from '@livekit/components-react'
import '@livekit/components-styles'

type CallPhase = 'idle' | 'loading' | 'ready' | 'error'

type ActiveCall = {
  sessionId: string
  sessionTitle: string
  roomName: string
  returnHref: string
}

type JoinCallInput = Pick<ActiveCall, 'sessionId' | 'sessionTitle' | 'returnHref'>

type LiveCallContextValue = {
  activeCall: ActiveCall | null
  error: string | null
  joinCall: (input: JoinCallInput) => Promise<void>
  leaveCall: () => Promise<void>
  phase: CallPhase
  setStageVisible: (visible: boolean) => void
}

const LiveCallContext = createContext<LiveCallContextValue | null>(null)

function errorReason(data: { reason?: string }): string {
  switch (data.reason) {
    case 'session_not_live': return 'This call has not started yet. Refresh when the host opens the room.'
    case 'session_closed': return 'This call has ended.'
    case 'room_archived': return 'This Room has been archived.'
    case 'not_entitled': return 'You do not have access to this call. Check your Room membership.'
    case 'unauthorized': return 'Sign in to join this call.'
    case 'server_misconfigured': return 'Live calls are not configured on this server. Contact support.'
    default: return data.reason ? `Could not join: ${data.reason}. Please try again.` : 'Could not join the call. Please try again.'
  }
}

export function usePersistentLiveCall(): LiveCallContextValue {
  const context = useContext(LiveCallContext)
  if (!context) throw new Error('usePersistentLiveCall must be used inside PersistentLiveCallProvider.')
  return context
}

export function PersistentLiveCallProvider({ children }: { children: ReactNode }) {
  const room = useMemo(() => new Room(), [])
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null)
  const [phase, setPhase] = useState<CallPhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [stageVisible, setStageVisible] = useState(false)

  const leaveCall = useCallback(async () => {
    await room.disconnect()
    setActiveCall(null)
    setError(null)
    setPhase('idle')
  }, [room])

  const joinCall = useCallback(async ({ sessionId, sessionTitle, returnHref }: JoinCallInput) => {
    if (phase === 'ready' && activeCall?.sessionId === sessionId) return
    if (phase === 'loading') return

    if (activeCall) await room.disconnect()
    setError(null)
    setPhase('loading')
    try {
      const response = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
        credentials: 'include',
      })
      const data: { ok: boolean; token?: string; wsUrl?: string; roomName?: string; reason?: string } = await response.json()
      if (!data.ok || !data.token || !data.wsUrl || !data.roomName) {
        setError(errorReason(data))
        setPhase('error')
        return
      }

      await room.connect(data.wsUrl, data.token)
      setActiveCall({ sessionId, sessionTitle, roomName: data.roomName, returnHref })
      setPhase('ready')
    } catch {
      setError('Could not connect to the call. Check your connection and try again.')
      setPhase('error')
    }
  }, [activeCall, phase, room])

  useEffect(() => () => { void room.disconnect() }, [room])

  const value = useMemo<LiveCallContextValue>(() => ({
    activeCall,
    error,
    joinCall,
    leaveCall,
    phase,
    setStageVisible,
  }), [activeCall, error, joinCall, leaveCall, phase])

  return (
    <LiveCallContext.Provider value={value}>
      <RoomContext.Provider value={room}>
        <div data-lk-theme='default'>
          {children}
          {phase === 'ready' ? <RoomAudioRenderer /> : null}
          {activeCall && !stageVisible ? (
            <aside className='fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-jpv-card border border-jpv-border bg-jpv-canvas px-4 py-3 shadow-jpv-card' data-live-call-persistent='true'>
              <div className='min-w-0'>
                <p className='text-xs font-bold uppercase tracking-wide text-jpv-brand'>Call still active</p>
                <p className='truncate text-sm font-semibold text-jpv-ink'>{activeCall.sessionTitle}</p>
              </div>
              <Link className='jpv-button-secondary shrink-0 px-3 py-2 text-xs' href={activeCall.returnHref}>Return</Link>
              <button className='jpv-button-primary shrink-0 bg-red-700 px-3 py-2 text-xs hover:bg-red-800' onClick={() => { void leaveCall() }} type='button'>Leave</button>
            </aside>
          ) : null}
        </div>
      </RoomContext.Provider>
    </LiveCallContext.Provider>
  )
}
