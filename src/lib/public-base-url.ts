function normalizeHttpsOrigin(raw?: string | null): string | null {
	if (!raw) return null
	const trimmed = raw.trim()
	if (!trimmed) return null
	try {
		const url = new URL(trimmed)
		if (url.protocol !== 'https:') return null
		return url.origin
	} catch {
		return null
	}
}

export function getPublicBaseUrl(): string {
	const envBase = normalizeHttpsOrigin(process.env.APP_BASE_URL)
	if (envBase) return envBase

	const publicBase = normalizeHttpsOrigin(process.env.NEXT_PUBLIC_APP_URL)
	if (publicBase) return publicBase

	const vercelUrl = (process.env.VERCEL_URL || '').trim()
	if (vercelUrl) {
		return `https://${vercelUrl}`
	}

	return 'https://jpvbootcamp.com'
}
