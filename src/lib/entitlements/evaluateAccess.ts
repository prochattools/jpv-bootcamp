import { evaluateMembershipEntitlement } from './membershipEntitlement'

export type MemberAccountStatus = 'pending' | 'active' | 'blocked' | 'suspended' | 'deleted'

export type BillingStatus =
  | 'none'
  | 'active'
  | 'trialing'
  | 'billing_hold'
  | 'past_due'
  | 'unpaid'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused'

export type ResourceType = 'course' | 'lesson' | 'space' | 'access_group'

export type ResourcePrivacy = 'public' | 'members' | 'private' | 'secret'

export type ContentStatus = 'draft' | 'published' | 'archived'

export type EntitlementGrantStatus = 'pending' | 'active' | 'revoked' | 'expired'

export type AccessDecisionReason =
  | 'public_resource'
  | 'preview_lesson'
  | 'active_member_resource'
  | 'direct_grant'
  | 'group_grant'
  | 'required_group'
  | 'account_not_active'
  | 'authentication_required'
  | 'billing_not_active'
  | 'content_not_published'
  | 'email_not_verified'
  | 'previous_lesson_required'
  | 'policy_not_active'
  | 'no_matching_entitlement'

export type AccessDecision = {
  allowed: boolean
  reason: AccessDecisionReason
  evidence?: Record<string, unknown>
}

export type MemberAccessContext = {
  id: string
  accountStatus: MemberAccountStatus
  emailVerified?: boolean
  groupIds?: string[]
}

export type BillingAccessContext = {
  status: BillingStatus
  lifecycleState?: 'pending' | 'active' | 'past_due' | 'cancelled' | 'expired' | 'suspended' | 'revoked' | 'unreconciled' | null
  subscriptionStatus?: string | null
  periodEnd?: Date | string | null
  cancelAtPeriodEnd?: boolean | null
  paymentStatus?: string | null
  graceEndsAt?: Date | string | null
  reconciliationState?: 'matched' | 'mismatch' | 'pending' | 'failed' | null
  fundingSource?: 'direct_payment' | 'voucher' | 'pay_it_forward' | null
}

export type ResourceAccessContext = {
  type: ResourceType
  id: string
  status: ContentStatus
  privacy: ResourcePrivacy
  isPreview?: boolean
}

export type PolicyAccessContext = {
  status?: 'draft' | 'active' | 'paused' | 'archived'
  privacy?: ResourcePrivacy
  requiredGroupIds?: string[]
  requireActiveBilling?: boolean
  requireVerifiedEmail?: boolean
  allowPreviewLessons?: boolean
  startsAt?: Date | string | null
  endsAt?: Date | string | null
}

export type GrantAccessContext = {
  id?: string
  memberId?: string | null
  groupId?: string | null
  resourceType: ResourceType
  resourceId: string
  status: EntitlementGrantStatus
  startsAt?: Date | string | null
  expiresAt?: Date | string | null
}

export type LessonRuleContext = {
  requiresPreviousCompletion?: boolean
  previousLessonCompleted?: boolean
}

export type EvaluateAccessInput = {
  member?: MemberAccessContext | null
  billing?: BillingAccessContext | null
  resource: ResourceAccessContext
  policy?: PolicyAccessContext | null
  grants?: GrantAccessContext[]
  lessonRules?: LessonRuleContext | null
  now?: Date | string
}

const blockedAccountStatuses = new Set<MemberAccountStatus>([
  'blocked',
  'suspended',
  'deleted',
])

function normalizeDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}

function isWindowActive(
  startsAt: Date | string | null | undefined,
  endsAt: Date | string | null | undefined,
  now: Date
): boolean {
  const start = normalizeDate(startsAt)
  const end = normalizeDate(endsAt)

  if (start && start > now) return false
  if (end && end <= now) return false
  return true
}

function isGrantActive(grant: GrantAccessContext, now: Date): boolean {
  if (grant.status !== 'active') return false
  return isWindowActive(grant.startsAt, grant.expiresAt, now)
}

function targetsResource(
  grant: GrantAccessContext,
  resource: ResourceAccessContext
): boolean {
  return grant.resourceType === resource.type && grant.resourceId === resource.id
}

function hasEveryRequiredGroup(requiredGroupIds: string[], memberGroupIds: string[]): boolean {
  return requiredGroupIds.every((groupId) => memberGroupIds.includes(groupId))
}

function deny(reason: AccessDecisionReason, evidence?: Record<string, unknown>): AccessDecision {
  return { allowed: false, reason, evidence }
}

