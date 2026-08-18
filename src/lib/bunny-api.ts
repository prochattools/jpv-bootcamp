import 'server-only'

/**
 * Bunny Stream API integration for video management.
 * Accepts the legacy aliases BUNNY_API_KEY/BUNNY_LIBRARY_ID and the
 * staging/runtime names BUNNY_STREAM_API_KEY/BUNNY_STREAM_LIBRARY_ID.
 *
 * Bunny Stream identifies videos by GUID. The API reference names the
 * route parameter `videoId`, but its value is the GUID string returned as
 * `guid` by Create/Get Video.
 */

const BUNNY_STREAM_API_BASE = 'https://video.bunnycdn.com'

function getBunnyConfig() {
	const apiKey = (process.env.BUNNY_API_KEY || process.env.BUNNY_STREAM_API_KEY || '').trim()
	const libraryId = (process.env.BUNNY_LIBRARY_ID || process.env.BUNNY_STREAM_LIBRARY_ID || '').trim()
	return { apiKey, libraryId }
}

function isConfigured(): boolean {
	const { apiKey, libraryId } = getBunnyConfig()
	return Boolean(apiKey && libraryId)
}

export type BunnyVideoCreateRequest = {
	title: string
	collectionId?: string
}

export type BunnyVideoApiResponse = {
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
	outputCodecs?: string | null
	availableResolutions?: string | null
	thumbnailFileName?: string | null
	thumbnailUrl?: string | null
	collectionId?: string | null
}

/** App-normalized Bunny video response. `videoGuid` is a compatibility alias for `guid`. */
export type BunnyVideoCreateResponse = BunnyVideoApiResponse & {
	videoGuid: string
}

function normalizeBunnyVideoResponse(raw: BunnyVideoApiResponse): BunnyVideoCreateResponse {
	if (!raw || typeof raw.guid !== 'string' || !raw.guid.trim()) {
		throw new Error('Bunny API response missing canonical video guid')
	}
	if (!Number.isInteger(raw.videoLibraryId)) {
		throw new Error('Bunny API response missing videoLibraryId')
	}
	return {
		...raw,
		guid: raw.guid.trim(),
		videoGuid: raw.guid.trim(),
	}
}

/** Create a new video object in the configured Bunny Stream library. */
export async function createBunnyVideo(
	req: BunnyVideoCreateRequest,
): Promise<BunnyVideoCreateResponse> {
	const { apiKey, libraryId } = getBunnyConfig()

	if (!isConfigured()) {
		throw new Error('Bunny API not configured: provide BUNNY_API_KEY/BUNNY_LIBRARY_ID or BUNNY_STREAM_API_KEY/BUNNY_STREAM_LIBRARY_ID')
	}

	const url = `${BUNNY_STREAM_API_BASE}/library/${encodeURIComponent(libraryId)}/videos`
	const response = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'AccessKey': apiKey,
		},
		body: JSON.stringify({
			title: req.title,
			collectionId: req.collectionId || undefined,
		}),
	})

	if (!response.ok) {
		const text = await response.text()
		throw new Error(`Bunny API error ${response.status}: ${text}`)
	}

	return normalizeBunnyVideoResponse(await response.json() as BunnyVideoApiResponse)
}

/**
 * @deprecated Protected playback is signed locally by bunnyProtectedMedia.ts.
 * Bunny Stream does not expose the legacy `/token` API used by this helper.
 */
export async function getBunnyPlaybackToken(
	_videoGuid: string,
	_expirationSeconds: number = 3600,
): Promise<string> {
	throw new Error('getBunnyPlaybackToken is deprecated; use the local protected-media signer')
}

/** Get video details from Bunny using the canonical GUID. */
export async function getBunnyVideo(
	videoGuid: string,
): Promise<BunnyVideoCreateResponse> {
	const { apiKey, libraryId } = getBunnyConfig()

	if (!isConfigured()) {
		throw new Error('Bunny API not configured')
	}

	const url = `${BUNNY_STREAM_API_BASE}/library/${encodeURIComponent(libraryId)}/videos/${encodeURIComponent(videoGuid)}`
	const response = await fetch(url, {
		method: 'GET',
		headers: {
			'AccessKey': apiKey,
		},
	})

	if (!response.ok) {
		const text = await response.text()
		throw new Error(`Failed to get video: ${response.status} ${text}`)
	}

	return normalizeBunnyVideoResponse(await response.json() as BunnyVideoApiResponse)
}

export { isConfigured as isBunnyConfigured }
