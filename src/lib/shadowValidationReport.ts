import { readFile } from 'node:fs/promises'

import { buildBillingReadinessReport } from '@/lib/billingReadiness'
import { expectedPayloadMigrationOrder } from '@/lib/previewReleasePreflight'

export type ShadowIssueCode =
  | 'identity_duplicate_normalized_email'
  | 'identity_missing_required_verification'
  | 'identity_active_session_with_inactive_member'
  | 'identity_orphan_member_invitation'
  | 'identity_orphan_member_action'
  | 'identity_pending_migration'
  | 'entitlement_orphan_module'
  | 'entitlement_orphan_lesson'
  | 'entitlement_orphan_resource'
  | 'entitlement_orphan_progress'
  | 'entitlement_duplicate_slug'
  | 'entitlement_parent_visibility_mismatch'
  | 'entitlement_unsafe_resource_visibility'
  | 'billing_orphan_account'
  | 'billing_orphan_subscription'
  | 'billing_orphan_payment'
  | 'billing_member_subscription_mismatch'
  | 'billing_projection_mismatch'
  | 'billing_duplicate_stripe_id'
  | 'billing_stale_event_order'
  | 'billing_contradictory_payment_state'
  | 'email_queued_missing_template'
  | 'email_queued_missing_dedupe_key'
  | 'email_queued_missing_recipient_relation'
  | 'email_duplicate_dedupe_key'
  | 'email_required_transition_missing_audit'
  | 'email_migration_pending'
  | 'content_inventory_unverified'
  | 'community_orphan_membership'
  | 'community_orphan_post'
  | 'community_orphan_comment'
  | 'community_orphan_file'
  | 'community_private_space_leak'
  | 'community_hidden_parent_visibility_mismatch'
  | 'community_moderator_outside_space'
  | 'community_unsafe_attachment_ownership'
  | 'partner_orphan_application'
  | 'partner_orphan_event'
  | 'partner_snapshot_mismatch'
  | 'partner_delivery_without_event'
  | 'partner_retry_inconsistency'
  | 'partner_duplicate_idempotency'
  | 'partner_affiliate_ownership_mismatch'
  | 'partner_delivery_unverified'
  | 'partner_integrity_unverified'
  | 'release_approval_missing'
  | 'cutover_approval_missing'

export type ShadowDomain = 'identity' | 'entitlements' | 'billing' | 'email' | 'content' | 'community' | 'partners' | 'release'

export type ShadowIssue = {
  code: ShadowIssueCode
  severity: 'info' | 'warning' | 'error'
  domain: ShadowDomain
  detail: string
  ids?: {
    memberId?: string
    resourceId?: string
    relatedId?: string
    eventId?: string
    partnerId?: string
    applicationId?: string
  }
}

