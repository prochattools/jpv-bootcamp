import type { PayloadCourseAccessAPI } from '@/lib/payloadCourse/accessService'
import { normalizeEmail } from '@/lib/normalize-email'

export type PayloadAdministratorRecipient = { id: string; email: string }

function validEmail(value: string | null): value is string {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
}

export function parseConfiguredEmailRecipients(value: unknown): string[] {
  const values = (Array.isArray(value) ? value : [value]).flatMap((entry) =>
    typeof entry === 'string' ? entry.split(',') : [entry]
  )
  return Array.from(new Set(values.map((entry) => normalizeEmail(String(entry))).filter(validEmail)))
}

export async function getPayloadAdministratorRecipients(
  payload: PayloadCourseAccessAPI,
  additionalEmails: unknown[] = [],
): Promise<PayloadAdministratorRecipient[]> {
  const result = await payload.find({
    collection: 'payload_users',
    limit: 200,
    depth: 0,
    overrideAccess: true,
  })
  const byEmail = new Map<string, PayloadAdministratorRecipient>()
  for (const administrator of result.docs) {
    const email = normalizeEmail(typeof administrator.email === 'string' ? administrator.email : '')
    if (validEmail(email)) byEmail.set(email, { id: String(administrator.id), email })
  }
  for (const email of parseConfiguredEmailRecipients(additionalEmails)) {
    if (!byEmail.has(email)) byEmail.set(email, { id: `configured:${email}`, email })
  }
  return Array.from(byEmail.values()).sort((a, b) => a.email.localeCompare(b.email))
}
