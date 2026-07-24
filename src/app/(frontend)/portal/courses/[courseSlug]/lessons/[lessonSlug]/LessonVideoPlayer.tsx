import { ManagedBunnyVideoPlayer } from '@/components/portal/ManagedBunnyVideoPlayer'

export function LessonVideoPlayer({
  lessonSlug,
  title,
  thumbnailUrl,
  status,
}: {
  lessonSlug: string
  title?: string
  thumbnailUrl?: string | null
  status?: 'processing' | 'ready' | 'failed' | null
}) {
  return (
    <ManagedBunnyVideoPlayer
      knownStatus={status}
      slug={lessonSlug}
      target='lesson'
      thumbnailUrl={thumbnailUrl}
      title={title ?? 'Lesson video'}
    />
  )
}