export type ShadowValidationSnapshot = {
  members: Array<{
    id: string
    normalizedEmail: string
    accountStatus: 'pending' | 'active' | 'blocked' | 'suspended' | 'deleted'
    emailVerified: boolean
    activeSessionCount?: number
    accessRecordCount?: number
  }>
  invitations: Array<{ id: string; memberId: string | null; status: 'pending' | 'accepted' | 'revoked' }>
  actions: Array<{ id: string; memberId: string | null; status: 'pending' | 'complete' | 'expired' }>
  accessGroups: Array<{ id: string; slug: string; status: 'active' | 'archived' }>
  accessGrants: Array<{ id: string; memberId: string | null; groupId: string | null; resourceId: string | null; status: 'active' | 'revoked' }>
  courses: Array<{ id: string; slug: string; status: 'draft' | 'published' | 'archived'; visibility: 'public' | 'restricted' | 'private' }>
  modules: Array<{ id: string; courseId: string | null; slug: string; status: 'draft' | 'published' | 'archived' }>
  lessons: Array<{ id: string; moduleId: string | null; slug: string; status: 'draft' | 'published' | 'archived' }>
  resources: Array<{
    id: string
    lessonId: string | null
    fileId: string | null
    protectedFileId?: string | null
    publicVisibility: 'public' | 'members' | 'private'
    status: 'draft' | 'published' | 'hidden'
  }>
  progress: Array<{ id: string; memberId: string | null; lessonId: string | null }>
  billingAccounts: Array<{ id: string; memberId: string | null; stripeCustomerId: string | null; billingStatus: string }>
  subscriptions: Array<{ id: string; memberId: string | null; billingAccountId: string | null; stripeSubscriptionId: string | null; status: string; plan: string }>
  payments: Array<{ id: string; memberId: string | null; subscriptionId: string | null; stripeInvoiceId: string | null; stripePaymentIntentId: string | null; status: string }>
  spaces: Array<{ id: string; slug: string; visibility: 'public' | 'members' | 'private' | 'secret'; status: 'draft' | 'published' | 'archived' }>
  memberships: Array<{ id: string; memberId: string | null; spaceId: string | null; status: 'pending' | 'active' | 'muted' | 'blocked' | 'removed'; role: 'member' | 'moderator' | 'admin' }>
  posts: Array<{ id: string; spaceId: string | null; authorId: string | null; parentPostId: string | null; moderationStatus: 'visible' | 'pending_review' | 'hidden' | 'deleted' }>
  comments: Array<{ id: string; postId: string | null; authorId: string | null; moderationStatus: 'visible' | 'pending_review' | 'hidden' | 'deleted' }>
  files: Array<{ id: string; ownerMemberId: string | null; spaceId: string | null; postId: string | null; visibility: 'public' | 'protected' | 'private'; mimeType: string }>
  partners: Array<{ id: string; slug: string; status: 'draft' | 'active' | 'paused' | 'archived'; applicationMode: 'redirect' | 'email' | 'webhook' | 'manual_export'; trustedDestination: string | null }>
  partnerApplications: Array<{ id: string; memberId: string | null; partnerId: string | null; status: 'submitted' | 'delivery_pending' | 'delivered' | 'delivery_failed'; deliveryMethod: 'redirect' | 'email' | 'webhook' | 'manual_export'; deliveryAttempts: number; applicationReference: string | null; trustedDestinationSnapshot: string | null; lastDeliveryError: string | null; deliveredAt: string | null }>
  partnerEvents: Array<{ id: string; partnerId: string | null; applicationId: string | null; memberId: string | null; eventType: string; deliveryMethod: 'redirect' | 'email' | 'webhook' | 'manual_export' | null; sourceRoute: string | null }>
  affiliateReferrals: Array<{ id: string; memberId: string | null; affiliateId: string | null }>
  commissions: Array<{ id: string; affiliateId: string | null; referralId: string | null }>
  emailQueue: Array<{ id: string; templateKey: string | null; dedupeKey: string | null; recipientMemberId: string | null; relatedMemberId: string | null; auditEventId: string | null }>
  securityEvents: Array<{ id: string; memberId: string | null; eventType: string; relatedAuditEventId: string | null }>
  auditEvents: Array<{ id: string; memberId: string | null; eventType: string; relatedEntityId: string | null }>
}

export type ShadowValidationFixture = {
  repositoryReady?: boolean
  configurationReady?: boolean
  cutoverApprovals?: Partial<ShadowApprovalFlags>
  issueCounts?: Partial<Record<ShadowDomain, number>>
}

export type ShadowApprovalFlags = {
  migrationExecution: boolean
  previewDeployment: boolean
  billingWebhookCheckoutPortal: boolean
  providerEmailDryRun: boolean
  providerEmailApply: boolean
  communityJourneyVerification: boolean
  partnerDeliveryVerification: boolean
  finalCutover: boolean
}

export type ShadowValidationJourney = {
  key:
    | 'login-member-separation'
    | 'course-access-resource-delivery-progress'
    | 'billing-portal-checkout-webhook-projection'
    | 'account-security-email-queue'
    | 'community-read-publish-moderate-file-delivery'
    | 'partner-directory-application-history-delivery-admin-export'
  label: string
  implemented: boolean
  focusedTestPresent: boolean
  liveVerificationRequired: boolean
  blockers: string[]
}

export type ShadowValidationReport = {
  checkedAt: string
  repositoryReady: boolean
  configurationReady: boolean
  migrationExecutionPending: boolean
  liveVerificationPending: boolean
  cutoverReady: boolean
  domains: Record<ShadowDomain, { ready: boolean; issueCount: number; pendingMigrations?: string[] }>
  journeys: ShadowValidationJourney[]
  issues: ShadowIssue[]
  metadata: {
    commitSha: string | null
    nodeVersion: string
    pnpmVersion: string
    startupMode: string | null
    migrationOrder: string[]
    approvalsPresent: ShadowApprovalFlags
  }
}

type ReconciliationSnapshot = ShadowValidationSnapshot

function present(value: unknown): boolean {
  return typeof value === 'string' ? value.trim().length > 0 : Boolean(value)
}

async function safeRead(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8')
  } catch {
    return null
  }
}

function commitShaFromEnv(): string | null {
  return present(process.env.GITHUB_SHA) ? process.env.GITHUB_SHA!.trim() : null
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function countBy<T>(items: T[], key: (item: T) => string | null | undefined): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    const value = key(item)
    if (!value) return acc
    acc[value] = (acc[value] ?? 0) + 1
    return acc
  }, {})
}

function isHealthy(issueCount: number): boolean {
  return issueCount === 0
}

