import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import {
  buildShadowValidationReport,
  createShadowValidationAdapter,
} from '../src/lib/shadowValidationReport'
import type { PayloadCourseAccessAPI, PayloadDocument, PayloadId } from '../src/lib/payloadCourse/accessService'

type CollectionMap = Record<string, PayloadDocument[]>

class FakePayload implements PayloadCourseAccessAPI {
  constructor(private readonly collections: CollectionMap, private readonly failCollection?: string) {}

  async find(args: { collection: string; where?: Record<string, unknown>; limit?: number }) {
    if (args.collection === this.failCollection) throw new Error('collection failure')
    const docs = [...(this.collections[args.collection] ?? [])]
    return { docs: docs.slice(0, args.limit ?? docs.length) }
  }

  async findByID(args: { collection: string; id: PayloadId }) {
    const doc = (this.collections[args.collection] ?? []).find((item) => String(item.id) === String(args.id))
    if (!doc) throw new Error('missing')
    return doc
  }

  async count(args: { collection: string }) {
    return { totalDocs: (this.collections[args.collection] ?? []).length }
  }
}

async function main(): Promise<void> {
  const pageSource = await readFile('src/app/(frontend)/operations/shadow-validation/page.tsx', 'utf8')
  const evidenceSource = await readFile('src/app/api/admin/shadow-validation/evidence/route.ts', 'utf8')
  assert.match(pageSource, /notFound\(\)/)
  assert.match(evidenceSource, /forbidden/)
  assert.doesNotMatch(pageSource, /\bfetch\(|\baxios\b|\bprisma\./i)
  assert.doesNotMatch(evidenceSource, /\bfetch\(|\baxios\b|\bprisma\./i)

  const payload = new FakePayload({
    payload_members: [
      { id: 'member_1', email: 'member@example.test', accountStatus: 'active', emailVerifiedAt: '2026-01-01T00:00:00.000Z' },
      { id: 'member_2', email: 'duplicate@example.test', accountStatus: 'blocked', emailVerifiedAt: null },
    ],
    payload_member_invitations: [{ id: 'inv_1', member: 'member_1', status: 'accepted' }],
    payload_member_actions: [{ id: 'action_1', member: 'member_1', status: 'complete' }],
    payload_access_groups: [{ id: 'group_1', slug: 'core', status: 'active' }],
    payload_access_grants: [{ id: 'grant_1', member: 'member_1', accessGroup: 'group_1', resourceId: 'course_1', status: 'active' }],
    payload_courses: [{ id: 'course_1', slug: 'course-1', status: 'published', visibility: 'private' }],
    payload_course_modules: [{ id: 'module_1', course: 'course_1', slug: 'module-1', status: 'published' }],
    payload_lessons: [{ id: 'lesson_1', module: 'module_1', slug: 'lesson-1', status: 'published' }],
    payload_lesson_resources: [{ id: 'resource_1', lesson: 'lesson_1', protectedFile: 'file_1', status: 'published', publicVisibility: 'private' }],
    payload_lesson_progress: [{ id: 'progress_1', member: 'member_1', lesson: 'lesson_1' }],
    payload_billing_accounts: [{ id: 'billing_1', member: 'member_1', stripeCustomerId: 'cus_1', billingStatus: 'active' }],
    payload_subscriptions: [{ id: 'sub_1', member: 'member_1', billingAccount: 'billing_1', stripeSubscriptionId: 'sub_1', status: 'active', plan: 'pro' }],
    payload_payments: [{ id: 'payment_1', member: 'member_1', subscription: 'sub_1', stripeInvoiceId: 'in_1', stripePaymentIntentId: 'pi_1', status: 'paid' }],
    payload_spaces: [{ id: 'space_1', slug: 'space-1', visibility: 'members', status: 'published' }],
    payload_space_memberships: [{ id: 'membership_1', member: 'member_1', space: 'space_1', status: 'active', role: 'member' }],
    payload_space_posts: [{ id: 'post_1', space: 'space_1', author: 'member_1', moderationStatus: 'visible' }],
    payload_space_comments: Array.from({ length: 501 }, (_, index) => ({
      id: `comment_${index + 1}`,
      post: 'post_1',
      author: 'member_1',
      moderationStatus: 'visible',
    })),
    payload_space_files: [{ id: 'file_1', ownerMember: 'member_1', space: 'space_1', post: 'post_1', visibility: 'protected', mimeType: 'application/pdf' }],
    payload_partner_affiliates: [{ id: 'partner_1', slug: 'partner-1', status: 'active', applicationMode: 'redirect' }],
    payload_partner_applications: [{ id: 'app_1', member: 'member_1', partner: 'partner_1', status: 'delivered', deliveryMethod: 'redirect', deliveryAttempts: 1, applicationReference: 'APP-1', deliveredAt: '2026-01-01T00:00:00.000Z' }],
    payload_partner_events: [{ id: 'event_1', partner: 'partner_1', application: 'app_1', member: 'member_1', eventType: 'partner_application_delivered', deliveryMethod: 'redirect' }],
    payload_affiliate_referrals: [{ id: 'referral_1', referredMember: 'member_1', affiliate: 'partner_1' }],
    payload_affiliate_commissions: [{ id: 'commission_1', affiliate: 'partner_1', referral: 'referral_1' }],
    payload_email_events: [{ id: 'email_1', templateKey: 'member-email-verification', dedupeKey: 'member-email-verification:member_1', contact: 'member_1', auditEvent: 'audit_1' }],
    payload_member_security_events: [{ id: 'security_1', member: 'member_1', eventType: 'account_created' }],
    payload_audit_events: [{ id: 'audit_1', actorId: 'member_1', action: 'member_created', targetId: 'member_1' }],
  })

  const adapter = createShadowValidationAdapter(payload)
  const result = await adapter.load()
  assert.equal(result.snapshot?.members.length, 2)
  assert.equal(result.snapshot?.billingAccounts[0].stripeCustomerId, 'cus_1')
  assert.equal(result.snapshot?.partnerApplications[0].trustedDestinationSnapshot, null)
  assert.equal(result.snapshot?.emailQueue[0].dedupeKey, 'member-email-verification:member_1')
  assert.equal(result.truncatedCollections.includes('payload_space_comments'), true)
  assert.equal(result.readFailures.length, 0)

  const report = await buildShadowValidationReport(process.env, { adapterResult: result })
  assert.equal(report.evidence.collectionCounts.payload_members, 2)
  assert.doesNotMatch(JSON.stringify(report.evidence), /member@example\.test|duplicate@example\.test|cus_1|sub_1|in_1|pi_1|token|body/i)

  const failingResult = await createShadowValidationAdapter(new FakePayload({}, 'payload_partner_events')).load()
  assert.equal(failingResult.snapshot, null)
  assert.equal(failingResult.readFailures.some((failure) => failure.code === 'adapter_collection_failure'), true)

  console.log('payload_shadow_adapter.test.ts passed')
}

main().catch((error) => {
  console.error('payload_shadow_adapter.test.ts failed', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
