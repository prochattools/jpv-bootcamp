import {
  evaluateAccess,
  type AccessDecision,
  type BillingAccessContext,
  type BillingStatus,
  type ContentStatus,
  type GrantAccessContext,
  type MemberAccessContext,
  type PolicyAccessContext,
  type ResourceAccessContext,
  type ResourcePrivacy,
  type ResourceType,
  type SubscriptionPlan,
} from '@/lib/entitlements/evaluateAccess'

export type PayloadId = string | number

export type PayloadDocument = {
  id: PayloadId
  [key: string]: unknown
}

type PayloadFindResult = {
  docs: PayloadDocument[]
}

type PayloadFindArgs = {
  collection: string
  where?: Record<string, unknown>
  limit?: number
  depth?: number
  sort?: string
  overrideAccess?: boolean
}

type PayloadFindByIDArgs = {
  collection: string
  id: PayloadId
  depth?: number
  overrideAccess?: boolean
}

type PayloadCountArgs = {
  collection: string
  where?: Record<string, unknown>
  overrideAccess?: boolean
}

type PayloadCountResult = {
  totalDocs: number
}

export type PayloadCourseAccessAPI = {
  find(args: PayloadFindArgs): Promise<PayloadFindResult>
  findByID(args: PayloadFindByIDArgs): Promise<PayloadDocument>
  count?(args: PayloadCountArgs): Promise<PayloadCountResult>
}

export type PayloadCourseWriteAPI = PayloadCourseAccessAPI & {
  create(args: {
    collection: string
    data: Record<string, unknown>
    overrideAccess?: boolean
  }): Promise<PayloadDocument>
  update(args: {
    collection: string
    id: PayloadId
    data: Record<string, unknown>
    overrideAccess?: boolean
  }): Promise<PayloadDocument>
}

export type PayloadMemberAuthAPI = PayloadCourseWriteAPI & {
  login(args: {
    collection: 'payload_members'
    data: {
      email: string
      password: string
    }
    overrideAccess?: boolean
  }): Promise<{
    user?: PayloadDocument | null
    token?: string | null
    exp?: number | null
  }>
  forgotPassword(args: {
    collection: 'payload_members'
    data: {
      email: string
    }
    disableEmail: true
  }): Promise<string | { token?: string | null } | null | undefined>
  resetPassword(args: {
    collection: 'payload_members'
    data: {
      password: string
      token: string
    }
  }): Promise<unknown>
}

export type PayloadAccessServiceResult = {
  decision: AccessDecision
  resource?: {
    type: ResourceType
    id: string
    title?: string | null
    slug?: string | null
  }
  policyId?: string | null
  memberId?: string | null
}

export type EvaluatePayloadCourseAccessArgs = {
  memberId?: PayloadId | null
  courseId?: PayloadId | null
  courseSlug?: string | null
  now?: Date | string
}

export type EvaluatePayloadSpaceAccessArgs = {
  memberId?: PayloadId | null
  spaceId?: PayloadId | null
  spaceSlug?: string | null
  now?: Date | string
}

export type EvaluatePayloadLessonAccessArgs = EvaluatePayloadCourseAccessArgs & {
  lessonId?: PayloadId | null
  lessonSlug?: string | null
  requiresPreviousCompletion?: boolean
  previousLessonId?: PayloadId | null
}

const billingAllowedStatuses = new Set<BillingStatus>(['active', 'trialing'])

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null
  return value as Record<string, unknown>
}

function asString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value
  if (typeof value === 'number') return String(value)
  return null
}

function getDocumentId(value: unknown): string | null {
  const direct = asString(value)
  if (direct) return direct

  const record = asRecord(value)
  if (!record) return null

  return asString(record.id)
}

function getRelationshipIds(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(getDocumentId).filter((id): id is string => Boolean(id))
  }

  const id = getDocumentId(value)
  return id ? [id] : []
}