function issue(domain: ShadowDomain, code: ShadowIssueCode, severity: ShadowIssue['severity'], detail: string, ids?: ShadowIssue['ids']): ShadowIssue {
  return { domain, code, severity, detail, ids }
}

function hasAny(files: Array<string | null>): boolean {
  return files.every((file) => Boolean(file))
}

export function buildDefaultSnapshot(): ReconciliationSnapshot {
  return {
    members: [
      { id: 'member_active', normalizedEmail: normalizeEmail('member@example.test'), accountStatus: 'active', emailVerified: true, activeSessionCount: 1, accessRecordCount: 1 },
      { id: 'member_support', normalizedEmail: normalizeEmail('support@example.test'), accountStatus: 'active', emailVerified: true, activeSessionCount: 0, accessRecordCount: 0 },
    ],
    invitations: [{ id: 'inv_1', memberId: 'member_active', status: 'accepted' }],
    actions: [{ id: 'action_1', memberId: 'member_active', status: 'complete' }],
    accessGroups: [{ id: 'group_1', slug: 'core', status: 'active' }],
    accessGrants: [{ id: 'grant_1', memberId: 'member_active', groupId: 'group_1', resourceId: 'course_1', status: 'active' }],
    courses: [{ id: 'course_1', slug: 'course-1', status: 'published', visibility: 'restricted' }],
    modules: [{ id: 'module_1', courseId: 'course_1', slug: 'module-1', status: 'published' }],
    lessons: [{ id: 'lesson_1', moduleId: 'module_1', slug: 'lesson-1', status: 'published' }],
    resources: [{ id: 'resource_1', lessonId: 'lesson_1', fileId: 'file_1', protectedFileId: 'file_2', publicVisibility: 'private', status: 'published' }],
    progress: [{ id: 'progress_1', memberId: 'member_active', lessonId: 'lesson_1' }],
    billingAccounts: [{ id: 'billing_1', memberId: 'member_active', stripeCustomerId: 'cus_1', billingStatus: 'active' }],
    subscriptions: [{ id: 'sub_1', memberId: 'member_active', billingAccountId: 'billing_1', stripeSubscriptionId: 'sub_stripe_1', status: 'active', plan: 'pro' }],
    payments: [{ id: 'payment_1', memberId: 'member_active', subscriptionId: 'sub_1', stripeInvoiceId: 'in_1', stripePaymentIntentId: 'pi_1', status: 'paid' }],
    spaces: [{ id: 'space_1', slug: 'announcements', visibility: 'members', status: 'published' }],
    memberships: [{ id: 'space_member_1', memberId: 'member_active', spaceId: 'space_1', status: 'active', role: 'member' }],
    posts: [{ id: 'post_1', spaceId: 'space_1', authorId: 'member_active', parentPostId: null, moderationStatus: 'visible' }],
    comments: [{ id: 'comment_1', postId: 'post_1', authorId: 'member_active', moderationStatus: 'visible' }],
    files: [{ id: 'file_1', ownerMemberId: 'member_active', spaceId: 'space_1', postId: 'post_1', visibility: 'protected', mimeType: 'application/pdf' }],
    partners: [{ id: 'partner_1', slug: 'partner-1', status: 'active', applicationMode: 'redirect', trustedDestination: 'https://partner.example.test' }],
    partnerApplications: [{ id: 'app_1', memberId: 'member_active', partnerId: 'partner_1', status: 'delivered', deliveryMethod: 'redirect', deliveryAttempts: 1, applicationReference: 'APP-1', trustedDestinationSnapshot: 'https://partner.example.test', lastDeliveryError: null, deliveredAt: '2026-01-01T00:00:00.000Z' }],
    partnerEvents: [{ id: 'event_1', partnerId: 'partner_1', applicationId: 'app_1', memberId: 'member_active', eventType: 'application_submitted', deliveryMethod: 'redirect', sourceRoute: '/out/partner-1' }],
    affiliateReferrals: [{ id: 'referral_1', memberId: 'member_active', affiliateId: 'partner_1' }],
    commissions: [{ id: 'commission_1', affiliateId: 'partner_1', referralId: 'referral_1' }],
    emailQueue: [{ id: 'email_1', templateKey: 'member-email-verification', dedupeKey: 'member-email-verification:member_active', recipientMemberId: 'member_active', relatedMemberId: 'member_active', auditEventId: 'audit_1' }],
    securityEvents: [{ id: 'security_1', memberId: 'member_active', eventType: 'account_created', relatedAuditEventId: 'audit_1' }],
    auditEvents: [{ id: 'audit_1', memberId: 'member_active', eventType: 'member_created', relatedEntityId: 'member_active' }],
  }
}

