export type CurrentPayloadAdmin = {
  id: string | number
  collection?: string
  email?: string
}

export function isPayloadAdminIdentity(user: unknown): user is CurrentPayloadAdmin {
  if (!user || typeof user !== 'object') return false

  const candidate = user as Partial<CurrentPayloadAdmin>
  const hasId =
    (typeof candidate.id === 'string' && candidate.id.length > 0) ||
    typeof candidate.id === 'number'

  return hasId && candidate.collection === 'payload_users'
}

export async function requireCurrentPayloadAdmin(): Promise<CurrentPayloadAdmin> {
  const [{ default: config }, { headers }, { getPayload: loadPayload }, { notFound }] =
    await Promise.all([
      import('@payload-config'),
      import('next/headers'),
      import('payload'),
      import('next/navigation'),
    ])

  const payload = await loadPayload({ config })
  const auth = await payload.auth({ headers: await headers() })
  const user = auth.user as unknown

  if (isPayloadAdminIdentity(user)) return user

  notFound()
}