function normalizeContentStatus(value: unknown): ContentStatus {
  if (value === 'published' || value === 'archived' || value === 'draft') return value
  return 'draft'
}

function normalizeCoursePrivacy(value: unknown): ResourcePrivacy {
  if (value === 'public' || value === 'members') return value
  if (value === 'secret') return 'secret'
  return 'private'
}

function normalizeSpacePrivacy(value: unknown): ResourcePrivacy {
  if (value === 'public' || value === 'members' || value === 'private' || value === 'secret') {
    return value
  }

  return 'private'
}

function normalizePolicyPrivacy(value: unknown): ResourcePrivacy | undefined {
  if (value === 'public' || value === 'members' || value === 'private' || value === 'secret') {
    return value
  }
  return undefined
}

function normalizeBillingStatus(value: unknown): BillingStatus {
  if (
    value === 'none' ||
    value === 'active' ||
    value === 'trialing' ||
    value === 'billing_hold' ||
    value === 'past_due' ||
    value === 'unpaid' ||
    value === 'canceled' ||
    value === 'incomplete' ||
    value === 'incomplete_expired' ||
    value === 'paused'
  ) {
    return value
  }

  return 'none'
}

function normalizePlan(value: unknown): SubscriptionPlan | null {
  if (value === 'free' || value === 'exhibitor' || value === 'pro' || value === 'vip') {
    return value
  }

  return null
}

function normalizeAllowedPlans(value: unknown): SubscriptionPlan[] {
  if (!Array.isArray(value)) return []
  return value.map(normalizePlan).filter((plan): plan is SubscriptionPlan => Boolean(plan))
}

function failClosed(reason: AccessDecision['reason'], evidence?: Record<string, unknown>) {
  return { decision: { allowed: false, reason, evidence } satisfies AccessDecision }
}

async function findOne(
  payload: PayloadCourseAccessAPI,
  collection: string,
  where: Record<string, unknown>,
  sort?: string
): Promise<PayloadDocument | null> {
  const result = await payload.find({
    collection,
    where,
    limit: 1,
    depth: 0,
    sort,
    overrideAccess: true,
  })

  return result.docs[0] ?? null
}

async function findCourse(
  payload: PayloadCourseAccessAPI,
  args: EvaluatePayloadCourseAccessArgs
): Promise<PayloadDocument | null> {
  if (args.courseId) {
    try {
      return await payload.findByID({
        collection: 'payload_courses',
        id: args.courseId,
        depth: 0,
        overrideAccess: true,
      })
    } catch {
      return null
    }
  }

  if (!args.courseSlug) return null

  return findOne(payload, 'payload_courses', {
    slug: { equals: args.courseSlug },
  })
}

async function findSpace(
  payload: PayloadCourseAccessAPI,
  args: EvaluatePayloadSpaceAccessArgs
): Promise<PayloadDocument | null> {
  if (args.spaceId) {
    try {
      return await payload.findByID({
        collection: 'payload_spaces',
        id: args.spaceId,
        depth: 0,
        overrideAccess: true,
      })
    } catch {
      return null
    }
  }

  if (!args.spaceSlug) return null

  return findOne(payload, 'payload_spaces', {
    slug: { equals: args.spaceSlug },
  })
}

async function findLesson(
  payload: PayloadCourseAccessAPI,
  args: EvaluatePayloadLessonAccessArgs
): Promise<PayloadDocument | null> {
  if (args.lessonId) {
    try {
      return await payload.findByID({
        collection: 'payload_lessons',
        id: args.lessonId,
        depth: 0,
        overrideAccess: true,
      })
    } catch {
      return null
    }
  }

  if (!args.lessonSlug) return null

  return findOne(payload, 'payload_lessons', {
    slug: { equals: args.lessonSlug },
  })
}

