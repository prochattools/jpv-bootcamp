import { PortalAdminActionError } from '@/lib/portalAdmin/actionResult'

/**
 * Normalizes an identifier that may come from a Payload relationship or form
 * input. Empty strings, non-finite numbers, and all other values are invalid.
 */
export function normalizeRecordId(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || null
  }

  if (typeof value === 'number' && Number.isFinite(value)) return String(value)

  return null
}

/** Normalizes the slug format used by portal-managed records. */
export function normalizeSlug(slug: string): string {
  const normalized = slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  if (!normalized || normalized.length < 2) {
    throw new PortalAdminActionError('invalid_input', 'Slug must be at least 2 characters.')
  }

  if (normalized.length > 100) {
    throw new PortalAdminActionError('invalid_input', 'Slug is too long.')
  }

  return normalized
}

/** Validates and trims a portal-managed title. */
export function validateTitle(title: string): string {
  const trimmed = title.trim()
  if (!trimmed) throw new PortalAdminActionError('invalid_input', 'Title is required.')
  if (trimmed.length > 200) throw new PortalAdminActionError('invalid_input', 'Title is too long.')
  return trimmed
}

/** Validates and trims bounded user-authored text. */
export function boundedText(value: string, label: string, maxLength: number): string {
  const trimmed = value.trim()
  if (!trimmed) throw new PortalAdminActionError('invalid_input', `${label} is required.`)
  if (trimmed.length > maxLength) throw new PortalAdminActionError('invalid_input', `${label} is too long.`)
  return trimmed
}
