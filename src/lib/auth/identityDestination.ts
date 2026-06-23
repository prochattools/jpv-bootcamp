export type SecurityDomain = 'admin' | 'member'

export type MemberAccountStatus =
  | 'pending'
  | 'active'
  | 'blocked'
  | 'suspended'
  | 'deleted'
  | string

export type IdentityDestinationInput = {
  administratorId?: string | number | null
  member?: {
    id: string | number
    accountStatus?: MemberAccountStatus | null
    emailVerifiedAt?: string | Date | null
  } | null
  requestedDomain?: SecurityDomain | null
}

export type IdentityDestination =
  | {
      kind: 'anonymous'
      allowed: false
      destination: null
      reason: 'no_authenticated_identity'
    }
  | {
      kind: 'administrator'
      allowed: true
      destination: '/admin'
      reason: 'administrator_authenticated'
    }
  | {
      kind: 'member'
      allowed: true
      destination: '/portal'
      reason: 'active_verified_member'
    }
  | {
      kind: 'blocked'
      allowed: false
      destination: null
      reason: 'member_blocked'
    }
  | {
      kind: 'suspended'
      allowed: false
      destination: null
      reason: 'member_suspended'
    }
  | {
      kind: 'unresolved'
      allowed: false
      destination: null
      reason:
        | 'member_not_active'
        | 'member_email_unverified'
        | 'member_status_unknown'
        | 'requested_domain_unavailable'
    }
  | {
      kind: 'dual_role'
      allowed: false
      destination: null
      reason: 'explicit_domain_required'
    }

function hasIdentifier(value: string | number | null | undefined): boolean {
  return value !== null && value !== undefined && String(value).trim().length > 0
}

function isVerified(value: string | Date | null | undefined): boolean {
  if (!value) return false
  if (value instanceof Date) return !Number.isNaN(value.getTime())
  return !Number.isNaN(Date.parse(value))
}

function resolveMember(member: NonNullable<IdentityDestinationInput['member']>): IdentityDestination {
  switch (member.accountStatus) {
    case 'blocked':
      return {
        kind: 'blocked',
        allowed: false,
        destination: null,
        reason: 'member_blocked',
      }
    case 'suspended':
      return {
        kind: 'suspended',
        allowed: false,
        destination: null,
        reason: 'member_suspended',
      }
    case 'active':
      if (!isVerified(member.emailVerifiedAt)) {
        return {
          kind: 'unresolved',
          allowed: false,
          destination: null,
          reason: 'member_email_unverified',
        }
      }

      return {
        kind: 'member',
        allowed: true,
        destination: '/portal',
        reason: 'active_verified_member',
      }
    case 'pending':
    case 'deleted':
    case null:
    case undefined:
      return {
        kind: 'unresolved',
        allowed: false,
        destination: null,
        reason: 'member_not_active',
      }
    default:
      return {
        kind: 'unresolved',
        allowed: false,
        destination: null,
        reason: 'member_status_unknown',
      }
  }
}

export function resolveIdentityDestination(input: IdentityDestinationInput): IdentityDestination {
  const hasAdministrator = hasIdentifier(input.administratorId)
  const hasMember = Boolean(input.member && hasIdentifier(input.member.id))

  if (!hasAdministrator && !hasMember) {
    return {
      kind: 'anonymous',
      allowed: false,
      destination: null,
      reason: 'no_authenticated_identity',
    }
  }

  if (hasAdministrator && hasMember) {
    if (!input.requestedDomain) {
      return {
        kind: 'dual_role',
        allowed: false,
        destination: null,
        reason: 'explicit_domain_required',
      }
    }

    if (input.requestedDomain === 'admin') {
      return {
        kind: 'administrator',
        allowed: true,
        destination: '/admin',
        reason: 'administrator_authenticated',
      }
    }

    return resolveMember(input.member!)
  }

  if (hasAdministrator) {
    if (input.requestedDomain === 'member') {
      return {
        kind: 'unresolved',
        allowed: false,
        destination: null,
        reason: 'requested_domain_unavailable',
      }
    }

    return {
      kind: 'administrator',
      allowed: true,
      destination: '/admin',
      reason: 'administrator_authenticated',
    }
  }

  if (input.requestedDomain === 'admin') {
    return {
      kind: 'unresolved',
      allowed: false,
      destination: null,
      reason: 'requested_domain_unavailable',
    }
  }

  return resolveMember(input.member!)
}
