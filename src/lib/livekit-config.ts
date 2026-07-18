import 'server-only'

/**
 * LiveKit staging configuration and validation.
 * Server-side only. API secrets never reach the browser.
 */

type EnvKey = keyof NodeJS.ProcessEnv

function getEnv(key: EnvKey): string | undefined {
	return process.env[key]
}

function requireEnv(key: EnvKey): string {
	const value = getEnv(key)
	if (!value) {
		throw new Error(`Missing required env var: ${key}`)
	}
	return value
}

function requireUrlEnv(key: EnvKey): string {
	const value = requireEnv(key)
	try {
		new URL(value)
	} catch {
		throw new Error(`Invalid URL for env var: ${key}`)
	}
	return value.replace(/\/$/, '')
}

export type LiveKitConfig = {
	url: string
	apiKey: string
	apiSecret: string
}

let cachedLiveKitConfig: LiveKitConfig | null = null

export function getLiveKitConfig(): LiveKitConfig {
	if (cachedLiveKitConfig) return cachedLiveKitConfig

	cachedLiveKitConfig = {
		url: requireUrlEnv('LIVEKIT_URL' as EnvKey),
		apiKey: requireEnv('LIVEKIT_API_KEY' as EnvKey),
		apiSecret: requireEnv('LIVEKIT_API_SECRET' as EnvKey),
	}

	return cachedLiveKitConfig
}

/**
 * Redact LiveKit secrets from error messages and logs.
 * Safe for inclusion in error responses.
 */
export function redactLiveKitSecrets(text: string): string {
	if (!text) return text
	let result = text

	try {
		const config = getLiveKitConfig()
		if (config.apiSecret) {
			result = result.replace(config.apiSecret, '***REDACTED***')
		}
		if (config.apiKey) {
			result = result.replace(config.apiKey, '***REDACTED***')
		}
	} catch {
		// Config not available; return original text
	}

	return result
}

/**
 * Validate LiveKit configuration is available.
 * @returns true if LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET are set
 */
export function isLiveKitConfigured(): boolean {
	return !!(getEnv('LIVEKIT_URL' as EnvKey) && getEnv('LIVEKIT_API_KEY' as EnvKey) && getEnv('LIVEKIT_API_SECRET' as EnvKey))
}

/**
 * Generate deterministic LiveKit room name from course/module/lesson.
 * Format: course-{courseId}-module-{moduleId}-lesson-{lessonId}
 * @example course-101-module-202-lesson-303
 */
export function generateLiveKitRoomName(courseId: string, moduleId: string, lessonId: string): string {
	return `course-${courseId}-module-${moduleId}-lesson-${lessonId}`.toLowerCase().replace(/[^a-z0-9-]/g, '')
}
