import type { PayloadCourseAccessAPI } from '@/lib/payloadCourse/accessService'
import { PortalAdminActionError } from '@/lib/portalAdmin/actionResult'
import { normalizeSlug } from '@/lib/domain/validation'

/**
 * Produces the canonical slug base for a human-readable name.
 *
 * Slugs are routing infrastructure: callers should generate them on create and
 * preserve the persisted value on ordinary renames. This helper deliberately
 * does not inspect storage or silently replace an empty/invalid name.
 */
export function slugFromName(name: string): string {
  const transliterated = name
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')

  const candidate = transliterated
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (!candidate) {
    throw new PortalAdminActionError('invalid_input', 'A name must contain at least one letter or number to generate a slug.')
  }

  return normalizeSlug(candidate.slice(0, 100))
}

export type SlugLookupAPI = Pick<PayloadCourseAccessAPI, 'find'>

/**
 * Reserves the first deterministic available suffix for a new record.
 *
 * The database unique index remains the final race-safe guard. This lookup
 * keeps normal admin flows predictable and never overwrites another record.
 */
export async function uniqueSlugForName(
  payload: SlugLookupAPI,
  collection: string,
  name: string,
  excludeId?: string | number,
): Promise<string> {
  const base = slugFromName(name)

  for (let suffix = 1; suffix <= 10_000; suffix += 1) {
    const suffixText = suffix === 1 ? '' : `-${suffix}`
    const maxBaseLength = Math.max(2, 100 - suffixText.length)
    const candidate = normalizeSlug(`${base.slice(0, maxBaseLength - (suffixText ? 1 : 0))}${suffixText}`)
    const where = [
      { slug: { equals: candidate } },
      ...(excludeId !== undefined ? [{ id: { not_equals: String(excludeId) } }] : []),
    ]
    const existing = await payload.find({
      collection,
      where: { and: where },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing.docs.length === 0) return candidate
  }

  throw new Error(`Unable to generate an available slug for ${collection}.`)
}

export async function generatePayloadSlugIfMissing(args: {
  data?: Record<string, unknown>
  originalDoc?: Record<string, unknown>
  operation?: string
  req: { payload: SlugLookupAPI }
  collection: string
  sourceField: 'name' | 'title'
}): Promise<Record<string, unknown> | undefined> {
  const data = args.data
  if (!data) return data

  const existingSlug = typeof data.slug === 'string' ? data.slug.trim() : ''
  const source = typeof data[args.sourceField] === 'string' ? String(data[args.sourceField]).trim() : ''
  if (existingSlug) return data
  if (typeof args.originalDoc?.slug === 'string') {
    data.slug = args.originalDoc.slug
  } else if (source) {
    data.slug = await uniqueSlugForName(
      args.req.payload,
      args.collection,
      source,
      args.originalDoc?.id as string | number | undefined,
    )
  }
  return data
}
