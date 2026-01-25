const DEFAULT_PATH = '/partners'
const MAX_PATH_LENGTH = 2048
const ALLOWED_HOSTS = new Set([
	'jpvbootcamp.com',
	'www.jpvbootcamp.com',
])

function stripUnsafe(value: string): string {
	return value.replace(/[\r\n]/g, '')
}

function normalizePath(value: string): string {
	const trimmed = stripUnsafe(value).trim()
	if (!trimmed) return DEFAULT_PATH
	if (trimmed.length > MAX_PATH_LENGTH) {
		return DEFAULT_PATH
	}
	if (!trimmed.startsWith('/')) {
		return DEFAULT_PATH
	}
	return trimmed
}

export function sanitizePathOnly(
	raw?: string | null,
	fallback: string = DEFAULT_PATH
): string {
	if (!raw) return fallback
	const trimmed = stripUnsafe(raw).trim()
	if (!trimmed) return fallback
	if (/^(javascript|data):/i.test(trimmed)) return fallback

	if (trimmed.startsWith('/')) {
		return normalizePath(trimmed.split('?')[0] ?? '')
	}

	try {
		const url = new URL(trimmed)
		if (!ALLOWED_HOSTS.has(url.hostname)) return fallback
		return normalizePath(url.pathname)
	} catch {
		return fallback
	}
}

export function sanitizeRefPath(raw?: string | null): string | null {
	if (!raw) return null
	const trimmed = stripUnsafe(raw).trim()
	if (!trimmed) return null
	if (/^(javascript|data):/i.test(trimmed)) return null

	try {
		const url = new URL(trimmed)
		if (!ALLOWED_HOSTS.has(url.hostname)) return null
		const path = normalizePath(url.pathname)
		return path || null
	} catch {
		if (trimmed.startsWith('/')) {
			return normalizePath(trimmed.split('?')[0] ?? '')
		}
		return null
	}
}

export const PARTNERS_DEFAULT_PATH = DEFAULT_PATH
