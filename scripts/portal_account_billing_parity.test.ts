import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

import type { BillingStatus } from '../src/lib/billing/billingStatusHelper'
import type { MemberBillingOverview } from '../src/lib/payloadCourse/memberPortal'
import { resolvePortalBillingPresentation } from '../src/lib/portal/portalBillingPresentation'

const portalSectionsSource = readFileSync('src/app/(frontend)/portal/[section]/page.tsx', 'utf8')
const learnIndexSource = readFileSync('src/app/(frontend)/learn/page.tsx', 'utf8')
const learnAccountSource = readFileSync('src/app/(frontend)/learn/account/page.tsx', 'utf8')
const learnBillingSource = readFileSync('src/app/(frontend)/learn/billing/page.tsx', 'utf8')
const learnLoginSource = readFileSync('src/app/(frontend)/learn/login/page.tsx', 'utf8')

function billingStatus(overrides: Partial<BillingStatus> = {}): BillingStatus {
  return {
    hasBillingAccount: false,
    hasActiveSubscription: false,
    planLabel: null,
    subscriptionStatus: null,
    billingAccessState: 'unknown',
    periodEndDate: null,
    cancelAtPeriodEnd: false,
    billingCadence: null,
    commitmentStatus: null,
    commitmentStartAt: null,
    commitmentEndAt: null,
    cancellationRequestedAt: null,
    cancellationEffectiveAt: null,
    paymentGraceEndsAt: null,
    withinPaymentGrace: false,
    restrictedPortalRequired: false,
    paymentStatus: null,
    paymentFailedAt: null,
    paymentRefundedAt: null,
    paymentDisputeStatus: null,
    paymentDisputedAt: null,
    paymentDisputeResolvedAt: null,
    showPaymentWarning: false,
    showRefundNotice: false,
    showDisputeNotice: false,
    manageBillingAvailable: false,
    ...overrides,
  }
}

function billingOverview(overrides: Partial<MemberBillingOverview> = {}): MemberBillingOverview {
  return {
    billingAccount: null,
    subscription: null,
    hasPaidSubscription: false,
    plan: 'free',
    billingStatus: null,
    subscriptionStatus: null,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
    ...overrides,
  }
}

