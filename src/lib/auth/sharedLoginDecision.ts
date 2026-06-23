import {
  resolveIdentityDestination,
  type IdentityDestination,
  type IdentityDestinationInput,
  type SecurityDomain,
} from '@/lib/auth/identityDestination'
import { sanitizeInternalDestination } from '@/lib/auth/safeRedirect'

export type SharedLoginSession = Pick<IdentityDestinationInput, 'administratorId' | 'member'> & {
  unresolvedCollection?: boolean
}

export type SharedLoginDecision = {
  allowed: boolean
  destination: string | null
  identity: IdentityDestination
  reason: IdentityDestination['reason'] | 'authenticated_collection_unrecognized'
}

function getRequestedDomain(destination: string | null): SecurityDomain | null {
  if (!destination) return null
  if (destination === '/admin' || destination.startsWith('/admin/')) return 'admin'
  if (destination === '/portal' || destination.startsWith('/portal/')) return 'member'
  return null
}

export function decideSharedLogin(
  session: SharedLoginSession,
  requestedDestination?: string | null,
): SharedLoginDecision {
  const safeDestination = sanitizeInternalDestination(requestedDestination)
  const requestedDomain = getRequestedDomain(safeDestination)
  const identity = resolveIdentityDestination({
    administratorId: session.administratorId,
    member: session.member,
    requestedDomain,
  })

  if (session.unresolvedCollection) {
    return {
      allowed: false,
      destination: null,
      identity,
      reason: 'authenticated_collection_unrecognized',
    }
  }

  if (!identity.allowed || !identity.destination) {
    return {
      allowed: false,
      destination: null,
      identity,
      reason: identity.reason,
    }
  }

  const destination =
    safeDestination &&
    (safeDestination === identity.destination || safeDestination.startsWith(`${identity.destination}/`))
      ? safeDestination
      : identity.destination

  return {
    allowed: true,
    destination,
    identity,
    reason: identity.reason,
  }
}
