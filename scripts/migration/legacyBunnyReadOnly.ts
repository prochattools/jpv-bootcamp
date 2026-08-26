import type { BunnyInventoryFile, BunnyInventoryVideo } from './legacySourceDryRun'

export interface LegacyBunnyReadConfig {
  apiKey: string
  libraryId: string
}

export interface BunnyVideoDetail {
  videoLibraryId: number
  guid: string
  title: string
  status: number
  dateUploaded?: string
  storageSize?: number
  views?: number
  isPublic?: boolean
  length?: number
  framerate?: number
  width?: number
  height?: number
  outputCodecs?: string
  thumbnailUrl?: string | null
}

export interface VerifiedBunnyInventory extends BunnyInventoryFile {
  verification?: {
    mode: 'read_only_guid'
    verified_guids: number
    failed_videos_skipped: number
  }
}

export function readLegacyBunnyConfigFromEnv(env: NodeJS.ProcessEnv = process.env): LegacyBunnyReadConfig {
  const apiKey = (env.BUNNY_API_KEY || env.BUNNY_STREAM_API_KEY || '').trim()
  const libraryId = (env.BUNNY_LIBRARY_ID || env.BUNNY_STREAM_LIBRARY_ID || '').trim()
  if (!apiKey || !libraryId) {
    throw new Error('BUNNY_READ_CONFIG_MISSING provide BUNNY_API_KEY/BUNNY_LIBRARY_ID or BUNNY_STREAM_API_KEY/BUNNY_STREAM_LIBRARY_ID')
  }
  return { apiKey, libraryId }
}

export async function fetchLegacyBunnyVideoDetail(
  config: LegacyBunnyReadConfig,
  videoGuid: string,
  fetchImpl: typeof fetch = fetch,
): Promise<BunnyVideoDetail> {
  const url = `https://video.bunnycdn.com/library/${encodeURIComponent(config.libraryId)}/videos/${encodeURIComponent(videoGuid)}`
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: { AccessKey: config.apiKey },
  })
  if (!response.ok) {
    throw new Error(`BUNNY_READ_FAILED guid=${videoGuid} status=${response.status}`)
  }
  const body = await response.json() as Partial<BunnyVideoDetail>
  if (typeof body.guid !== 'string' || !Number.isInteger(body.videoLibraryId)) {
    throw new Error(`BUNNY_READ_RESPONSE_INVALID guid=${videoGuid}`)
  }
  if (body.guid.toLowerCase() !== videoGuid.toLowerCase()) {
    throw new Error(`BUNNY_READ_GUID_MISMATCH expected=${videoGuid} actual=${body.guid}`)
  }
  if (String(body.videoLibraryId) !== config.libraryId) {
    throw new Error(`BUNNY_READ_LIBRARY_MISMATCH expected=${config.libraryId} actual=${body.videoLibraryId}`)
  }
  return body as BunnyVideoDetail
}

export async function verifyBunnyInventoryGuids(
  inventory: BunnyInventoryFile,
  config: LegacyBunnyReadConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<VerifiedBunnyInventory> {
  const videos: BunnyInventoryVideo[] = []
  let verifiedGuids = 0
  let failedVideosSkipped = 0

  for (const source of inventory.videos ?? []) {
    if (source.status === 'failed') {
      failedVideosSkipped += 1
      videos.push(source)
      continue
    }

    const detail = await fetchLegacyBunnyVideoDetail(config, source.video_guid, fetchImpl)
    verifiedGuids += 1
    videos.push({
      ...source,
      library_id: detail.videoLibraryId,
      title: source.title ?? detail.title,
      duration_seconds: source.duration_seconds ?? detail.length ?? null,
      width: source.width ?? detail.width ?? null,
      height: source.height ?? detail.height ?? null,
      framerate: source.framerate ?? detail.framerate ?? null,
      thumbnail_url: source.thumbnail_url ?? detail.thumbnailUrl ?? null,
    })
  }

  return {
    ...inventory,
    library: {
      ...inventory.library,
      id: Number(config.libraryId),
    },
    videos,
    verification: {
      mode: 'read_only_guid',
      verified_guids: verifiedGuids,
      failed_videos_skipped: failedVideosSkipped,
    },
  }
}
