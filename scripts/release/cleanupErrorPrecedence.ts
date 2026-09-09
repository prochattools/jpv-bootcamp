export function throwPrimaryOrCleanupError(
  primaryError: Error | null,
  cleanupError: Error | null,
): void {
  if (primaryError) throw primaryError
  if (cleanupError) throw cleanupError
}
