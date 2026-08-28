import { PortalAdminActionError } from '@/lib/portalAdmin/actionResult'

export function assertDeletionConfirmed(confirmed: boolean): void {
  if (!confirmed) {
    throw new PortalAdminActionError('invalid_input', 'Deletion requires explicit confirmation.')
  }
}

export function assertCompleteOrder(
  label: 'Module' | 'Lesson',
  realIds: Set<string>,
  orderedIds: string[],
): void {
  if (orderedIds.length !== realIds.size) {
    throw new PortalAdminActionError('invalid_input', `${label} count mismatch.`)
  }

  const seen = new Set<string>()
  for (const id of orderedIds) {
    if (!realIds.has(id)) {
      throw new PortalAdminActionError(
        'invalid_input',
        `One or more ${label.toLowerCase()} IDs do not belong to this ${label === 'Module' ? 'course' : 'module'}.`,
      )
    }
    if (seen.has(id)) {
      throw new PortalAdminActionError(
        'invalid_input',
        `Duplicate ${label.toLowerCase()} ID in order list.`,
      )
    }
    seen.add(id)
  }
}

export function isDuplicateWriteError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : ''
  return message.includes('unique') || message.includes('duplicate') || message.includes('already exists')
}
