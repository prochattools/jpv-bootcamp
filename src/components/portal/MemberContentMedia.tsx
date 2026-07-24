/* eslint-disable @next/next/no-img-element */

import { ManagedBunnyVideoPlayer, type ManagedVideoTarget } from '@/components/portal/ManagedBunnyVideoPlayer'
import type { MemberManagedVideo, MemberMediaAsset } from '@/lib/payloadContent/memberMedia'

function formatFileSize(value: number | null): string | null {
  if (value === null || !Number.isFinite(value) || value < 0) return null
  if (value < 1024) return `${value} B`

  const units = ['KB', 'MB', 'GB'] as const
  let size = value / 1024
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  return `${size >= 10 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`
}

export function MemberFeaturedImage({ asset }: { asset: MemberMediaAsset | null }) {
  if (!asset) return null

  return (
    <figure className='overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100'>
      <img
        alt={asset.alt}
        className='h-auto max-h-[34rem] w-full object-cover'
        height={asset.height ?? undefined}
        loading='eager'
        src={asset.url}
        width={asset.width ?? undefined}
      />
    </figure>
  )
}

export function MemberMediaGallery({ assets }: { assets: MemberMediaAsset[] }) {
  if (assets.length === 0) return null

  return (
    <section aria-labelledby='media-gallery-heading' className='space-y-4'>
      <h2 className='text-xl font-semibold' id='media-gallery-heading'>Gallery</h2>
      <div className='grid gap-4 sm:grid-cols-2'>
        {assets.map((asset) => (
          <figure className='overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100' key={asset.id}>
            <img
              alt={asset.alt}
              className='h-64 w-full object-cover'
              height={asset.height ?? undefined}
              loading='lazy'
              src={asset.url}
              width={asset.width ?? undefined}
            />
          </figure>
        ))}
      </div>
    </section>
  )
}

export function MemberAttachments({ assets }: { assets: MemberMediaAsset[] }) {
  if (assets.length === 0) return null

  return (
    <section aria-labelledby='content-attachments-heading' className='space-y-4'>
      <h2 className='text-xl font-semibold' id='content-attachments-heading'>Downloads</h2>
      <div className='grid gap-3'>
        {assets.map((asset) => {
          const size = formatFileSize(asset.fileSize)
          return (
            <a
              className='flex items-center justify-between gap-4 rounded-xl border border-neutral-200 bg-white px-5 py-4 text-sm hover:border-neutral-400'
              href={asset.url}
              key={asset.id}
            >
              <span>
                <span className='block font-semibold text-neutral-950'>{asset.filename ?? asset.alt}</span>
                {asset.mimeType || size ? (
                  <span className='mt-1 block text-xs text-neutral-500'>
                    {[asset.mimeType, size].filter(Boolean).join(' · ')}
                  </span>
                ) : null}
              </span>
              <span className='font-semibold text-neutral-700'>Download</span>
            </a>
          )
        })}
      </div>
    </section>
  )
}

export function MemberManagedVideoSection({
  target,
  slug,
  video,
}: {
  target: ManagedVideoTarget
  slug: string
  video: MemberManagedVideo | null
}) {
  if (!video) return null

  return (
    <section aria-labelledby='managed-video-heading' className='rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm'>
      <h2 className='text-xl font-semibold' id='managed-video-heading'>{video.title}</h2>
      <ManagedBunnyVideoPlayer
        knownStatus={video.status}
        slug={slug}
        target={target}
        thumbnailUrl={video.thumbnailUrl}
        title={video.title}
      />
    </section>
  )
}
