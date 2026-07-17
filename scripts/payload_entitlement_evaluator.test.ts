import assert from 'node:assert/strict'

import {
  evaluateAccess,
  type EvaluateAccessInput,
} from '../src/lib/entitlements/evaluateAccess'

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`ok - ${name}`)
  } catch (error) {
    console.error(`fail - ${name}`)
    console.error(error)
    process.exitCode = 1
  }
}

const publishedCourse: EvaluateAccessInput['resource'] = {
  type: 'course',
  id: 'course_1',
  status: 'published',
  privacy: 'private',
}

const activeMember: EvaluateAccessInput['member'] = {
  id: 'member_1',
  accountStatus: 'active',
  emailVerified: true,
  groupIds: ['group_1'],
}

run('allows anonymous access to published public resources', () => {
  const decision = evaluateAccess({
    resource: {
      ...publishedCourse,
      privacy: 'public',
    },
  })

  assert.equal(decision.allowed, true)
  assert.equal(decision.reason, 'public_resource')
})

run('denies unpublished content before evaluating grants', () => {
  const decision = evaluateAccess({
    member: activeMember,
    resource: {
      ...publishedCourse,
      status: 'draft',
    },
    grants: [
      {
        id: 'grant_1',
        memberId: 'member_1',
        resourceType: 'course',
        resourceId: 'course_1',
        status: 'active',
      },
    ],
  })

  assert.equal(decision.allowed, false)
  assert.equal(decision.reason, 'content_not_published')
})

run('denies blocked members even when they have a direct grant', () => {
  const decision = evaluateAccess({
    member: {
      ...activeMember,
      accountStatus: 'blocked',
    },
    resource: publishedCourse,
    grants: [
      {
        id: 'grant_1',
        memberId: 'member_1',
        resourceType: 'course',
        resourceId: 'course_1',
        status: 'active',
      },
    ],
  })

  assert.equal(decision.allowed, false)
  assert.equal(decision.reason, 'account_not_active')
})

run('denies failed billing before allowing subscription plans', () => {
  const decision = evaluateAccess({
    member: activeMember,
    billing: {
      status: 'past_due',
      plan: 'pro',
      lifecycleState: 'past_due',
      subscriptionStatus: 'past_due',
    },
    resource: publishedCourse,
    policy: {
      status: 'active',
      allowedPlans: ['pro'],
      requireActiveBilling: true,
    },
  })

  assert.equal(decision.allowed, false)
  assert.equal(decision.reason, 'billing_not_active')
})

run('allows billing hold subscriptions during grace', () => {
  const decision = evaluateAccess({
    member: activeMember,
    billing: {
      status: 'past_due',
      plan: 'pro',
      lifecycleState: 'past_due',
      subscriptionStatus: 'past_due',
      graceEndsAt: '2026-06-30T00:00:00.000Z',
      paymentStatus: 'failed',
    },
    resource: publishedCourse,
    policy: {
      status: 'active',
      allowedPlans: ['pro'],
      requireActiveBilling: true,
    },
    now: '2026-06-21T00:00:00.000Z',
  })

  assert.equal(decision.allowed, true)
  assert.equal(decision.reason, 'subscription_plan')
})

run('denies canceled subscriptions before allowing direct grants when billing is required', () => {
  const decision = evaluateAccess({
    member: activeMember,
    billing: {
      status: 'canceled',
      plan: 'pro',
    },
    resource: publishedCourse,
    policy: {
      status: 'active',
      requireActiveBilling: true,
    },
    grants: [
      {
        id: 'grant_1',
        memberId: 'member_1',
        resourceType: 'course',
        resourceId: 'course_1',
        status: 'active',
      },
    ],
  })

  assert.equal(decision.allowed, false)
  assert.equal(decision.reason, 'billing_not_active')
})

run('allows direct manual grants when billing is explicitly not required', () => {
  const decision = evaluateAccess({
    member: activeMember,
    billing: {
      status: 'none',
      plan: null,
    },
    resource: publishedCourse,
    policy: {
      status: 'active',
      requireActiveBilling: false,
    },
    grants: [
      {
        id: 'grant_1',
        memberId: 'member_1',
        resourceType: 'course',
        resourceId: 'course_1',
        status: 'active',
      },
    ],
  })

  assert.equal(decision.allowed, true)
  assert.equal(decision.reason, 'direct_grant')
})

run('allows required group membership when billing is active', () => {
  const decision = evaluateAccess({
    member: activeMember,
    billing: {
      status: 'active',
      plan: 'pro',
      lifecycleState: 'active',
      subscriptionStatus: 'active',
    },
    resource: publishedCourse,
    policy: {
      status: 'active',
      requiredGroupIds: ['group_1'],
      requireActiveBilling: true,
    },
  })

  assert.equal(decision.allowed, true)
  assert.equal(decision.reason, 'required_group')
})

run('ignores expired grants', () => {
  const decision = evaluateAccess({
    member: activeMember,
    resource: publishedCourse,
    policy: {
      status: 'active',
      requireActiveBilling: false,
    },
    grants: [
      {
        id: 'grant_1',
        memberId: 'member_1',
        resourceType: 'course',
        resourceId: 'course_1',
        status: 'active',
        expiresAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    now: '2026-06-21T00:00:00.000Z',
  })

  assert.equal(decision.allowed, false)
  assert.equal(decision.reason, 'no_matching_entitlement')
})

run('allows published preview lessons when policy permits preview access', () => {
  const decision = evaluateAccess({
    resource: {
      type: 'lesson',
      id: 'lesson_1',
      status: 'published',
      privacy: 'private',
      isPreview: true,
    },
    policy: {
      status: 'active',
      allowPreviewLessons: true,
    },
  })

  assert.equal(decision.allowed, true)
  assert.equal(decision.reason, 'preview_lesson')
})

run('denies lessons that require prior completion', () => {
  const decision = evaluateAccess({
    member: activeMember,
    billing: {
      status: 'active',
      plan: 'pro',
    },
    resource: {
      type: 'lesson',
      id: 'lesson_2',
      status: 'published',
      privacy: 'private',
    },
    policy: {
      status: 'active',
      allowedPlans: ['pro'],
      requireActiveBilling: true,
    },
    lessonRules: {
      requiresPreviousCompletion: true,
      previousLessonCompleted: false,
    },
  })

  assert.equal(decision.allowed, false)
  assert.equal(decision.reason, 'previous_lesson_required')
})

run('requires verified email when policy demands it', () => {
  const decision = evaluateAccess({
    member: {
      ...activeMember,
      emailVerified: false,
    },
    billing: {
      status: 'active',
      plan: 'pro',
    },
    resource: publishedCourse,
    policy: {
      status: 'active',
      allowedPlans: ['pro'],
      requireVerifiedEmail: true,
      requireActiveBilling: true,
    },
  })

  assert.equal(decision.allowed, false)
  assert.equal(decision.reason, 'email_not_verified')
})
