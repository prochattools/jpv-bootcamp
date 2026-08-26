import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { buildShadowValidationReport } from '../src/lib/shadowValidationReport'
import { validatePreviewReleaseCutoverPreflight } from '../src/lib/previewReleasePreflight'

async function main(): Promise<void> {
  const readinessPage = await readFile('src/app/(frontend)/operations/shadow-validation/page.tsx', 'utf8')
  assert.match(readinessPage, /notFound\(\)/)
  assert.doesNotMatch(readinessPage, /\bfetch\(|\baxios\b|\bprisma\./i)

  const healthy = await buildShadowValidationReport(
    {
      STRIPE_ENV: 'test',
      STRIPE_SECRET_KEY_TEST: 'sk_test_shadow',
      STRIPE_WEBHOOK_SECRET_TEST: 'whsec_shadow',
      STRIPE_PRICE_PRO_TEST: 'price_pro_shadow',
      STRIPE_PRICE_PRO_ANNUAL_TEST: 'price_pro_annual_shadow',
      APP_PUBLIC_URL: 'https://preview.example.test',
      STARTUP_MODE: 'application-only',
      DEPLOYMENT_RUNTIME: 'docker',
    } as unknown as NodeJS.ProcessEnv,
    {
      fixture: {
        repositoryReady: true,
        configurationReady: true,
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
      },
    }
  )

  assert.equal(healthy.repositoryReady, true)
  assert.equal(healthy.configurationReady, true)
  assert.equal(healthy.cutoverReady, false)
  assert.equal(healthy.issues.length, 0)
  assert.equal(healthy.domains.identity.issueCount, 0)
  assert.equal(healthy.domains.partners.issueCount, 0)
  assert.doesNotMatch(JSON.stringify(healthy), /sk_test_shadow|whsec_shadow|price_pro_shadow|price_pro_annual_shadow|https:\/\/preview\.example\.test/i)

  const shadowSource = await readFile('src/lib/shadowValidationReport.ts', 'utf8')
  assert.match(shadowSource, /previewMigrationInventoryNames\(\)/)
  assert.match(shadowSource, /evidence:\s*ShadowValidationEvidence/)

  const preflight = validatePreviewReleaseCutoverPreflight({})
  assert.equal(preflight.migrationExecution.authorized, false)
  assert.equal(preflight.previewDeployment.authorized, false)
  assert.equal(preflight.billingVerification.authorized, false)
  assert.equal(preflight.providerEmailDryRun.authorized, false)
  assert.equal(preflight.providerEmailApply.authorized, false)
  assert.equal(preflight.communityVerification.authorized, false)
  assert.equal(preflight.partnerDeliveryVerification.authorized, false)
  assert.equal(preflight.finalCutover.authorized, false)

  const approved = validatePreviewReleaseCutoverPreflight({
    migrationExecution: {
      authorized: true,
      environment: 'preview',
      migrationOrder: [
        '20260620_213328',
        '20260621_194424_course_system_phase1',
        '20260622_093852_course_private_media',
        '20260627_010700_structured_community_attachments',
        '20260630_100730_affiliate_reporting',
        '20260630_190000_payload_preferences_id_constraint',
        '20260701_201500_member_email_verification',
        '20260702_001500_member_account_action_purposes',
        '20260703_000000_partner_affiliate_operations',
        '20260704_090000_partner_schema_reconciliation',
        '20260707_130000_remove_table_plan_from_payload_enums',
        '20260718_000000_live_sessions',
        '20260718_103726_membership_support_schema',
        '20260718_110000_bunny_videos',
        '20260719_150000_subscription_schema_cols',
        '20260720_000000_locked_docs_rels_new_collections',
        '20260722_100000_reconcile_lockstate_vip_progress',
        '20260723_000000_singular_membership_plan',
        '20260723_000001_migrate_pro_to_membership',
        '20260724_120000_operator_content_media',
        '20260724_121000_billing_operator_actions',
        '20260724_122000_live_session_relationships',
        '20260724_123000_email_operator_actions',
        '20260727_000000_partner_applications_source_member_id',
        '20260727_100000_email_events_lease_columns',
        '20260727_200000_email_events_processing_status',
        '20260730_090000_membership_audit_relationship_columns',
        '20260730_100000_email_events_staging_guard_status',
        '20260804_050000_member_account_action_reservations',
        '20260817_193000_bunny_guid_first',
        '20260817_193100_lesson_comments',
        '20260817_193200_space_og_image',
        '20260817_193300_space_reactions',
        '20260818_140000_member_profile_parity',
        '20260818_140100_portal_settings',
        '20260820_000000_live_session_space',
        '20260824_120000_engagement_reactions',
        '20260824_150000_portal_navigation',
        '20260824_200000_member_notifications',
        '20260824_210000_pay_it_forward_schema',
        '20260825_120000_billing_invoice_visibility',
        '20260825_121000_membership_support_runtime_alignment',
        '20260825_122000_membership_support_relationships',
        '20260825_123000_membership_support_relationship_alignment',
        '20260825_124000_membership_review_assignee_alignment',
        '20260825_125000_membership_shadow_state_alignment',
        '20260826_090000_payment_action_required_status',
        '20260826_120000_billing_pause_actions',
        '20260826_130000_portal_engagement_distribution',
      ],
      operator: 'migration-op',
      approvalReference: 'approval-1',
      stopConditions: ['stop'],
    },
    previewDeployment: {
      authorized: true,
      commitSha: '00d874480ef075ca8a853f9fa127e251d7b6a7ce',
      imageReference: 'ghcr.io/prochattools/jpv-bootcamp:00d874480ef075ca8a853f9fa127e251d7b6a7ce',
      operator: 'deploy-op',
      approvalReference: 'approval-2',
      stopConditions: ['stop'],
    },
    billingVerification: {
      authorized: true,
      checkout: true,
      portal: true,
      webhook: true,
      operator: 'billing-op',
      approvalReference: 'approval-3',
      stopConditions: ['stop'],
    },
    providerEmailDryRun: {
      authorized: true,
      operator: 'email-op',
      approvalReference: 'approval-4',
      stopConditions: ['stop'],
    },
    providerEmailApply: {
      authorized: true,
      operator: 'email-op',
      approvalReference: 'approval-5',
      stopConditions: ['stop'],
    },
    communityVerification: {
      authorized: true,
      operator: 'community-op',
      approvalReference: 'approval-6',
      stopConditions: ['stop'],
    },
    partnerDeliveryVerification: {
      authorized: true,
      operator: 'partner-op',
      approvalReference: 'approval-7',
      stopConditions: ['stop'],
    },
    finalCutover: {
      authorized: true,
      operator: 'cutover-op',
      approvalReference: 'approval-8',
      stopConditions: ['stop'],
    },
  })

  assert.equal(approved.migrationExecution.ok, true)
  assert.equal(approved.previewDeployment.ok, true)
  assert.equal(approved.billingVerification.ok, true)
  assert.equal(approved.providerEmailDryRun.ok, true)
  assert.equal(approved.providerEmailApply.ok, true)
  assert.equal(approved.communityVerification.ok, true)
  assert.equal(approved.partnerDeliveryVerification.ok, true)
  assert.equal(approved.finalCutover.ok, true)

  const missingApproval = validatePreviewReleaseCutoverPreflight({
    finalCutover: {
      authorized: true,
      operator: 'cutover-op',
      stopConditions: ['stop'],
    },
  })
  assert.equal(missingApproval.finalCutover.errors.includes('approval_reference_required'), true)

  console.log('payload shadow validation tests passed')
}

main().catch((error) => {
  console.error('payload shadow validation tests failed', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