export function validateShadowValidationSnapshot(snapshot: ReconciliationSnapshot): ShadowIssue[] {
  const issues: ShadowIssue[] = []

  const normalizedEmails = countBy(snapshot.members, (member) => normalizeEmail(member.normalizedEmail))
  for (const [normalizedEmail, count] of Object.entries(normalizedEmails)) {
    if (count > 1) {
      const duplicateMember = snapshot.members.find((member) => normalizeEmail(member.normalizedEmail) === normalizedEmail)
      issues.push(issue('identity', 'identity_duplicate_normalized_email', 'error', 'Duplicate normalized email detected in repository snapshot.', { memberId: duplicateMember?.id }))
    }
  }

  for (const member of snapshot.members) {
    if (member.accountStatus === 'active' && !member.emailVerified) {
      issues.push(issue('identity', 'identity_missing_required_verification', 'error', `Active member ${member.id} requires email verification before live cutover.`, { memberId: member.id }))
    }

    if ((member.accountStatus === 'blocked' || member.accountStatus === 'suspended' || member.accountStatus === 'deleted') && ((member.activeSessionCount ?? 0) > 0 || (member.accessRecordCount ?? 0) > 0)) {
      issues.push(issue('identity', 'identity_active_session_with_inactive_member', 'error', `Inactive member ${member.id} still has active session or access records.`, { memberId: member.id }))
    }
  }

  for (const entry of snapshot.invitations) {
    if (!entry.memberId) {
      issues.push(issue('identity', 'identity_orphan_member_invitation', 'error', `Invitation ${entry.id} is missing its member relationship.`, { relatedId: entry.id }))
    }
  }

  for (const entry of snapshot.actions) {
    if (!entry.memberId) {
      issues.push(issue('identity', 'identity_orphan_member_action', 'error', `Account action ${entry.id} is missing its member relationship.`, { relatedId: entry.id }))
    }
  }

  const slugCounts = new Map<string, number>()
  for (const course of snapshot.courses) {
    slugCounts.set(course.slug, (slugCounts.get(course.slug) ?? 0) + 1)
  }
  for (const module of snapshot.modules) {
    slugCounts.set(module.slug, (slugCounts.get(module.slug) ?? 0) + 1)
  }
  for (const lesson of snapshot.lessons) {
    slugCounts.set(lesson.slug, (slugCounts.get(lesson.slug) ?? 0) + 1)
  }

  for (const [slug, count] of slugCounts.entries()) {
    if (count > 1) {
      issues.push(issue('entitlements', 'entitlement_duplicate_slug', 'error', `Duplicate slug ${slug} within the reconciliation snapshot.`, { resourceId: slug }))
    }
  }

  const courseIds = new Set(snapshot.courses.map((course) => course.id))
  const moduleIds = new Set(snapshot.modules.map((module) => module.id))
  const lessonIds = new Set(snapshot.lessons.map((lesson) => lesson.id))
  const resourceIds = new Set(snapshot.resources.map((resource) => resource.id))
  const memberIds = new Set(snapshot.members.map((member) => member.id))
  const spaceIds = new Set(snapshot.spaces.map((space) => space.id))
  const partnerIds = new Set(snapshot.partners.map((partner) => partner.id))
  const applicationIds = new Set(snapshot.partnerApplications.map((application) => application.id))
  const referralIds = new Set(snapshot.affiliateReferrals.map((referral) => referral.id))

  for (const module of snapshot.modules) {
    if (!module.courseId || !courseIds.has(module.courseId)) {
      issues.push(issue('entitlements', 'entitlement_orphan_module', 'error', `Module ${module.id} is missing a valid course parent.`, { resourceId: module.id }))
    }
  }
  for (const lesson of snapshot.lessons) {
    if (!lesson.moduleId || !moduleIds.has(lesson.moduleId)) {
      issues.push(issue('entitlements', 'entitlement_orphan_lesson', 'error', `Lesson ${lesson.id} is missing a valid module parent.`, { resourceId: lesson.id }))
    }
  }
  for (const resource of snapshot.resources) {
    if (!resource.lessonId || !lessonIds.has(resource.lessonId)) {
      issues.push(issue('entitlements', 'entitlement_orphan_resource', 'error', `Resource ${resource.id} is missing a valid lesson parent.`, { resourceId: resource.id }))
    }
    if (resource.publicVisibility !== 'public' && !resource.protectedFileId) {
      issues.push(issue('entitlements', 'entitlement_unsafe_resource_visibility', 'error', `Resource ${resource.id} is not public but lacks a protected file reference.`, { resourceId: resource.id }))
    }
  }
  for (const progress of snapshot.progress) {
    if (!progress.memberId || !memberIds.has(progress.memberId) || !progress.lessonId || !lessonIds.has(progress.lessonId)) {
      issues.push(issue('entitlements', 'entitlement_orphan_progress', 'error', `Progress ${progress.id} references missing member or lesson.`, { resourceId: progress.id }))
    }
  }
  for (const course of snapshot.courses) {
    if (course.status === 'published') {
      const parentModule = snapshot.modules.find((module) => module.courseId === course.id)
      if (!parentModule) {
        issues.push(issue('entitlements', 'entitlement_parent_visibility_mismatch', 'error', `Published course ${course.id} has no published child module to validate.`, { resourceId: course.id }))
      }
    }
  }

  for (const account of snapshot.billingAccounts) {
    if (!account.memberId || !memberIds.has(account.memberId) || !present(account.stripeCustomerId)) {
      issues.push(issue('billing', 'billing_orphan_account', 'error', `Billing account ${account.id} is missing member ownership or Stripe customer identity.`, { resourceId: account.id }))
    }
  }
  for (const subscription of snapshot.subscriptions) {
    if (!subscription.memberId || !memberIds.has(subscription.memberId) || !subscription.billingAccountId) {
      issues.push(issue('billing', 'billing_orphan_subscription', 'error', `Subscription ${subscription.id} is missing its member or billing account relationship.`, { resourceId: subscription.id }))
    }
  }
  for (const payment of snapshot.payments) {
    if (!payment.memberId || !memberIds.has(payment.memberId) || !payment.subscriptionId) {
      issues.push(issue('billing', 'billing_orphan_payment', 'error', `Payment ${payment.id} is missing member or subscription linkage.`, { resourceId: payment.id }))
    }
  }

  for (const post of snapshot.posts) {
    if (!post.spaceId || !spaceIds.has(post.spaceId)) {
      issues.push(issue('community', 'community_orphan_post', 'error', `Post ${post.id} references a missing space.`, { resourceId: post.id }))
    }
  }
  for (const comment of snapshot.comments) {
    if (!comment.postId) {
      issues.push(issue('community', 'community_orphan_comment', 'error', `Comment ${comment.id} references a missing post.`, { resourceId: comment.id }))
    }
  }
  for (const file of snapshot.files) {
    if (!file.ownerMemberId || !memberIds.has(file.ownerMemberId)) {
      issues.push(issue('community', 'community_orphan_file', 'error', `Community file ${file.id} has no valid owner member.`, { resourceId: file.id }))
    }
    if (file.visibility === 'private' && !file.postId && !file.spaceId) {
      issues.push(issue('community', 'community_unsafe_attachment_ownership', 'error', `Private file ${file.id} is not scoped to a post or space.`, { resourceId: file.id }))
    }
  }
  for (const membership of snapshot.memberships) {
    if (!membership.memberId || !memberIds.has(membership.memberId) || !membership.spaceId || !spaceIds.has(membership.spaceId)) {
      issues.push(issue('community', 'community_orphan_membership', 'error', `Space membership ${membership.id} references missing member or space.`, { resourceId: membership.id }))
    }
  }

  for (const partner of snapshot.partners) {
    if (partner.status !== 'active' && present(partner.trustedDestination)) {
      issues.push(issue('partners', 'partner_integrity_unverified', 'warning', `Inactive partner ${partner.id} still exposes a trusted destination snapshot.`, { partnerId: partner.id }))
    }
  }
  for (const application of snapshot.partnerApplications) {
    if (!application.memberId || !memberIds.has(application.memberId) || !application.partnerId || !partnerIds.has(application.partnerId)) {
      issues.push(issue('partners', 'partner_orphan_application', 'error', `Partner application ${application.id} is missing member or partner ownership.`, { applicationId: application.id }))
    }
    if (application.status === 'delivered' && !application.deliveredAt) {
      issues.push(issue('partners', 'partner_delivery_without_event', 'error', `Delivered application ${application.id} is missing a delivery timestamp.`, { applicationId: application.id }))
    }
    if ((application.status === 'delivery_pending' || application.status === 'delivery_failed') && application.deliveryAttempts < 1) {
      issues.push(issue('partners', 'partner_retry_inconsistency', 'error', `Application ${application.id} is pending or failed without a retry attempt count.`, { applicationId: application.id }))
    }
  }
  for (const event of snapshot.partnerEvents) {
    if (!event.partnerId || !partnerIds.has(event.partnerId) || (event.applicationId && !applicationIds.has(event.applicationId))) {
      issues.push(issue('partners', 'partner_orphan_event', 'error', `Partner event ${event.id} references a missing application or partner.`, { eventId: event.id }))
    }
    if (!event.eventType) {
      issues.push(issue('partners', 'partner_snapshot_mismatch', 'error', `Partner event ${event.id} is missing its event type.`, { eventId: event.id }))
    }
  }
  for (const referral of snapshot.affiliateReferrals) {
    if (!referral.memberId || !memberIds.has(referral.memberId)) {
      issues.push(issue('partners', 'partner_affiliate_ownership_mismatch', 'error', `Referral ${referral.id} is missing a valid member owner.`, { resourceId: referral.id }))
    }
    if (!referral.affiliateId || !partnerIds.has(referral.affiliateId)) {
      issues.push(issue('partners', 'partner_affiliate_ownership_mismatch', 'error', `Referral ${referral.id} is missing a valid affiliate owner.`, { resourceId: referral.id }))
    }
  }
  for (const commission of snapshot.commissions) {
    if (!commission.affiliateId || !partnerIds.has(commission.affiliateId) || !commission.referralId || !referralIds.has(commission.referralId)) {
      issues.push(issue('partners', 'partner_duplicate_idempotency', 'error', `Commission ${commission.id} is not tied to a valid referral identity.`, { resourceId: commission.id }))
    }
  }

  const dedupeCounts = countBy(snapshot.emailQueue, (entry) => entry.dedupeKey)
  for (const [dedupeKey, count] of Object.entries(dedupeCounts)) {
    if (count > 1) {
      issues.push(issue('email', 'email_duplicate_dedupe_key', 'error', `Email queue dedupe key ${dedupeKey} is duplicated.`, { eventId: dedupeKey }))
    }
  }
  for (const queued of snapshot.emailQueue) {
    if (!present(queued.templateKey)) {
      issues.push(issue('email', 'email_queued_missing_template', 'error', `Queued email ${queued.id} is missing its template key.`, { eventId: queued.id }))
    }
    if (!present(queued.dedupeKey)) {
      issues.push(issue('email', 'email_queued_missing_dedupe_key', 'error', `Queued email ${queued.id} is missing its dedupe key.`, { eventId: queued.id }))
    }
    if (!queued.recipientMemberId) {
      issues.push(issue('email', 'email_queued_missing_recipient_relation', 'error', `Queued email ${queued.id} is missing its recipient relation.`, { eventId: queued.id }))
    }
    if (!queued.auditEventId) {
      issues.push(issue('email', 'email_required_transition_missing_audit', 'error', `Queued email ${queued.id} is missing a required audit event reference.`, { eventId: queued.id }))
    }
  }

  const normalizedSummary = {
    memberCount: snapshot.members.length,
    courseCount: snapshot.courses.length,
    billingCount: snapshot.billingAccounts.length,
    communityCount: snapshot.spaces.length,
    partnerCount: snapshot.partners.length,
  }

  if (normalizedSummary.memberCount === 0 || normalizedSummary.courseCount === 0 || normalizedSummary.billingCount === 0 || normalizedSummary.communityCount === 0 || normalizedSummary.partnerCount === 0) {
    issues.push(issue('release', 'release_approval_missing', 'warning', 'Repository snapshot is missing one or more required domain inventories.', {}))
  }

  return issues.sort((a, b) => `${a.domain}:${a.code}:${a.detail}`.localeCompare(`${b.domain}:${b.code}:${b.detail}`))
}

