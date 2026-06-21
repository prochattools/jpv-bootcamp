import { evaluatePayloadCourseAccess } from '@/lib/payloadCourse/accessService'
import type {
  AccessDecision,
  BillingStatus,
  SubscriptionPlan,
} from '@/lib/entitlements/evaluateAccess'
import type {
  PayloadCourseAccessAPI,
  PayloadDocument,
  PayloadId,
} from '@/lib/payloadCourse/accessService'

type IssueCode =
  | 'subscription_expected_allow_denied'
  | 'active_grant_denied'
  | 'orphan_grant_member_missing'
  | 'orphan_grant_group_missing'
  | 'orphan_grant_resource_missing'

type RelationshipValue = PayloadId | { id?: PayloadId } | null | undefined

export type ReconciliationIssue = {
  code: IssueCode
  severity: 'warning' | 'error'
  memberId?: string | null
  resourceType?: string | null
  resourceId?: string | null
  grantId?: string | null
  subscriptionId?: string | null
  decision?: AccessDecision | null
  detail: string
}

export type ReconciliationReport = {
  checkedAt: string
  dryRun: true
  totals: {
    members: number
    courses: number
    policies: number
    subscriptions: number
    activeGrants: number
    decisions: number
    issues: number
  }
  issues: ReconciliationIssue[]
}

export type ReconcilePayloadEntitlementsArgs = {
  memberLimit?: number
  resourceLimit?: number
  now?: Date | string
}

const allowedBillingStatuses = new Set<BillingStatus>(['active', 'trialing'])

function idOf(value: RelationshipValue): string | null {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (value && typeof value === 'object' && value.id) return String(value.id)
  return null
}

function idsOf(value: unknown): string[] {
  if (!Array.isArray(value)) {
    const id = idOf(value as RelationshipValue)
    return id ? [id] : []
  }

  return value.map((item) => idOf(item as RelationshipValue)).filter((id): id is string => Boolean(id))
}

function isActiveSubscription(subscription: PayloadDocument) {
  if (subscription.cancelAtPeriodEnd || subscription.canceledAt) return false
  return allowedBillingStatuses.has(String(subscription.status) as BillingStatus)
}

function planOf(subscription: PayloadDocument): SubscriptionPlan | null {
  const plan = subscription.plan
  if (plan === 'free' || plan === 'exhibitor' || plan === 'pro' || plan === 'vip') return plan
  return null
}

function allowedPlans(policy: PayloadDocument): SubscriptionPlan[] {
  if (!Array.isArray(policy.allowedPlans)) return []
  return policy.allowedPlans.filter((plan): plan is SubscriptionPlan => {
    return plan === 'free' || plan === 'exhibitor' || plan === 'pro' || plan === 'vip'
  })
}

async function findAll(
  payload: PayloadCourseAccessAPI,
  collection: string,
  args: {
    where?: Record<string, unknown>
    limit?: number
    sort?: string
  } = {}
) {
  const result = await payload.find({
    collection,
    where: args.where,
    limit: args.limit ?? 1000,
    sort: args.sort,
    depth: 0,
    overrideAccess: true,
  })

  return result.docs
}

function activeAccessGroupIdsForMember(accessGroups: PayloadDocument[], memberId: string) {
  return accessGroups
    .filter((group) => group.status === 'active' && idsOf(group.members).includes(memberId))
    .map((group) => String(group.id))
}

function activeGrantMatchesMember(
  grant: PayloadDocument,
  memberId: string,
  groupIds: string[],
  courseId: string
) {
  if (grant.status !== 'active') return false
  if (grant.resourceType !== 'course' || String(grant.resourceId) !== courseId) return false

  const grantMemberId = idOf(grant.member as RelationshipValue)
  if (grantMemberId === memberId) return true

  const grantGroupId = idOf(grant.accessGroup as RelationshipValue)
  return grantGroupId ? groupIds.includes(grantGroupId) : false
}

function policyAllowsSubscription(
  policy: PayloadDocument,
  subscription: PayloadDocument,
  courseId: string
) {
  if (policy.status !== 'active') return false
  if (policy.resourceType !== 'course' || String(policy.resourceId) !== courseId) return false

  const plan = planOf(subscription)
  if (!plan) return false

  return allowedPlans(policy).includes(plan)
}