function testCanonicalAccountParity(): void {
  for (const expected of [
    'PasswordChangeForm',
    'EmailChangeForm',
    'Edit profile',
    'Change password',
    'Change email address',
    'Access plans',
    'Access groups',
    'Billing projection',
    'Account status',
    'Member tier',
    'Email verified',
  ]) {
    assert.match(portalSectionsSource, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }

  assert.match(portalSectionsSource, /getMemberAccountOverview\(payload, memberId\)/)
  assert.match(portalSectionsSource, /collection: 'payload_members'/)
  assert.match(portalSectionsSource, /redirect\('\/portal\/account\?updated=1'\)/)
  assert.match(portalSectionsSource, /redirect\('\/portal\/account\?error=display-name'\)/)
}

function testCanonicalBillingParity(): void {
  assert.match(portalSectionsSource, /getBillingStatus\(memberEmail\)/)
  assert.match(portalSectionsSource, /getMemberBillingOverview\(payload, memberId\)/)
  assert.match(portalSectionsSource, /resolvePortalBillingPresentation\(/)
  assert.match(portalSectionsSource, /Billing projection summary/)
  assert.match(portalSectionsSource, /Manage subscription/)
  assert.match(portalSectionsSource, /MemberCheckoutButtons/)
  assert.match(portalSectionsSource, /BillingPortalButton/)
  assert.match(portalSectionsSource, /requestMembershipCancellation/)
  assert.match(portalSectionsSource, /checkout === 'success'/)
  assert.match(portalSectionsSource, /checkout === 'cancelled'/)
  assert.match(portalSectionsSource, /cancellationRequested === '1'/)
  assert.match(portalSectionsSource, /cancellationError === 'billing_record_missing'/)
  assert.match(portalSectionsSource, /cancellationError === 'invalid_email'/)
}

function testBillingPrecedenceRules(): void {
  const activeStatus = billingStatus({
    hasBillingAccount: true,
    hasActiveSubscription: true,
    planLabel: 'Pro',
    subscriptionStatus: 'active',
    periodEndDate: new Date('2026-08-01T00:00:00.000Z'),
    billingCadence: 'monthly_commitment',
    commitmentStatus: 'active',
  })
  const mirrorOverview = billingOverview({
    billingAccount: { billingStatus: 'active', stripeMode: 'test', updatedAt: '2026-07-01T00:00:00.000Z' },
    subscription: { id: 'sub_1', plan: 'pro', status: 'active', cancelAtPeriodEnd: false, currentPeriodEnd: '2026-08-05T00:00:00.000Z' },
    hasPaidSubscription: true,
    plan: 'pro',
    billingStatus: 'active',
    subscriptionStatus: 'active',
    currentPeriodEnd: '2026-08-05T00:00:00.000Z',
  })
  const activePresentation = resolvePortalBillingPresentation(activeStatus, mirrorOverview)
  assert.equal(activePresentation.displayPlanLabel, 'Pro')
  assert.equal(activePresentation.displaySubscriptionStatus, 'active')
  assert.equal(activePresentation.billingCadenceLabel, 'Monthly commitment')
  assert.equal(activePresentation.commitmentStatusLabel, 'Active')
  assert.equal(activePresentation.allowCheckout, false)
  assert.equal(activePresentation.projectionSyncState, null)

  const fallbackPresentation = resolvePortalBillingPresentation(
    billingStatus(),
    billingOverview({
      billingAccount: { billingStatus: 'active', stripeMode: 'test', updatedAt: '2026-07-01T00:00:00.000Z' },
      subscription: { id: 'sub_2', plan: 'pro', status: 'active', cancelAtPeriodEnd: false, currentPeriodEnd: '2026-09-01T00:00:00.000Z' },
      hasPaidSubscription: true,
      plan: 'pro',
      billingStatus: 'active',
      subscriptionStatus: 'active',
      currentPeriodEnd: '2026-09-01T00:00:00.000Z',
    }),
  )
  assert.equal(fallbackPresentation.displayPlanLabel, 'Pro')
  assert.equal(fallbackPresentation.displaySubscriptionStatus, 'active')
  assert.equal(fallbackPresentation.allowCheckout, false)
  assert.equal(fallbackPresentation.projectionSyncState, 'status_missing')

  const projectionMissingPresentation = resolvePortalBillingPresentation(
    billingStatus({
      hasBillingAccount: true,
      hasActiveSubscription: false,
      manageBillingAvailable: true,
    }),
    billingOverview(),
  )
  assert.equal(projectionMissingPresentation.projectionSyncState, 'projection_missing')
  assert.equal(projectionMissingPresentation.allowCheckout, true)
}

function testLegacyRoutesRedirectToCanonicalPortal(): void {
  assert.match(learnIndexSource, /redirect\('\/portal'\)/)
  assert.match(learnAccountSource, /redirect\(destination\)/)
  assert.match(learnAccountSource, /\/portal\/account/)
  assert.match(learnBillingSource, /redirect\(destination\)/)
  assert.match(learnBillingSource, /\/portal\/billing/)
  assert.match(learnLoginSource, /redirect\('\/portal\?mode=login'\)/)
}

function testDeeperLearnRoutesRemainPresent(): void {
  for (const path of [
    'src/app/(frontend)/learn/[courseSlug]/page.tsx',
    'src/app/(frontend)/learn/[courseSlug]/[lessonSlug]/page.tsx',
    'src/app/(frontend)/learn/community/page.tsx',
    'src/app/(frontend)/learn/community/[spaceSlug]/page.tsx',
    'src/app/(frontend)/learn/community/[spaceSlug]/posts/[postId]/page.tsx',
    'src/app/(frontend)/learn/community/moderation/page.tsx',
    'src/app/(frontend)/learn/community/submissions/page.tsx',
    'src/app/(frontend)/learn/community/files/[fileId]/route.ts',
    'src/app/(frontend)/learn/resources/[resourceId]/route.ts',
  ]) {
    assert.ok(existsSync(path), `expected deeper learn route to remain active: ${path}`)
  }
}

try {
  testCanonicalAccountParity()
  testCanonicalBillingParity()
  testBillingPrecedenceRules()
  testLegacyRoutesRedirectToCanonicalPortal()
  testDeeperLearnRoutesRemainPresent()
  console.log('portal_account_billing_parity.test.ts passed')
} catch (error) {
  console.error(
    'portal_account_billing_parity.test.ts failed',
    error instanceof Error ? error.message : error,
  )
  process.exitCode = 1
}
