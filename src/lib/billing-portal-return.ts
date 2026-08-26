const DEFAULT_RETURN_URL = 'https://jpvbootcamp.com/portal/billing'
const ALLOWED_RETURN_ORIGINS = new Set([
	'https://jpvbootcamp.com',
	'https://www.jpvbootcamp.com',
	'https://preview.jpvbootcamp.com',
])
const MAX_RETURN_URL_LENGTH = 2048

function stripUnsafeSchemes(value: string): boolean {
	const trimmed = value.trim().toLowerCase()
	return trimmed.startsWith('javascript:') || trimmed.startsWith('data:')
}

function stripCrLf(value: string): string {
	return value.replace(/[\r\n]/g, '')
}

function safeDecodeURIComponent(value: string): string {
	try {
		return decodeURIComponent(value)
	} catch {
		return value
	}
}

function stripChainedUrl(value: string): string {
	const regex = /https?:\/\//gi
	const first = regex.exec(value)
	if (!first) return value
	const second = regex.exec(value)
	if (!second) return value
	return value.slice(0, second.index)
}

export type BillingPortalReturnInfo = {
	url: string
	present: boolean
	valid: boolean
	host: string | null
	path: string | null
}

export function describeBillingPortalReturnUrl(
	raw: string | null | undefined
): BillingPortalReturnInfo {
	if (!raw) {
		return {
			url: DEFAULT_RETURN_URL,
			present: false,
			valid: false,
			host: null,
			path: '/portal',
		}
	}
	const trimmed = stripCrLf(raw.trim())
	if (!trimmed) {
		return {
			url: DEFAULT_RETURN_URL,
			present: false,
			valid: false,
			host: null,
			path: '/portal',
		}
	}
	if (trimmed.length > MAX_RETURN_URL_LENGTH || stripUnsafeSchemes(trimmed)) {
		return {
			url: DEFAULT_RETURN_URL,
			present: true,
			valid: false,
			host: null,
			path: '/portal',
		}
	}
	const decoded = safeDecodeURIComponent(trimmed)
	if (decoded.length > MAX_RETURN_URL_LENGTH) {
		return {
			url: DEFAULT_RETURN_URL,
			present: true,
			valid: false,
			host: null,
			path: '/community/',
		}
	}
	const candidate = stripChainedUrl(decoded)
	try {
		const resolved = new URL(candidate, DEFAULT_RETURN_URL)
		const host = resolved.host || null
		const path = resolved.pathname || '/'
		if (resolved.protocol !== 'https:' || !ALLOWED_RETURN_ORIGINS.has(resolved.origin)) {
			return {
				url: DEFAULT_RETURN_URL,
				present: true,
				valid: false,
				host,
				path: '/portal',
			}
		}
		return {
			url: resolved.toString(),
			present: true,
			valid: true,
			host,
			path,
		}
	} catch {
		return {
			url: DEFAULT_RETURN_URL,
			present: true,
			valid: false,
			host: null,
			path: '/portal',
		}
	}
}

export function resolveBillingPortalReturnUrl(
	raw: string | null | undefined
): string {
	return describeBillingPortalReturnUrl(raw).url
}

export const BILLING_PORTAL_DEFAULT_RETURN_URL = DEFAULT_RETURN_URL
