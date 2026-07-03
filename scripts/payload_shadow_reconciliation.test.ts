import assert from 'node:assert/strict'

import {
  buildDefaultSnapshot,
  buildShadowValidationReport,
  shadowIssueTotals,
  validateShadowValidationSnapshot,
} from '../src/lib/shadowValidationReport'

async function main(): Promise<void> {
  const healthySnapshot = buildDefaultSnapshot()
  const healthyIssues = validateShadowValidationSnapshot(healthySnapshot)
  assert.equal(healthyIssues.length, 0)

  const healthyReport = await buildShadowValidationReport(
    {
      STRIPE_ENV: 'test',
      STRIPE_SECRET_KEY_TEST: 'sk_test_shadow',
      STRIPE_WEBHOOK_SECRET_TEST: 'whsec_shadow',
      STRIPE_PRICE_PRO_TEST: 'price_pro_shadow',
      STRIPE_PRICE_VIP_TEST: 'price_vip_shadow',
      APP_PUBLIC_URL: 'https://preview.example.test',
      STARTUP_MODE: 'application-only',
      DEPLOYMENT_RUNTIME: 'docker',
    } as unknown as NodeJS.ProcessEnv,
    {
      fixture: {
        repositoryReady: true,
        configurationReady: true,
        cutoverApprovals: {
          migrationExecution: false,
          previewDeployment: false,
          billingWebhookCheckoutPortal: false,
          providerEmailDryRun: false,
          providerEmailApply: false,
          communityJourneyVerification: false,
          partnerDeliveryVerification: false,
          finalCutover: false,
        },
        issueCounts: {
          identity: 0,
          entitlements: 0,
          billing: 0,
          email: 0,
          content: 0,
          community: 0,
          partners: 0,
          release: 0,
        },
      },
    },
  )
  assert.equal(healthyReport.repositoryReady, true)
  assert.equal(healthyReport.configurationReady, true)
  assert.equal(healthyReport.cutoverReady, false)
  assert.deepEqual(shadowIssueTotals(healthyReport), {
    identity: 0,
    entitlements: 0,
    billing: 0,
    email: 0,
    content: 0,
    community: 0,
    partners: 0,
    release: 0,
  })

  const brokenSnapshot = buildDefaultSnapshot()
  brokenSnapshot.members = [
    { id: 'member_a', normalizedEmail: 'Duplicate@Example.test', accountStatus: 'active', emailVerified: true, activeSessionCount: 0, accessRecordCount: 0 },
    { id: 'member_b', normalizedEmail: 'duplicate@example.test', accountStatus: 'active', emailVerified: false, activeSessionCount: 1, accessRecordCount: 1 },
    { id: 'member_c', normalizedEmail: 'member-c@example.test', accountStatus: 'blocked', emailVerified: true, activeSessionCount: 1, accessRecordCount: 1 },
  ]
  brokenSnapshot.invitations = [{ id: 'inv_broken', memberId: null, status: 'pending' }]
  brokenSnapshot.actions = [{ id: 'action_broken', memberId: null, status: 'pending' }]
  brokenSnapshot.modules = [{ id: 'module_broken', courseId: null, slug: 'duplicate-slug', status: 'published' }]
  brokenSnapshot.lessons = [{ id: 'lesson_broken', moduleId: null, slug: 'duplicate-slug', status: 'published' }]
  brokenSnapshot.resources = [{ id: 'resource_broken', lessonId: null, fileId: null, publicVisibility: 'public', status: 'published' }]
  brokenSnapshot.progress = [{ id: 'progress_broken', memberId: null, lessonId: null }]
  brokenSnapshot.billingAccounts = [{ id: 'billing_broken', memberId: null, stripeCustomerId: 'cus_secret_123', billingStatus: 'active' }]
  brokenSnapshot.subscriptions = [{ id: 'sub_broken', memberId: null, billingAccountId: null, stripeSubscriptionId: 'sub_secret_123', status: 'active', plan: 'pro' }]
  brokenSnapshot.payments = [{ id: 'payment_broken', memberId: null, subscriptionId: null, stripeInvoiceId: 'in_secret_123', stripePaymentIntentId: 'pi_secret_123', status: 'failed' }]
  brokenSnapshot.spaces = [{ id: 'space_broken', slug: 'secret-space', visibility: 'secret', status: 'draft' }]
  brokenSnapshot.memberships = [{ id: 'membership_broken', memberId: null, spaceId: null, status: 'pending', role: 'member' }]
  brokenSnapshot.posts = [{ id: 'post_broken', spaceId: null, authorId: null, parentPostId: null, moderationStatus: 'visible' }]
  brokenSnapshot.comments = [{ id: 'comment_broken', postId: null, authorId: null, moderationStatus: 'visible' }]
  brokenSnapshot.files = [{ id: 'file_broken', ownerMemberId: null, spaceId: null, postId: null, visibility: 'private', mimeType: 'image/png' }]
  brokenSnapshot.partners = [{ id: 'partner_broken', slug: 'partner-broken', status: 'paused', applicationMode: 'redirect', trustedDestination: 'https://partner.example.test/secret?token=abc' }]
  brokenSnapshot.partnerApplications = [{ id: 'app_broken', memberId: null, partnerId: null, status: 'delivery_failed', deliveryMethod: 'redirect', deliveryAttempts: 0, applicationReference: 'APP-BROKEN', trustedDestinationSnapshot: 'https://partner.example.test/secret?token=abc', lastDeliveryError: 'provider payload', deliveredAt: null }]
  brokenSnapshot.partnerEvents = [{ id: 'event_broken', partnerId: null, applicationId: null, memberId: null, eventType: '', deliveryMethod: null, sourceRoute: '/out/broken?email=a@example.test' }]
  brokenSnapshot.affiliateReferrals = [{ id: 'referral_broken', memberId: null, affiliateId: null }]
  brokenSnapshot.commissions = [{ id: 'commission_broken', affiliateId: null, referralId: null }]
  brokenSnapshot.emailQueue = [
    { id: 'email_broken_1', templateKey: null, dedupeKey: 'dup-key', recipientMemberId: null, relatedMemberId: null, auditEventId: null },
    { id: 'email_broken_2', templateKey: 'member-email-verification', dedupeKey: 'dup-key', recipientMemberId: null, relatedMemberId: null, auditEventId: null },
  ]
  brokenSnapshot.securityEvents = [{ id: 'security_broken', memberId: null, eventType: 'login_failed', relatedAuditEventId: null }]
  brokenSnapshot.auditEvents = [{ id: 'audit_broken', memberId: null, eventType: 'member_created', relatedEntityId: null }]

  const brokenIssues = validateShadowValidationSnapshot(brokenSnapshot)
  const codes = brokenIssues.map((issue) => issue.code)
  assert.equal(codes.includes('identity_duplicate_normalized_email'), true)
  assert.equal(codes.includes('identity_missing_required_verification'), true)
  assert.equal(codes.includes('identity_active_session_with_inactive_member'), true)
  assert.equal(codes.includes('identity_orphan_member_invitation'), true)
  assert.equal(codes.includes('identity_orphan_member_action'), true)
  assert.equal(codes.includes('entitlement_orphan_module'), true)
  assert.equal(codes.includes('entitlement_orphan_lesson'), true)
  assert.equal(codes.includes('entitlement_orphan_resource'), true)
  assert.equal(codes.includes('billing_orphan_account'), true)
  assert.equal(codes.includes('billing_orphan_subscription'), true)
  assert.equal(codes.includes('billing_orphan_payment'), true)
  assert.equal(codes.includes('community_orphan_membership'), true)
  assert.equal(codes.includes('community_orphan_post'), true)
  assert.equal(codes.includes('community_orphan_comment'), true)
  assert.equal(codes.includes('community_orphan_file'), true)
  assert.equal(codes.includes('partner_orphan_application'), true)
  assert.equal(codes.includes('partner_orphan_event'), true)
  assert.equal(codes.includes('partner_affiliate_ownership_mismatch'), true)
  assert.equal(codes.includes('email_queued_missing_template'), true)
  assert.equal(codes.includes('email_duplicate_dedupe_key'), true)

  const stableCodes = [...codes]
  assert.deepEqual(
    stableCodes,
    [...brokenIssues].map((issue) => issue.code),
  )

  const serialized = JSON.stringify(brokenIssues)
  assert.doesNotMatch(serialized, /sk_test_shadow|whsec_shadow|price_pro_shadow|price_vip_shadow|cus_secret_123|sub_secret_123|in_secret_123|pi_secret_123|a@example\.test|token=abc|provider payload/i)

  const healthyIssueOrder = validateShadowValidationSnapshot(buildDefaultSnapshot()).map((issue) => `${issue.domain}:${issue.code}`)
  assert.deepEqual(healthyIssueOrder, [...healthyIssueOrder].sort())

  console.log('payload_shadow_reconciliation.test.ts passed')
}

main().catch((error) => {
  console.error('payload_shadow_reconciliation.test.ts failed', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
