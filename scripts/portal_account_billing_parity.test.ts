import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import type { BillingStatus } from '../src/lib/billing/billingStatusHelper'
import type { MemberBillingOverview } from '../src/lib/payloadCourse/memberPortal'
import { resolvePortalBillingPresentation } from '../src/lib/portal/portalBillingPresentation'

const portalSectionsSource = readFileSync('src/app/(frontend)/portal/[section]/page.tsx', 'utf8')
const removedImportPattern = new RegExp(`(?:from|import).+${'learn'}/`)

function billingStatus(overrides: Partial<BillingStatus> = {}): BillingStatus {
  return {
    hasBillingAccount: false,
    hasActiveSubscription: false,
    planLabel: null,
    subscriptionStatus: null,
    membershipStatus: 'unreconciled',
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
    'Account status',
    'Membership',
    'Email verified',
  ]) {
    assert.match(portalSectionsSource, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }

  assert.match(portalSectionsSource, /getMemberAccountOverview\(payload, memberId\)/)
  assert.match(portalSectionsSource, /collection: 'payload_members'/)
  assert.match(portalSectionsSource, /redirect\('\/portal\/account\?updated=1'\)/)
  assert.match(portalSectionsSource, /redirect\(`\/portal\/account\?error=\$\{errorParam\}`\)/)
  assert.doesNotMatch(portalSectionsSource, removedImportPattern)
}

function testCanonicalBillingParity(): void {
  assert.match(portalSectionsSource, /getBillingStatus\(memberEmail\)/)
  assert.match(portalSectionsSource, /getMemberBillingOverview\(payload, memberId\)/)
  assert.match(portalSectionsSource, /resolvePortalBillingPresentation\(/)
  assert.match(portalSectionsSource, /billingStatus\.hasActiveSubscription\s*\|\|\s*billingOverview\.hasPaidSubscription/)
  assert.match(portalSectionsSource, /Billing details/)
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
  assert.equal(activePresentation.billingCadenceLabel, 'Monthly')
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
  assert.equal(fallbackPresentation.displayPlanLabel, 'JPV Bootcamp Membership')
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

try {
  testCanonicalAccountParity()
  testCanonicalBillingParity()
  testBillingPrecedenceRules()
  console.log('portal_account_billing_parity.test.ts passed')
} catch (error) {
  console.error(
    'portal_account_billing_parity.test.ts failed',
    error instanceof Error ? error.message : error,
  )
  process.exitCode = 1
}
