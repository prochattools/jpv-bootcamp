import { createHash } from 'node:crypto'

type RedactedEmail = string | null

function hashSha256(value: string): string {
	return createHash('sha256').update(value).digest('hex')
}

export function redactEmail(email?: string | null): RedactedEmail {
	if (!email) return null
	const normalized = email.trim().toLowerCase()
	if (!normalized) return null
	const local = normalized.split('@')[0] ?? ''
	const tail = local.slice(-3)
	const hash = hashSha256(normalized)
	return `${hash.slice(0, 12)}:${tail || '***'}`
}

export function redactUrlForLog(
	raw?: string | null
): { host: string | null; path: string | null } {
	if (!raw) return { host: null, path: null }
	const trimmed = raw.trim()
	if (!trimmed) return { host: null, path: null }
	try {
		const url = new URL(trimmed)
		return {
			host: url.host || null,
			path: url.pathname || '/',
		}
	} catch {
		return { host: null, path: null }
	}
}