async function findByIdSafe(
  payload: PayloadCourseAccessAPI,
  collection: string,
  id: PayloadId | null | undefined
): Promise<PayloadDocument | null> {
  if (!id) return null

  try {
    return await payload.findByID({
      collection,
      id,
      depth: 0,
      overrideAccess: true,
    })
  } catch {
    return null
  }
}

async function getMemberContext(
  payload: PayloadCourseAccessAPI,
  memberId: PayloadId | null | undefined
): Promise<MemberAccessContext | null> {
  if (!memberId) return null

  const member = await findByIdSafe(payload, 'payload_members', memberId)
  if (!member) return null

  const groupResult = await payload.find({
    collection: 'payload_access_groups',
    where: {
      status: { equals: 'active' },
    },
    limit: 200,
    depth: 0,
    overrideAccess: true,
  })

  const id = String(member.id)
  const groupIds = groupResult.docs
    .filter((group) => getRelationshipIds(group.members).includes(id))
    .map((group) => String(group.id))

  return {
    id,
    accountStatus: member.accountStatus === 'active' ? 'active' : String(member.accountStatus ?? 'pending') as MemberAccessContext['accountStatus'],
    emailVerified: Boolean(member.emailVerifiedAt),
    groupIds,
  }
}

async function getBillingContext(
  payload: PayloadCourseAccessAPI,
  memberId: string | null | undefined
): Promise<BillingAccessContext | null> {
  if (!memberId) return null

  const subscriptions = await payload.find({
    collection: 'payload_subscriptions',
    where: {
      member: { equals: memberId },
    },
    limit: 10,
    depth: 0,
    sort: '-updatedAt',
    overrideAccess: true,
  })

  const subscription =
    subscriptions.docs.find((doc) => billingAllowedStatuses.has(normalizeBillingStatus(doc.status))) ??
    subscriptions.docs[0]

  if (subscription) {
    const subscriptionStatus =
      subscription.cancelAtPeriodEnd || subscription.canceledAt
        ? 'canceled'
        : normalizeBillingStatus(subscription.status)

    return {
      status: subscriptionStatus,
      plan: normalizePlan(subscription.plan),
    }
  }

  const billingAccount = await findOne(
    payload,
    'payload_billing_accounts',
    { member: { equals: memberId } },
    '-updatedAt'
  )

  if (!billingAccount) return { status: 'none', plan: null }

  return {
    status: normalizeBillingStatus(billingAccount.billingStatus),
    plan: null,
  }
}

async function getPolicyContext(
  payload: PayloadCourseAccessAPI,
  resource: Pick<ResourceAccessContext, 'type' | 'id'>
): Promise<{ id: string | null; policy: PolicyAccessContext | null }> {
  const result = await payload.find({
    collection: 'payload_access_policies',
    where: {
      and: [
        { resourceType: { equals: resource.type } },
        { resourceId: { equals: resource.id } },
      ],
    },
    limit: 10,
    depth: 0,
    sort: 'priority',
    overrideAccess: true,
  })

  const doc = result.docs[0]
  if (!doc) return { id: null, policy: null }

  return {
    id: String(doc.id),
    policy: {
      status: doc.status === 'active' ? 'active' : String(doc.status ?? 'draft') as PolicyAccessContext['status'],
      privacy: normalizePolicyPrivacy(doc.privacy),
      allowedPlans: normalizeAllowedPlans(doc.allowedPlans),
      requiredGroupIds: getRelationshipIds(doc.requiredGroups),
      requireActiveBilling: Boolean(doc.requireActiveBilling),
      allowPreviewLessons: Boolean(doc.allowPreviewLessons),
      startsAt: doc.startsAt as PolicyAccessContext['startsAt'],
      endsAt: doc.endsAt as PolicyAccessContext['endsAt'],
    },
  }
}

