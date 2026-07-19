import { createHash } from 'node:crypto'

import { evaluateMembershipEntitlement, type MembershipEntitlementInput } from '@/lib/entitlements/membershipEntitlement'

export type BunnyProcessingStatus = 'processing' | 'ready' | 'failed'

export type BunnyProtectedVideo = {
  provider: 'bunny_stream'
  videoId: string
  libraryId: string
  lessonId: string
  title: string
  playbackAssetId: string
  thumbnailUrl: string | null
  status: BunnyProcessingStatus
  diagnostics?: Record<string, unknown>
}

export type BunnyProtectedPlaybackRequest = {
  provider: 'bunny_stream'
  libraryId: string
  videoId: string
  lessonId: string
  expiresAt: string
  /** Bunny iframe embed URL with signed token and expires params */
  iframeUrl: string
  /** Signed hex token — SHA256(signingKey + videoId + expiresUnix) */
  token: string
  expiresUnix: number
}

export type BunnyProtectedMediaConfig = {
  streamHostname?: string | null
  signingKey?: string | null
  tokenTtlSeconds?: number | null
}

export type BunnyProtectedMediaAdapter = {
  getVideo(lessonId: string): Promise<BunnyProtectedVideo | null>
  buildPlaybackRequest(input: {
    video: BunnyProtectedVideo
    memberId: string
    now: Date
    expiresAt: Date
  }): Promise<BunnyProtectedPlaybackRequest>
}

export type BunnyPublicVideoProjection =
  | {
      available: true
      provider: 'bunny_stream'
      status: 'ready'
      lessonId: string
      videoId: string
      libraryId: string
      playbackAssetId: string
      thumbnailUrl: string | null
      expiresAt: string
      expiresUnix: number
      /** Bunny iframe embed URL — ready to drop into an <iframe src=…> */
      iframeUrl: string
      /** Raw hex token — SHA256(signingKey + videoId + expiresUnix) */
      token: string
    }
  | {
      available: false
      provider: 'bunny_stream'
      status: 'processing' | 'failed' | 'missing' | 'expired' | 'denied' | 'misconfigured'
      lessonId?: string
      diagnostics?: Record<string, unknown>
    }

export function redactBunnyDiagnostics(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      if (/secret|token|key|password|credential/i.test(key)) return [key, '[redacted]']
      return [key, entry]
    }),
  )
}

export function resolveBunnyProtectedMediaConfig(
  config: BunnyProtectedMediaConfig,
): { ok: true; ttlSeconds: number } | { ok: false; diagnostics: Record<string, unknown> } {
  const diagnostics = redactBunnyDiagnostics({
    streamHostname: config.streamHostname ? 'configured' : 'missing',
    signingKey: config.signingKey ? 'configured' : 'missing',
    tokenTtlSeconds: config.tokenTtlSeconds ?? null,
  })

  if (!config.streamHostname || !config.signingKey) return { ok: false, diagnostics }

  return {
    ok: true,
    ttlSeconds: config.tokenTtlSeconds && config.tokenTtlSeconds > 0 ? config.tokenTtlSeconds : 900,
  }
}

export class InMemoryBunnyProtectedMediaAdapter implements BunnyProtectedMediaAdapter {
  private readonly videos: BunnyProtectedVideo[]
  private readonly signingKey: string

  constructor(args: { videos: BunnyProtectedVideo[]; signingKey: string }) {
    this.videos = args.videos
    this.signingKey = args.signingKey
  }

  async getVideo(lessonId: string): Promise<BunnyProtectedVideo | null> {
    return this.videos.find((video) => video.lessonId === lessonId) ?? null
  }

  async buildPlaybackRequest(input: {
    video: BunnyProtectedVideo
    memberId: string
    now: Date
    expiresAt: Date
  }): Promise<BunnyProtectedPlaybackRequest> {
    const expiresUnix = Math.floor(input.expiresAt.getTime() / 1000)
    // Bunny iframe embed token: SHA256(signingKey + videoId + expiresUnix)
    const token = createHash('sha256')
      .update(this.signingKey + input.video.videoId + String(expiresUnix))
      .digest('hex')
    const iframeUrl =
      `https://iframe.mediadelivery.net/embed/${input.video.libraryId}/${input.video.videoId}` +
      `?token=${token}&expires=${expiresUnix}`

    return {
      provider: 'bunny_stream',
      libraryId: input.video.libraryId,
      videoId: input.video.videoId,
      lessonId: input.video.lessonId,
      expiresAt: input.expiresAt.toISOString(),
      iframeUrl,
      token,
      expiresUnix,
    }
  }
}

export async function resolveBunnyProtectedPlayback(input: {
  adapter: BunnyProtectedMediaAdapter
  config: BunnyProtectedMediaConfig
  lessonId: string
  memberId: string
  entitlement: MembershipEntitlementInput
  now?: Date | string
}): Promise<BunnyPublicVideoProjection> {
  const now = input.now instanceof Date ? input.now : new Date(input.now ?? Date.now())
  const config = resolveBunnyProtectedMediaConfig(input.config)
  if ('diagnostics' in config) {
    return { available: false, provider: 'bunny_stream', status: 'misconfigured', lessonId: input.lessonId, diagnostics: config.diagnostics }
  }

  const entitlement = evaluateMembershipEntitlement({ ...input.entitlement, now })
  if (entitlement.decision !== 'allowed' && entitlement.decision !== 'billing_hold') {
    return {
      available: false,
      provider: 'bunny_stream',
      status: 'denied',
      lessonId: input.lessonId,
      diagnostics: { entitlementReason: entitlement.reason },
    }
  }

  const video = await input.adapter.getVideo(input.lessonId)
  if (!video) return { available: false, provider: 'bunny_stream', status: 'missing', lessonId: input.lessonId }
  if (video.lessonId !== input.lessonId) {
    return { available: false, provider: 'bunny_stream', status: 'denied', lessonId: input.lessonId }
  }
  if (video.status !== 'ready') {
    return {
      available: false,
      provider: 'bunny_stream',
      status: video.status,
      lessonId: input.lessonId,
      diagnostics: redactBunnyDiagnostics(video.diagnostics ?? {}),
    }
  }

  const expiresAt = new Date(now.getTime() + config.ttlSeconds * 1000)
  const request = await input.adapter.buildPlaybackRequest({
    video,
    memberId: input.memberId,
    now,
    expiresAt,
  })

  if (request.lessonId !== input.lessonId || new Date(request.expiresAt).getTime() <= now.getTime()) {
    return { available: false, provider: 'bunny_stream', status: 'expired', lessonId: input.lessonId }
  }

  return {
    available: true,
    provider: 'bunny_stream',
    status: 'ready',
    lessonId: video.lessonId,
    videoId: video.videoId,
    libraryId: video.libraryId,
    playbackAssetId: video.playbackAssetId,
    thumbnailUrl: video.thumbnailUrl,
    expiresAt: request.expiresAt,
    expiresUnix: request.expiresUnix,
    iframeUrl: request.iframeUrl,
    token: request.token,
  }
}