function allow(reason: AccessDecisionReason, evidence?: Record<string, unknown>): AccessDecision {
  return { allowed: true, reason, evidence }
}

function entitlementAllowsAccess(decision: ReturnType<typeof evaluateMembershipEntitlement>): boolean {
  return decision.decision === 'allowed' || decision.decision === 'billing_hold'
}

export function evaluateAccess(input: EvaluateAccessInput): AccessDecision {
  const now = normalizeDate(input.now) ?? new Date()
  const { member, resource } = input
  const policy = input.policy ?? null
  const privacy = policy?.privacy ?? resource.privacy

  if (resource.status !== 'published') {
    return deny('content_not_published', { status: resource.status })
  }

  if (member && blockedAccountStatuses.has(member.accountStatus)) {
    return deny('account_not_active', { accountStatus: member.accountStatus })
  }

  if (policy?.status && policy.status !== 'active') {
    return deny('policy_not_active', { policyStatus: policy.status })
  }

  if (policy && !isWindowActive(policy.startsAt, policy.endsAt, now)) {
    return deny('policy_not_active')
  }

  if (resource.isPreview && (privacy === 'public' || policy?.allowPreviewLessons)) {
    return allow('preview_lesson', { resourceId: resource.id })
  }

  if (privacy === 'public') {
    return allow('public_resource', { resourceId: resource.id })
  }

  if (!member) {
    return deny('authentication_required')
  }

  if (member.accountStatus !== 'active') {
    return deny('account_not_active', { accountStatus: member.accountStatus })
  }

  if (policy?.requireVerifiedEmail && !member.emailVerified) {
    return deny('email_not_verified')
  }

  if (
    input.lessonRules?.requiresPreviousCompletion &&
    !input.lessonRules.previousLessonCompleted
  ) {
    return deny('previous_lesson_required')
  }

  const billingStatus = input.billing?.status ?? 'none'
  const requireActiveBilling =
    policy?.requireActiveBilling ?? (privacy === 'private' || privacy === 'secret')

  const entitlement = evaluateMembershipEntitlement({
    lifecycleState: input.billing?.lifecycleState ?? null,
    subscriptionStatus: input.billing?.subscriptionStatus ?? billingStatus,
    periodEnd: input.billing?.periodEnd ?? null,
    cancelAtPeriodEnd: input.billing?.cancelAtPeriodEnd ?? null,
    paymentStatus: input.billing?.paymentStatus ?? null,
    graceEndsAt: input.billing?.graceEndsAt ?? null,
    reconciliationState: input.billing?.reconciliationState ?? null,
    fundingSource: input.billing?.fundingSource ?? null,
    now,
  })

  if (requireActiveBilling && !entitlementAllowsAccess(entitlement)) {
    return deny('billing_not_active', {
      billingStatus,
      entitlementDecision: entitlement.decision,
      entitlementReason: entitlement.reason,
    })
  }

  const grants = (input.grants ?? []).filter((grant) => {
    return targetsResource(grant, resource) && isGrantActive(grant, now)
  })

  const directGrant = grants.find((grant) => grant.memberId === member.id)
  if (directGrant) {
    return allow('direct_grant', { grantId: directGrant.id ?? null })
  }

  const memberGroupIds = member.groupIds ?? []
  const groupGrant = grants.find((grant) => {
    return grant.groupId ? memberGroupIds.includes(grant.groupId) : false
  })
  if (groupGrant) {
    return allow('group_grant', { grantId: groupGrant.id ?? null })
  }

  const requiredGroupIds = policy?.requiredGroupIds ?? []
  if (requiredGroupIds.length > 0) {
    if (hasEveryRequiredGroup(requiredGroupIds, memberGroupIds)) {
      return allow('required_group', { requiredGroupIds })
    }
    // Required groups specified but member doesn't satisfy them — deny even if billing is active
    return deny('no_matching_entitlement', { privacy, requiredGroupIds })
  }

  // Secret resources always require an explicit grant or group — billing alone is insufficient
  if (privacy === 'secret') {
    return deny('no_matching_entitlement', { privacy })
  }

  // Active billing without additional group requirements satisfies access to private resources
  if (requireActiveBilling && entitlementAllowsAccess(entitlement)) {
    return allow('active_member_resource', { memberId: member.id })
  }

  if (privacy === 'members' && !requireActiveBilling) {
    return allow('active_member_resource', { memberId: member.id })
  }

  return deny('no_matching_entitlement', { privacy })
}