export async function reconcilePayloadEntitlements(
  payload: PayloadCourseAccessAPI,
  args: ReconcilePayloadEntitlementsArgs = {}
): Promise<ReconciliationReport> {
  const memberLimit = args.memberLimit ?? 100
  const resourceLimit = args.resourceLimit ?? 100
  const now = args.now ?? new Date().toISOString()

  const [members, courses, policies, subscriptions, grants, accessGroups] = await Promise.all([
    findAll(payload, 'payload_members', { limit: memberLimit }),
    findAll(payload, 'payload_courses', {
      where: { status: { equals: 'published' } },
      limit: resourceLimit,
      sort: 'sortOrder',
    }),
    findAll(payload, 'payload_access_policies', { limit: 1000 }),
    findAll(payload, 'payload_subscriptions', { limit: 1000, sort: '-updatedAt' }),
    findAll(payload, 'payload_access_grants', {
      where: { status: { equals: 'active' } },
      limit: 1000,
    }),
    findAll(payload, 'payload_access_groups', { limit: 1000 }),
  ])

  const issues: ReconciliationIssue[] = []
  const memberIds = new Set(members.map((member) => String(member.id)))
  const courseIds = new Set(courses.map((course) => String(course.id)))
  const groupIds = new Set(accessGroups.map((group) => String(group.id)))
  let decisions = 0

  for (const grant of grants) {
    const grantId = String(grant.id)
    const memberId = idOf(grant.member as RelationshipValue)
    const accessGroupId = idOf(grant.accessGroup as RelationshipValue)
    const resourceId = String(grant.resourceId ?? '')

    if (memberId && !memberIds.has(memberId)) {
      issues.push({
        code: 'orphan_grant_member_missing',
        severity: 'error',
        memberId,
        resourceType: String(grant.resourceType ?? ''),
        resourceId,
        grantId,
        detail: `Active grant ${grantId} references missing member ${memberId}.`,
      })
    }

    if (accessGroupId && !groupIds.has(accessGroupId)) {
      issues.push({
        code: 'orphan_grant_group_missing',
        severity: 'error',
        resourceType: String(grant.resourceType ?? ''),
        resourceId,
        grantId,
        detail: `Active grant ${grantId} references missing access group ${accessGroupId}.`,
      })
    }

    if (grant.resourceType === 'course' && !courseIds.has(resourceId)) {
      issues.push({
        code: 'orphan_grant_resource_missing',
        severity: 'error',
        memberId,
        resourceType: 'course',
        resourceId,
        grantId,
        detail: `Active grant ${grantId} references missing course ${resourceId}.`,
      })
    }
  }

  for (const member of members) {
    const memberId = String(member.id)
    const memberSubscriptions = subscriptions.filter((subscription) => {
      return idOf(subscription.member as RelationshipValue) === memberId
    })
    const activeSubscriptions = memberSubscriptions.filter(isActiveSubscription)
    const memberGroupIds = activeAccessGroupIdsForMember(accessGroups, memberId)

    for (const course of courses) {
      const courseId = String(course.id)
      const result = await evaluatePayloadCourseAccess(payload, {
        memberId,
        courseId,
        now,
      })
      decisions += 1

      const expectedBySubscription = activeSubscriptions.find((subscription) => {
        return policies.some((policy) => policyAllowsSubscription(policy, subscription, courseId))
      })

      if (expectedBySubscription && !result.decision.allowed) {
        issues.push({
          code: 'subscription_expected_allow_denied',
          severity: 'error',
          memberId,
          resourceType: 'course',
          resourceId: courseId,
          subscriptionId: String(expectedBySubscription.id),
          decision: result.decision,
          detail: `Member ${memberId} has an active matching subscription for course ${courseId}, but effective access denied with ${result.decision.reason}.`,
        })
      }

      const expectedByGrant = grants.find((grant) => {
        return activeGrantMatchesMember(grant, memberId, memberGroupIds, courseId)
      })

      if (expectedByGrant && !result.decision.allowed && result.decision.reason !== 'billing_not_active') {
        issues.push({
          code: 'active_grant_denied',
          severity: 'warning',
          memberId,
          resourceType: 'course',
          resourceId: courseId,
          grantId: String(expectedByGrant.id),
          decision: result.decision,
          detail: `Member ${memberId} has active grant ${expectedByGrant.id} for course ${courseId}, but effective access denied with ${result.decision.reason}.`,
        })
      }
    }
  }

  return {
    checkedAt: new Date(now).toISOString(),
    dryRun: true,
    totals: {
      members: members.length,
      courses: courses.length,
      policies: policies.length,
      subscriptions: subscriptions.length,
      activeGrants: grants.length,
      decisions,
      issues: issues.length,
    },
    issues,
  }
}
