export function normalizeEmail(value: string | null | undefined): string | null {
	if (!value) return null
	const trimmed = value.trim().toLowerCase()
	return trimmed.length > 0 ? trimmed : null
}

export function requireNormalizedEmail(value: string, context?: string): string {
	const normalized = normalizeEmail(value)
	if (!normalized) {
		throw new Error(`Missing normalized email${context ? ` (${context})` : ''}.`)
	}
	return normalized
}
