'use client'

import { useState } from 'react'

type ContentCardImageProps = {
  src: string
  alt: string
  height?: number | null
  width?: number | null
}

export function ContentCardImage({ src, alt, height, width }: ContentCardImageProps) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div
        aria-label={alt || 'Image unavailable'}
        className='flex h-52 w-full items-center justify-center bg-jpv-surface text-sm text-jpv-muted'
        role='img'
      >
        No image
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={alt}
      className='h-52 w-full object-cover'
      height={height ?? undefined}
      loading='lazy'
      onError={() => setFailed(true)}
      src={src}
      width={width ?? undefined}
    />
  )
}
