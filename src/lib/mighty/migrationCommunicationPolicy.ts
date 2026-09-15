import { normalizeEmail } from '@/lib/normalize-email'

/**
 * Migration/cutover mail is deliberately narrower than ordinary lifecycle
 * mail. Keep this list in code so an environment variable cannot broaden it.
 */
export const AUTHORIZED_MIGHTY_MIGRATION_EMAILS = [
	'westhoek@hotmail.com',
	'steve@yeshua.academy',
	'info@prochat.tools',
] as const

const authorizedRecipients = new Set<string>(AUTHORIZED_MIGHTY_MIGRATION_EMAILS)

export type EmailCommunicationContext = 'normal' | 'mighty_migration'

export function isAuthorizedMightyMigrationRecipient(email: string): boolean {
	const normalized = normalizeEmail(email)
	return normalized !== null && authorizedRecipients.has(normalized)
}

export function isMightyMigrationContext(value: unknown): value is 'mighty_migration' {
	return value === 'mighty_migration'
}
