export type CommunityVideoProvider = 'bunny' | 'youtube' | 'vimeo'

export type CommunityVideoEmbed = {
  provider: CommunityVideoProvider
  src: string
}

export function safeCommunityExternalUrl(value: string): string | null {
  if (!value || value.length > 2048) return null

  try {
    const url = new URL(value)
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password) {
      return null
    }
    return url.toString()
  } catch {
    return null
  }
}

function safeVideoId(value: string | null, pattern: RegExp): string | null {
  return value && pattern.test(value) ? value : null
}

function youtubeEmbed(value: URL): CommunityVideoEmbed | null {
  const hostname = value.hostname.toLowerCase()
  let videoId: string | null = null

  if (hostname === 'youtu.be') {
    videoId = value.pathname.split('/').filter(Boolean)[0] ?? null
  } else if (hostname === 'youtube.com' || hostname === 'www.youtube.com' || hostname === 'youtube-nocookie.com' || hostname === 'www.youtube-nocookie.com') {
    if (value.pathname === '/watch') videoId = value.searchParams.get('v')
    else videoId = /^\/(?:shorts|embed|live)\/([^/]+)$/i.exec(value.pathname)?.[1] ?? null
  }

  const safeId = safeVideoId(videoId, /^[A-Za-z0-9_-]{6,64}$/)
  return safeId
    ? { provider: 'youtube', src: `https://www.youtube-nocookie.com/embed/${safeId}` }
    : null
}

function vimeoEmbed(value: URL): CommunityVideoEmbed | null {
  const hostname = value.hostname.toLowerCase()
  if (hostname !== 'vimeo.com' && hostname !== 'www.vimeo.com' && hostname !== 'player.vimeo.com') {
    return null
  }

  const videoId = hostname === 'player.vimeo.com'
    ? /^\/video\/(\d+)$/i.exec(value.pathname)?.[1] ?? null
    : /^\/(\d+)$/i.exec(value.pathname)?.[1] ?? null

  return videoId && /^\d{4,16}$/.test(videoId)
    ? { provider: 'vimeo', src: `https://player.vimeo.com/video/${videoId}` }
    : null
}

function bunnyEmbed(value: URL): CommunityVideoEmbed | null {
  const hostname = value.hostname.toLowerCase()
  if (hostname !== 'player.mediadelivery.net' && hostname !== 'iframe.mediadelivery.net') return null
  if (!/^\/embed\/\d+\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/?$/i.test(value.pathname)) {
    return null
  }

  return {
    provider: 'bunny',
    src: `https://${hostname}${value.pathname.replace(/\/$/, '')}`,
  }
}

/**
 * Returns an embed URL only for providers with a known, constrained URL
 * format. Unknown video hosts remain ordinary clickable links.
 */
export function safeCommunityVideoEmbed(value: string): CommunityVideoEmbed | null {
  const safeUrl = safeCommunityExternalUrl(value)
  if (!safeUrl) return null

  const url = new URL(safeUrl)
  return bunnyEmbed(url) ?? youtubeEmbed(url) ?? vimeoEmbed(url)
}