async function getGrantContexts(
  payload: PayloadCourseAccessAPI,
  resource: Pick<ResourceAccessContext, 'type' | 'id'>
): Promise<GrantAccessContext[]> {
  const result = await payload.find({
    collection: 'payload_access_grants',
    where: {
      and: [
        { resourceType: { equals: resource.type } },
        { resourceId: { equals: resource.id } },
      ],
    },
    limit: 200,
    depth: 0,
    overrideAccess: true,
  })

  return result.docs.map((doc) => ({
    id: String(doc.id),
    memberId: getDocumentId(doc.member),
    groupId: getDocumentId(doc.accessGroup),
    resourceType: resource.type,
    resourceId: resource.id,
    status: doc.status === 'active' ? 'active' : String(doc.status ?? 'pending') as GrantAccessContext['status'],
    startsAt: doc.startsAt as GrantAccessContext['startsAt'],
    expiresAt: doc.expiresAt as GrantAccessContext['expiresAt'],
  }))
}

async function getSpaceMembershipGrantContexts(
  payload: PayloadCourseAccessAPI,
  memberId: PayloadId | null | undefined,
  spaceId: PayloadId
): Promise<GrantAccessContext[]> {
  if (!memberId) return []

  const result = await payload.find({
    collection: 'payload_space_memberships',
    where: {
      and: [
        { member: { equals: String(memberId) } },
        { space: { equals: String(spaceId) } },
      ],
    },
    limit: 20,
    depth: 0,
    overrideAccess: true,
  })

  return result.docs
    .filter((doc) => doc.status === 'active')
    .map((doc): GrantAccessContext => ({
      id: `space-membership:${doc.id}`,
      memberId: String(memberId),
      groupId: null,
      resourceType: 'space',
      resourceId: String(spaceId),
      status: 'active',
      startsAt: doc.joinedAt as GrantAccessContext['startsAt'],
      expiresAt: doc.expiresAt as GrantAccessContext['expiresAt'],
    }))
}

