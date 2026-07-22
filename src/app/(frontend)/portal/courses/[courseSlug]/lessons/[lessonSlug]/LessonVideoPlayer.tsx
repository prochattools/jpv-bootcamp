'use client'

import { useEffect, useRef, useState } from 'react'

type VideoState =
  | { status: 'loading' }
  | { status: 'ready'; url: string }
  | { status: 'no_video' }
  | { status: 'not_entitled' }
  | { status: 'unauthorized' }
  | { status: 'error'; message: string }

export function LessonVideoPlayer({ lessonSlug }: { lessonSlug: string }) {
  const [state, setState] = useState<VideoState>({ status: 'loading' })
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchVideoUrl() {
      try {
        const res = await fetch(`/api/bunny/video?lessonId=${encodeURIComponent(lessonSlug)}`)
        if (cancelled) return

        const data = await res.json()

        if (data.ok) {
          setState({ status: 'ready', url: data.url as string })
        } else {
          const reason = (data.reason as string) ?? 'unknown'
          if (reason === 'no_video_linked' || reason === 'missing_video_id') {
            setState({ status: 'no_video' })
          } else if (reason === 'not_entitled') {
            setState({ status: 'not_entitled' })
          } else if (reason === 'unauthorized') {
            setState({ status: 'unauthorized' })
          } else {
            setState({ status: 'error', message: reason })
          }
        }
      } catch {
        if (!cancelled) {
          setState({ status: 'error', message: 'network_error' })
        }
      }
    }

    void fetchVideoUrl()
    return () => {
      cancelled = true
    }
  }, [lessonSlug])

  if (state.status === 'loading') {
    return (
      <div className='mt-5 flex h-48 items-center justify-center rounded-xl bg-neutral-100'>
        <p className='text-sm text-neutral-500'>Loading video…</p>
      </div>
    )
  }

  if (state.status === 'no_video') {
    return (
      <p className='mt-4 text-sm text-neutral-600'>No video available for this lesson.</p>
    )
  }

  if (state.status === 'not_entitled') {
    return (
      <div className='mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3'>
        <p className='text-sm font-semibold text-amber-800'>Upgrade required</p>
        <p className='mt-1 text-sm text-amber-700'>
          You need an active enrollment to watch this lesson.
        </p>
      </div>
    )
  }

  if (state.status === 'unauthorized') {
    return (
      <div className='mt-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3'>
        <p className='text-sm font-semibold text-neutral-800'>Please log in</p>
        <p className='mt-1 text-sm text-neutral-600'>
          You must be signed in to watch lesson videos.
        </p>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <p className='mt-4 text-sm text-neutral-600'>
        Video unavailable. Please try refreshing the page.
      </p>
    )
  }

  // state.status === 'ready'
  return (
    <div className='mt-5 overflow-hidden rounded-xl bg-black'>
      <video
        ref={videoRef}
        className='w-full'
        controls
        playsInline
        src={state.url}
        aria-label='Lesson video'
      />
    </div>
  )
}
