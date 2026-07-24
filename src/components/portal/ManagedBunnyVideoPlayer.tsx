'use client'

import { useEffect, useState } from 'react'

export type ManagedVideoTarget = 'lesson' | 'page' | 'post'

type VideoState =
  | { status: 'loading' }
  | { status: 'ready'; url: string }
  | { status: 'no_video' }
  | { status: 'processing' }
  | { status: 'not_entitled' }
  | { status: 'unauthorized' }
  | { status: 'error' }

const QUERY_KEYS: Record<ManagedVideoTarget, string> = {
  lesson: 'lessonId',
  page: 'pageSlug',
  post: 'postSlug',
}

export function ManagedBunnyVideoPlayer({
  target,
  slug,
  title = 'Video',
  thumbnailUrl,
  knownStatus,
}: {
  target: ManagedVideoTarget
  slug: string
  title?: string
  thumbnailUrl?: string | null
  knownStatus?: 'processing' | 'ready' | 'failed' | null
}) {
  const [state, setState] = useState<VideoState>(() => {
    if (knownStatus === 'processing') return { status: 'processing' }
    if (knownStatus === 'failed') return { status: 'error' }
    return { status: 'loading' }
  })

  useEffect(() => {
    if (knownStatus === 'processing' || knownStatus === 'failed') return

    let cancelled = false

    async function fetchVideoUrl() {
      try {
        const query = new URLSearchParams({ [QUERY_KEYS[target]]: slug })
        const response = await fetch(`/api/bunny/video?${query.toString()}`)
        const data = (await response.json()) as { ok?: boolean; url?: string; reason?: string }
        if (cancelled) return

        if (data.ok && typeof data.url === 'string') {
          setState({ status: 'ready', url: data.url })
          return
        }

        switch (data.reason) {
          case 'no_video_linked':
          case 'missing_video_id':
          case 'content_not_found':
            setState({ status: 'no_video' })
            break
          case 'video_not_ready':
            setState({ status: 'processing' })
            break
          case 'not_entitled':
            setState({ status: 'not_entitled' })
            break
          case 'unauthorized':
            setState({ status: 'unauthorized' })
            break
          default:
            setState({ status: 'error' })
        }
      } catch {
        if (!cancelled) setState({ status: 'error' })
      }
    }

    void fetchVideoUrl()
    return () => {
      cancelled = true
    }
  }, [knownStatus, slug, target])

  if (state.status === 'loading') {
    return <p className='mt-4 text-sm text-neutral-500'>Loading video…</p>
  }

  if (state.status === 'no_video') return null

  if (state.status === 'processing') {
    return (
      <div className='mt-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3'>
        <p className='text-sm font-semibold text-blue-900'>Video processing</p>
        <p className='mt-1 text-sm text-blue-800'>This video will appear when Bunny finishes processing it.</p>
      </div>
    )
  }

  if (state.status === 'not_entitled') {
    return (
      <div className='mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3'>
        <p className='text-sm font-semibold text-amber-900'>Membership required</p>
        <p className='mt-1 text-sm text-amber-800'>Your account does not currently include this video.</p>
      </div>
    )
  }

  if (state.status === 'unauthorized') {
    return <p className='mt-4 text-sm text-neutral-600'>Sign in to watch this video.</p>
  }

  if (state.status === 'error') {
    return <p className='mt-4 text-sm text-neutral-600'>Video unavailable. Please try again later.</p>
  }

  return (
    <div className='mt-5 overflow-hidden rounded-xl bg-black'>
      <video
        aria-label={title}
        className='w-full'
        controls
        playsInline
        poster={thumbnailUrl ?? undefined}
        src={state.url}
      />
    </div>
  )
}