async function hasCompletedLesson(
  payload: PayloadCourseAccessAPI,
  memberId: string | null | undefined,
  lessonId: PayloadId | null | undefined
): Promise<boolean> {
  if (!memberId || !lessonId) return false

  const result = await payload.find({
    collection: 'payload_lesson_progress',
    where: {
      and: [
        { member: { equals: memberId } },
        { lesson: { equals: String(lessonId) } },
        { status: { equals: 'completed' } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  return result.docs.length > 0
}

function courseResource(course: PayloadDocument): ResourceAccessContext {
  return {
    type: 'course',
    id: String(course.id),
    status: normalizeContentStatus(course.status),
    privacy: normalizeCoursePrivacy(course.visibility),
  }
}

function spaceResource(space: PayloadDocument): ResourceAccessContext {
  return {
    type: 'space',
    id: String(space.id),
    status: normalizeContentStatus(space.status),
    privacy: normalizeSpacePrivacy(space.visibility),
  }
}

function lessonResource(lesson: PayloadDocument, course: PayloadDocument): ResourceAccessContext {
  return {
    type: 'lesson',
    id: String(lesson.id),
    status: normalizeContentStatus(course.status),
    privacy: normalizeCoursePrivacy(course.visibility),
    isPreview: Boolean(lesson.previewLesson),
  }
}

async function evaluatePayloadResourceAccess(
  payload: PayloadCourseAccessAPI,
  args: {
    memberId?: PayloadId | null
    resource: ResourceAccessContext
    fallbackPolicyResource?: Pick<ResourceAccessContext, 'type' | 'id'> | null
    title?: string | null
    slug?: string | null
    now?: Date | string
    requiresPreviousCompletion?: boolean
    previousLessonId?: PayloadId | null
    additionalGrants?: GrantAccessContext[]
  }
): Promise<PayloadAccessServiceResult> {
  const member = await getMemberContext(payload, args.memberId)
  const billing = await getBillingContext(payload, member?.id)
  const policyMatch = await getPolicyContext(payload, args.resource)
  const fallbackPolicyMatch =
    policyMatch.policy || !args.fallbackPolicyResource
      ? { id: null, policy: null }
      : await getPolicyContext(payload, args.fallbackPolicyResource)
  const activePolicy = policyMatch.policy ?? fallbackPolicyMatch.policy
  const policyId = policyMatch.id ?? fallbackPolicyMatch.id
  const grants = await getGrantContexts(payload, args.resource)
  const fallbackGrants =
    grants.length > 0 || !args.fallbackPolicyResource
      ? []
      : await getGrantContexts(payload, args.fallbackPolicyResource)

  const previousLessonCompleted = await hasCompletedLesson(
    payload,
    member?.id,
    args.previousLessonId
  )

  const decision = evaluateAccess({
    member,
    billing,
    resource: args.resource,
    policy: activePolicy,
    grants: [...grants, ...fallbackGrants, ...(args.additionalGrants ?? [])].map((grant) => ({
      ...grant,
      resourceType: args.resource.type,
      resourceId: args.resource.id,
    })),
    lessonRules: args.requiresPreviousCompletion
      ? {
          requiresPreviousCompletion: true,
          previousLessonCompleted,
        }
      : null,
    now: args.now,
  })

  return {
    decision,
    policyId,
    memberId: member?.id ?? null,
    resource: {
      type: args.resource.type,
      id: args.resource.id,
      title: args.title ?? null,
      slug: args.slug ?? null,
    },
  }
}

export async function evaluatePayloadSpaceAccess(
  payload: PayloadCourseAccessAPI,
  args: EvaluatePayloadSpaceAccessArgs
): Promise<PayloadAccessServiceResult> {
  const space = await findSpace(payload, args)
  if (!space) {
    return failClosed('content_not_published', { resourceType: 'space', notFound: true })
  }

  const membershipGrants = await getSpaceMembershipGrantContexts(
    payload,
    args.memberId,
    space.id
  )

  return evaluatePayloadResourceAccess(payload, {
    memberId: args.memberId,
    resource: spaceResource(space),
    title: asString(space.name),
    slug: asString(space.slug),
    now: args.now,
    additionalGrants: membershipGrants,
  })
}

export async function evaluatePayloadCourseAccess(
  payload: PayloadCourseAccessAPI,
  args: EvaluatePayloadCourseAccessArgs
): Promise<PayloadAccessServiceResult> {
  const course = await findCourse(payload, args)
  if (!course) {
    return failClosed('content_not_published', { resourceType: 'course', notFound: true })
  }

  return evaluatePayloadResourceAccess(payload, {
    memberId: args.memberId,
    resource: courseResource(course),
    title: asString(course.title),
    slug: asString(course.slug),
    now: args.now,
  })
}

export async function evaluatePayloadLessonAccess(
  payload: PayloadCourseAccessAPI,
  args: EvaluatePayloadLessonAccessArgs
): Promise<PayloadAccessServiceResult> {
  const lesson = await findLesson(payload, args)
  if (!lesson) {
    return failClosed('content_not_published', { resourceType: 'lesson', notFound: true })
  }

  const moduleId = getDocumentId(lesson.module)
  const module = await findByIdSafe(payload, 'payload_course_modules', moduleId)
  const courseId = getDocumentId(module?.course)
  const course = await findByIdSafe(payload, 'payload_courses', courseId)

  if (!module || !course) {
    return failClosed('content_not_published', {
      resourceType: 'lesson',
      lessonId: String(lesson.id),
      missingParent: !module ? 'module' : 'course',
    })
  }

  const resource = lessonResource(lesson, course)
  const coursePolicyResource = { type: 'course' as const, id: String(course.id) }

  return evaluatePayloadResourceAccess(payload, {
    memberId: args.memberId,
    resource,
    fallbackPolicyResource: coursePolicyResource,
    title: asString(lesson.title),
    slug: asString(lesson.slug),
    now: args.now,
    requiresPreviousCompletion: args.requiresPreviousCompletion,
    previousLessonId: args.previousLessonId,
  })
}
