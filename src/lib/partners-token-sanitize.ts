const MAX_TOKEN_LENGTH = 2048

export function sanitizePartnersToken(raw?: string | null): string | null {
	if (!raw) return null
	let token = raw.trim()
	if (!token) return null
	token = token.replace(/[\r\n]/g, '')
	if (!token || token.length > MAX_TOKEN_LENGTH) return null
	if (!/^[A-Za-z0-9._-]+$/.test(token)) return null
	return token
}

export const PARTNERS_MAX_TOKEN_LENGTH = MAX_TOKEN_LENGTH
