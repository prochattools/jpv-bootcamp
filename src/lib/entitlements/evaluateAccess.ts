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

export type SubscriptionPlan = 'free' | 'exhibitor' | 'pro' | 'vip'

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
  | 'subscription_plan'
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
  plan?: SubscriptionPlan | null
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
  allowedPlans?: SubscriptionPlan[]
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

const billingDeniedStatuses = new Set<BillingStatus>([
  'none',
  'billing_hold',
  'past_due',
  'unpaid',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'paused',
])

const billingAllowedStatuses = new Set<BillingStatus>(['active', 'trialing'])

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

  if (requireActiveBilling && !billingAllowedStatuses.has(billingStatus)) {
    return deny('billing_not_active', { billingStatus })
  }

  if (billingDeniedStatuses.has(billingStatus) && requireActiveBilling) {
    return deny('billing_not_active', { billingStatus })
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
  if (requiredGroupIds.length > 0 && hasEveryRequiredGroup(requiredGroupIds, memberGroupIds)) {
    return allow('required_group', { requiredGroupIds })
  }

  const allowedPlans = policy?.allowedPlans ?? []
  const billingPlan = input.billing?.plan ?? null
  if (
    billingPlan &&
    allowedPlans.includes(billingPlan) &&
    billingAllowedStatuses.has(billingStatus)
  ) {
    return allow('subscription_plan', { plan: billingPlan, billingStatus })
  }

  if (privacy === 'members' && !requireActiveBilling) {
    return allow('active_member_resource', { memberId: member.id })
  }

  return deny('no_matching_entitlement', { privacy })
}
