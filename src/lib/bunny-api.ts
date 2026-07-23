import 'server-only'

/**
 * Bunny Stream API integration for video management.
 * Requires: BUNNY_API_KEY, BUNNY_LIBRARY_ID in environment
 */

const BUNNY_API_BASE = 'https://api.bunny.net'
const BUNNY_STREAM_API = `${BUNNY_API_BASE}/stream`

function getBunnyConfig() {
	const apiKey = (process.env.BUNNY_API_KEY || '').trim()
	const libraryId = (process.env.BUNNY_LIBRARY_ID || '').trim()
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

export type BunnyVideoCreateResponse = {
	videoLibraryId: number
	videoGuid: string
	videoId: number
	title: string
	status: number // 0=queued, 1=processing, 2=error, 3=published, 4=blocked
	dateUploaded: string
	storageSize: number
	views: number
	isPublic: boolean
	length: number
	resolutions: string
	framerate: number
	width: number
	height: number
	videoCodec: string
	audioCodec: string
	captions: unknown[]
	thumbnail: string
	token: string
	accessToken: string
	accessTokenExpires: string
}

/**
 * Create a new video in Bunny Stream library.
 * Returns video GUID and temporary access token for upload.
 */
export async function createBunnyVideo(
	req: BunnyVideoCreateRequest,
): Promise<BunnyVideoCreateResponse> {
	const { apiKey, libraryId } = getBunnyConfig()

	if (!isConfigured()) {
		throw new Error('Bunny API not configured: BUNNY_API_KEY or BUNNY_LIBRARY_ID missing')
	}

	const url = `${BUNNY_STREAM_API}/${libraryId}/videos`

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

	return response.json()
}

/**
 * Get signed playback token for a video.
 * Token is valid for the specified duration (in seconds).
 */
export async function getBunnyPlaybackToken(
	videoGuid: string,
	expirationSeconds: number = 3600,
): Promise<string> {
	const { apiKey, libraryId } = getBunnyConfig()

	if (!isConfigured()) {
		throw new Error('Bunny API not configured')
	}

	const url = `${BUNNY_STREAM_API}/${libraryId}/videos/${videoGuid}/token`
	const expirationTime = Math.floor(Date.now() / 1000) + expirationSeconds

	const response = await fetch(url, {
		method: 'POST',
		headers: {
			'AccessKey': apiKey,
		},
		body: JSON.stringify({
			expirationTime,
		}),
	})

	if (!response.ok) {
		const text = await response.text()
		throw new Error(`Failed to get playback token: ${response.status} ${text}`)
	}

	const { token } = await response.json()
	return token
}

/**
 * Get video details from Bunny.
 */
export async function getBunnyVideo(
	videoGuid: string,
): Promise<BunnyVideoCreateResponse> {
	const { apiKey, libraryId } = getBunnyConfig()

	if (!isConfigured()) {
		throw new Error('Bunny API not configured')
	}

	const url = `${BUNNY_STREAM_API}/${libraryId}/videos/${videoGuid}`

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

	return response.json()
}

export { isConfigured as isBunnyConfigured }
