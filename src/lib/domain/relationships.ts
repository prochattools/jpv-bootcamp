import { normalizeRecordId } from '@/lib/domain/validation'

/**
 * Extracts the ID from Payload's supported relationship representations:
 * direct string/number IDs and populated objects with an `id` property.
 */
export function relationshipId(value: unknown): string | null {
  const direct = normalizeRecordId(value)
  if (direct) return direct

  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return normalizeRecordId((value as { id?: unknown }).id)
}

/** Converts a relationship ID to the scalar form accepted by Payload writes. */
export function normalizeRelationshipId(value: unknown): string | number {
  const id = relationshipId(value)
  if (!id) throw new Error('Relationship ID is required but was empty.')

  const numeric = Number(id)
  return Number.isFinite(numeric) ? numeric : id
}