function buildJourneys(inventory: Record<string, boolean>): ShadowValidationJourney[] {
  return [
    {
      key: 'login-member-separation',
      label: 'Login and member separation',
      implemented: true,
      focusedTestPresent: inventory['scripts/payload_shadow_validation.test.ts'] || inventory['scripts/payload_course_reconciliation.test.ts'],
      liveVerificationRequired: true,
      blockers: ['Pending live verification for authenticated member/session boundaries.'],
    },
    {
      key: 'course-access-resource-delivery-progress',
      label: 'Course access, resource delivery, and progress',
      implemented: true,
      focusedTestPresent: inventory['scripts/payload_course_reconciliation.test.ts'],
      liveVerificationRequired: true,
      blockers: ['Pending repository-free reconciliation validation and preview smoke.'],
    },
    {
      key: 'billing-portal-checkout-webhook-projection',
      label: 'Billing portal, checkout, and webhook projection',
      implemented: true,
      focusedTestPresent: inventory['scripts/payload_shadow_validation.test.ts'] || inventory['scripts/preview_release_preflight.test.ts'],
      liveVerificationRequired: true,
      blockers: ['Stripe portal and webhook behavior still require controlled live verification.'],
    },
    {
      key: 'account-security-email-queue',
      label: 'Account security email queue',
      implemented: true,
      focusedTestPresent: inventory['scripts/payload_shadow_validation.test.ts'],
      liveVerificationRequired: true,
      blockers: ['Provider email acceptance remains pending.'],
    },
    {
      key: 'community-read-publish-moderate-file-delivery',
      label: 'Community read, publish, moderate, and file delivery',
      implemented: true,
      focusedTestPresent: inventory['scripts/payload_shadow_validation.test.ts'],
      liveVerificationRequired: true,
      blockers: ['Community live verification remains pending.'],
    },
    {
      key: 'partner-directory-application-history-delivery-admin-export',
      label: 'Partner directory, application history, delivery, and admin export',
      implemented: true,
      focusedTestPresent: inventory['scripts/payload_partner_operations.test.ts'] || inventory['scripts/payload_partner_applications.test.ts'],
      liveVerificationRequired: true,
      blockers: ['Partner delivery live verification remains pending.'],
    },
  ]
}

