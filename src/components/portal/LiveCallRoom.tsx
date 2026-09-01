'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { VideoConference } from '@livekit/components-react'

import { LiveSessionState } from '@/components/portal/LiveSessionState'
import { usePersistentLiveCall } from '@/components/portal/PersistentLiveCallProvider'

type Props = {
  sessionId: string
  sessionTitle: string
}

function SpinnerIcon() {
  return <span aria-hidden='true' className='inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none' />
}

function CallStage({ roomName, sessionTitle }: { roomName: string; sessionTitle: string }) {
  const { leaveCall } = usePersistentLiveCall()
  return (
    <div className='flex flex-col gap-4'>
      <div className='flex items-center justify-between rounded-xl border border-jpv-border bg-jpv-canvas px-5 py-3'>
        <span className='text-sm font-semibold text-jpv-ink'>{sessionTitle}</span>
        <LiveSessionState compact status='live' />
      </div>
      <div className='jpv-livekit-shell overflow-hidden rounded-jpv-panel border border-jpv-border bg-neutral-900'>
        <VideoConference />
      </div>
      <div className='rounded-jpv-card bg-jpv-surface p-4 text-xs leading-5 text-jpv-muted'>
        <p><span className='font-semibold text-jpv-ink'>Connected to:</span> {roomName}</p>
        <p className='mt-1'>You can keep this call active while navigating the member portal. Use Leave to end your connection.</p>
        <button className='jpv-button-secondary mt-3 px-3 py-2 text-xs' onClick={() => { void leaveCall() }} type='button'>Leave call</button>
      </div>
    </div>
  )
}

export default function LiveCallRoom({ sessionId, sessionTitle }: Props) {
  const pathname = usePathname()
  const { activeCall, error, joinCall, phase, setStageVisible } = usePersistentLiveCall()
  const isThisCallActive = phase === 'ready' && activeCall?.sessionId === sessionId

  useEffect(() => {
    if (!isThisCallActive) return
    setStageVisible(true)
    return () => setStageVisible(false)
  }, [isThisCallActive, setStageVisible])

  if (isThisCallActive && activeCall) return <CallStage roomName={activeCall.roomName} sessionTitle={sessionTitle} />

  const anotherCallIsActive = phase === 'ready' && activeCall && activeCall.sessionId !== sessionId
  return (
    <div className='space-y-4'>
      {error ? <div aria-live='assertive' className='jpv-notice jpv-notice-danger text-sm' role='alert'><p className='font-semibold text-jpv-ink'>Could not join the call</p><p className='mt-1 text-jpv-muted'>{error}</p></div> : null}
      {anotherCallIsActive ? <div className='jpv-notice text-sm'><p className='font-semibold text-jpv-ink'>Another call is active</p><p className='mt-1 text-jpv-muted'>Leave the active call before joining another Room.</p></div> : null}
      <div className='rounded-jpv-card bg-jpv-surface p-5 sm:p-6'>
        <h2 className='text-base font-semibold text-jpv-ink'>Before you join</h2>
        <ul className='mt-3 space-y-2 text-sm leading-6 text-jpv-muted'><li>Use a stable internet connection and headphones when possible.</li><li>Allow browser microphone and camera access when prompted.</li><li>You can choose whether to enable your camera inside the room.</li></ul>
      </div>
      <div className='flex flex-col items-center gap-3 py-2'>
        <button className='jpv-button-primary min-h-[52px] w-full rounded-xl px-8 text-base font-semibold sm:w-auto sm:min-w-[200px]' disabled={phase === 'loading' || Boolean(anotherCallIsActive)} onClick={() => { void joinCall({ sessionId, sessionTitle, returnHref: pathname }) }} type='button'>
          {phase === 'loading' ? <span className='inline-flex items-center gap-2'><SpinnerIcon /> Connecting…</span> : error ? 'Try again' : 'Join call'}
        </button>
        <p className='text-xs text-jpv-muted'>Your browser will request camera and microphone access when you join.</p>
      </div>
    </div>
  )
}
