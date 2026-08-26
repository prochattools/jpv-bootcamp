import type { SharedLoginSession } from '@/lib/auth/sharedLoginDecision'

export const ADMIN_COLLECTION = 'payload_users'
export const MEMBER_COLLECTION = 'payload_members'

type PayloadAuthUser = {
  id?: string | number
  collection?: string
}

export type PayloadRequestSession = SharedLoginSession & {
  authenticatedCollection: string | null
}

function hasIdentifier(value: string | number | null | undefined): value is string | number {
  return value !== null && value !== undefined && String(value).trim().length > 0
}

export function mapPayloadAuthUser(user: unknown): PayloadRequestSession {
  if (!user || typeof user !== 'object') {
    return {
      administratorId: null,
      member: null,
      unresolvedCollection: false,
      authenticatedCollection: null,
    }
  }

  const authenticatedUser = user as PayloadAuthUser
  if (!hasIdentifier(authenticatedUser.id)) {
    return {
      administratorId: null,
      member: null,
      unresolvedCollection: true,
      authenticatedCollection: authenticatedUser.collection ?? null,
    }
  }

  if (authenticatedUser.collection === ADMIN_COLLECTION) {
    return {
      administratorId: authenticatedUser.id,
      member: null,
      unresolvedCollection: false,
      authenticatedCollection: ADMIN_COLLECTION,
    }
  }

  if (authenticatedUser.collection === MEMBER_COLLECTION) {
    return {
      administratorId: null,
      member: {
        id: authenticatedUser.id,
        accountStatus: null,
        emailVerifiedAt: null,
      },
      unresolvedCollection: false,
      authenticatedCollection: MEMBER_COLLECTION,
    }
  }

  return {
    administratorId: null,
    member: null,
    unresolvedCollection: true,
    authenticatedCollection: authenticatedUser.collection ?? null,
  }
}