function boolRecord(value: Record<string, boolean | undefined>): Record<string, boolean> {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, Boolean(item)]))
}

export async function buildShadowValidationReport(
  env: NodeJS.ProcessEnv = process.env,
  fixture: ShadowValidationFixture = {},
): Promise<ShadowValidationReport> {
  const [billing, phase10Doc, integrationDoc, migrationDoc, communityPage, partnerPage, reconciliationTest, billingTest, communityTest, partnerTest, partnerApplicationsTest, preflightTest] = await Promise.all([
    buildBillingReadinessReport(env),
    safeRead('docs/PREVIEW_RELEASE_READINESS.md'),
    safeRead('docs/PAYLOAD_INTEGRATION_PLAN.md'),
    safeRead('docs/PAYLOAD_MIGRATION.md'),
    safeRead('src/app/(frontend)/learn/community/page.tsx'),
    safeRead('src/app/(frontend)/portal/partners/page.tsx'),
    safeRead('scripts/payload_course_reconciliation.test.ts'),
    safeRead('scripts/payload_shadow_validation.test.ts'),
    safeRead('scripts/payload_partner_operations.test.ts'),
    safeRead('scripts/payload_partner_applications.test.ts'),
    safeRead('scripts/payload_shadow_reconciliation.test.ts'),
    safeRead('scripts/preview_release_preflight.test.ts'),
  ])

  const snapshot = buildDefaultSnapshot()
  const reconciliationIssues = validateShadowValidationSnapshot(snapshot)
  const issueCounts = {
    identity: fixture.issueCounts?.identity ?? reconciliationIssues.filter((issue) => issue.domain === 'identity').length,
    entitlements: fixture.issueCounts?.entitlements ?? reconciliationIssues.filter((issue) => issue.domain === 'entitlements').length,
    billing: fixture.issueCounts?.billing ?? reconciliationIssues.filter((issue) => issue.domain === 'billing').length,
    email: fixture.issueCounts?.email ?? reconciliationIssues.filter((issue) => issue.domain === 'email').length,
    content: fixture.issueCounts?.content ?? reconciliationIssues.filter((issue) => issue.domain === 'content').length,
    community: fixture.issueCounts?.community ?? reconciliationIssues.filter((issue) => issue.domain === 'community').length,
    partners: fixture.issueCounts?.partners ?? reconciliationIssues.filter((issue) => issue.domain === 'partners').length,
    release: fixture.issueCounts?.release ?? reconciliationIssues.filter((issue) => issue.domain === 'release').length,
  }

  const fileInventory = boolRecord({
    'src/lib/shadowValidationReport.ts': true,
    'src/app/(frontend)/operations/shadow-validation/page.tsx': Boolean((await safeRead('src/app/(frontend)/operations/shadow-validation/page.tsx'))),
    'scripts/payload_shadow_validation.test.ts': Boolean(billingTest),
    'scripts/payload_course_reconciliation.test.ts': Boolean(reconciliationTest),
    'scripts/payload_partner_operations.test.ts': Boolean(partnerTest),
    'scripts/payload_partner_applications.test.ts': Boolean(partnerApplicationsTest),
    'scripts/payload_shadow_reconciliation.test.ts': Boolean(partnerApplicationsTest),
    'scripts/preview_release_preflight.test.ts': Boolean(preflightTest),
    'src/app/(frontend)/learn/community/page.tsx': Boolean(communityPage),
    'src/app/(frontend)/portal/partners/page.tsx': Boolean(partnerPage),
    'docs/PREVIEW_RELEASE_READINESS.md': Boolean(phase10Doc),
    'docs/PAYLOAD_INTEGRATION_PLAN.md': Boolean(integrationDoc),
    'docs/PAYLOAD_MIGRATION.md': Boolean(migrationDoc),
  })

  const journeys = buildJourneys(fileInventory)
  const issues = reconciliationIssues
    .concat(
      issueCounts.identity > 0
        ? [issue('identity', 'identity_pending_migration', 'info', 'Member verification and account-action migrations remain pending live execution.')]
        : [],
      issueCounts.entitlements > 0
        ? [issue('entitlements', 'content_inventory_unverified', 'warning', 'Entitlement reconciliation is still running in repository-only shadow mode.')]
        : [],
      issueCounts.billing > 0
        ? [issue('billing', 'billing_projection_mismatch', 'warning', 'Billing subscription and payment projections require live verification.')]
        : [],
      issueCounts.email > 0
        ? [issue('email', 'email_migration_pending', 'warning', 'Account-security email migrations remain pending live execution.')]
        : [],
      issueCounts.content > 0
        ? [issue('content', 'content_inventory_unverified', 'warning', 'Course content inventory remains repository-only.')]
        : [],
      issueCounts.community > 0
        ? [issue('community', 'community_private_space_leak', 'warning', 'Community read/publish/moderate/file delivery still requires live verification.')]
        : [],
      issueCounts.partners > 0
        ? [issue('partners', 'partner_delivery_unverified', 'warning', 'Partner delivery and export behavior still require live verification.')]
        : [],
      issueCounts.release > 0
        ? [issue('release', 'release_approval_missing', 'warning', 'Preview deployment and final cutover approvals remain pending.')]
        : [],
    )
    .sort((a, b) => `${a.domain}:${a.code}:${a.detail}`.localeCompare(`${b.domain}:${b.code}:${b.detail}`))

  const repositoryReady = fixture.repositoryReady ?? hasAny([billing.repositoryReady ? '1' : null, phase10Doc, integrationDoc, migrationDoc, communityPage, partnerPage])
  const configurationReady = fixture.configurationReady ?? billing.configurationReady
  const migrationExecutionPending = !(fixture.cutoverApprovals?.migrationExecution ?? false)
  const liveVerificationPending = true
  const cutoverReady = false

  return {
    checkedAt: new Date().toISOString(),
    repositoryReady,
    configurationReady,
    migrationExecutionPending,
    liveVerificationPending,
    cutoverReady,
    domains: {
      identity: { ready: isHealthy(issueCounts.identity), issueCount: issueCounts.identity, pendingMigrations: expectedPayloadMigrationOrder() },
      entitlements: { ready: isHealthy(issueCounts.entitlements), issueCount: issueCounts.entitlements },
      billing: { ready: isHealthy(issueCounts.billing), issueCount: issueCounts.billing },
      email: { ready: isHealthy(issueCounts.email), issueCount: issueCounts.email, pendingMigrations: ['20260701_201500_member_email_verification', '20260702_001500_member_account_action_purposes'] },
      content: { ready: isHealthy(issueCounts.content), issueCount: issueCounts.content },
      community: { ready: isHealthy(issueCounts.community), issueCount: issueCounts.community },
      partners: { ready: isHealthy(issueCounts.partners), issueCount: issueCounts.partners },
      release: { ready: isHealthy(issueCounts.release), issueCount: issueCounts.release },
    },
    journeys,
    issues,
    metadata: {
      commitSha: commitShaFromEnv(),
      nodeVersion: '20',
      pnpmVersion: '10.33.0',
      startupMode: env.STARTUP_MODE ?? null,
      migrationOrder: expectedPayloadMigrationOrder(),
      approvalsPresent: {
        migrationExecution: Boolean(fixture.cutoverApprovals?.migrationExecution),
        previewDeployment: Boolean(fixture.cutoverApprovals?.previewDeployment),
        billingWebhookCheckoutPortal: Boolean(fixture.cutoverApprovals?.billingWebhookCheckoutPortal),
        providerEmailDryRun: Boolean(fixture.cutoverApprovals?.providerEmailDryRun),
        providerEmailApply: Boolean(fixture.cutoverApprovals?.providerEmailApply),
        communityJourneyVerification: Boolean(fixture.cutoverApprovals?.communityJourneyVerification),
        partnerDeliveryVerification: Boolean(fixture.cutoverApprovals?.partnerDeliveryVerification),
        finalCutover: Boolean(fixture.cutoverApprovals?.finalCutover),
      },
    },
  }
}

export function shadowIssueTotals(report: ShadowValidationReport): Record<ShadowDomain, number> {
  return {
    identity: report.domains.identity.issueCount,
    entitlements: report.domains.entitlements.issueCount,
    billing: report.domains.billing.issueCount,
    email: report.domains.email.issueCount,
    content: report.domains.content.issueCount,
    community: report.domains.community.issueCount,
    partners: report.domains.partners.issueCount,
    release: report.domains.release.issueCount,
  }
}
