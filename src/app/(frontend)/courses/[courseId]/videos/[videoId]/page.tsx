'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface VideoMetadata {
  title: string
  duration?: number
  status: 'processing' | 'ready' | 'failed'
  thumbnailUrl?: string
  errorMessage?: string
}

export default function BunnyVideoPage() {
  const params = useParams()
  const videoId = params.videoId as string
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadVideo() {
      try {
        // In a real implementation, this would call an API endpoint
        // For now, we'll show a placeholder
        setMetadata({
          title: `Video ${videoId}`,
          status: 'processing',
          duration: 0,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load video')
      } finally {
        setLoading(false)
      }
    }
    loadVideo()
  }, [videoId])

  if (loading) return <div className="p-8" role="status" aria-live="polite">Loading video...</div>
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>
  if (!metadata) return <div className="p-8">No video found</div>

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">{metadata.title}</h1>

      <div className="space-y-4">
        <div className="bg-gray-200 aspect-video rounded flex items-center justify-center">
          {metadata.status === 'processing' && (
            <div className="text-center">
              <p className="text-lg font-medium mb-2">Processing Video</p>
              <p className="text-sm text-gray-600">This video is being transcoded. Please check back soon.</p>
            </div>
          )}
          {metadata.status === 'ready' && (
            <div className="text-center">
              <p className="text-lg font-medium mb-2">Video Ready</p>
              <p className="text-sm text-gray-600">Bunny Stream player would load here</p>
            </div>
          )}
          {metadata.status === 'failed' && (
            <div className="text-center text-red-600">
              <p className="text-lg font-medium mb-2">Video Failed</p>
              <p className="text-sm">{metadata.errorMessage}</p>
            </div>
          )}
        </div>

        <div className="space-y-2 p-4 bg-gray-50 rounded">
          <div>
            <p className="text-sm font-medium">Status</p>
            <p className="text-sm">{metadata.status.toUpperCase()}</p>
          </div>
          {metadata.duration && (
            <div>
              <p className="text-sm font-medium">Duration</p>
              <p className="text-sm">{Math.round(metadata.duration / 60)} minutes</p>
            </div>
          )}
          <p className="text-xs text-gray-600 mt-4">
            Video ID: {videoId}
          </p>
        </div>
      </div>
    </div>
  )
}
