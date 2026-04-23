export function normalizePhone(value: string | null | undefined): string | null {
	if (!value) return null

	const cleaned = value
		.trim()
		.replace(/[\u200B-\u200D\uFEFF]/g, '')
		.replace(/\s+/g, ' ')

	if (!cleaned) return null

	if (cleaned.startsWith('00')) {
		return `+${cleaned.slice(2)}`
	}

	return cleaned
}

export function isValidInternationalPhone(value: string | null | undefined): boolean {
	const normalized = normalizePhone(value)
	if (!normalized) return false

	const compact = normalized.replace(/[\s().-]/g, '')
	if (!compact) return false

	if (!/^\+?[0-9]+$/.test(compact)) return false

	const digitCount = compact.replace(/\D/g, '').length
	if (digitCount < 7 || digitCount > 15) return false

	return true
}

export function formatPhoneForDisplay(value: string | null | undefined): string {
	const normalized = normalizePhone(value)
	return normalized ?? 'unknown'
}
