export type PreviewMigrationSystem = 'payload' | 'prisma'
export type PreviewMigrationRollbackRisk = 'reversible' | 'data_loss' | 'irreversible'
export type PreviewMigrationAuthorizationCategory =
  | 'payloadMigration'
  | 'prismaDatabaseDeploy'
  | 'providerDryRun'
  | 'providerApply'
  | 'previewDeployment'
  | 'smokeVerification'

export type PreviewMigrationInventoryEntry = {
  name: string
  system: PreviewMigrationSystem
  order: number
  purpose: string
  requiredForPreview: boolean
  rollbackRisk: PreviewMigrationRollbackRisk
  verificationChecks: string[]
  authorizationCategory: PreviewMigrationAuthorizationCategory
}

export const PREVIEW_MIGRATION_INVENTORY = [
  {
    name: '20260620_213328',
    system: 'payload',
    order: 1,
    purpose: 'Bootstrap the reviewed Payload course and admin data model.',
    requiredForPreview: true,
    rollbackRisk: 'irreversible',
    verificationChecks: ['registry-match', 'ordered-exactly', 'no-duplicates'],
    authorizationCategory: 'payloadMigration',
  },
  {
    name: '20260621_194424_course_system_phase1',
    system: 'payload',
    order: 2,
    purpose: 'Extend the course system foundation for member access and content.',
    requiredForPreview: true,
    rollbackRisk: 'data_loss',
    verificationChecks: ['registry-match', 'ordered-exactly', 'course-foundations'],
    authorizationCategory: 'payloadMigration',
  },
  {
    name: '20260622_093852_course_private_media',
    system: 'payload',
    order: 3,
    purpose: 'Add private media support for protected course resources.',
    requiredForPreview: true,
    rollbackRisk: 'data_loss',
    verificationChecks: ['registry-match', 'ordered-exactly', 'private-media'],
    authorizationCategory: 'payloadMigration',
  },
  {
    name: '20260627_010700_structured_community_attachments',
    system: 'payload',
    order: 4,
    purpose: 'Introduce structured community attachment handling.',
    requiredForPreview: true,
    rollbackRisk: 'data_loss',
    verificationChecks: ['registry-match', 'ordered-exactly', 'community-attachments'],
    authorizationCategory: 'payloadMigration',
  },
  {
    name: '20260630_100730_affiliate_reporting',
    system: 'payload',
    order: 5,
    purpose: 'Add affiliate reporting sources and legacy-compatible records.',
    requiredForPreview: true,
    rollbackRisk: 'data_loss',
    verificationChecks: ['registry-match', 'ordered-exactly', 'affiliate-reporting'],
    authorizationCategory: 'payloadMigration',
  },
  {
    name: '20260630_190000_payload_preferences_id_constraint',
    system: 'payload',
    order: 6,
    purpose: 'Harden preference record identity constraints.',
    requiredForPreview: true,
    rollbackRisk: 'irreversible',
    verificationChecks: ['registry-match', 'ordered-exactly', 'id-constraint'],
    authorizationCategory: 'payloadMigration',
  },
  {
    name: '20260701_201500_member_email_verification',
    system: 'payload',
    order: 7,
    purpose: 'Add member email verification action records and digest support.',
    requiredForPreview: true,
    rollbackRisk: 'data_loss',
    verificationChecks: ['registry-match', 'ordered-exactly', 'member-email'],
    authorizationCategory: 'payloadMigration',
  },
  {
    name: '20260702_001500_member_account_action_purposes',
    system: 'payload',
    order: 8,
    purpose: 'Extend member account actions with purpose tracking.',
    requiredForPreview: true,
    rollbackRisk: 'irreversible',
    verificationChecks: ['registry-match', 'ordered-exactly', 'account-action-purposes'],
    authorizationCategory: 'payloadMigration',
  },
  {
    name: '20260703_000000_partner_affiliate_operations',
    system: 'payload',
    order: 9,
    purpose: 'Register partner affiliate, application, and event operations.',
    requiredForPreview: true,
    rollbackRisk: 'data_loss',
    verificationChecks: ['registry-match', 'ordered-exactly', 'partner-operations'],
    authorizationCategory: 'payloadMigration',
  },
  {
    name: '20260704_090000_partner_schema_reconciliation',
    system: 'payload',
    order: 10,
    purpose: 'Reconcile partner affiliate array tables and application snapshot columns with the current Payload schema.',
    requiredForPreview: true,
    rollbackRisk: 'data_loss',
    verificationChecks: ['registry-match', 'ordered-exactly', 'partner-schema-reconciliation'],
    authorizationCategory: 'payloadMigration',
  },
  {
    name: '20260707_130000_remove_table_plan_from_payload_enums',
    system: 'payload',
    order: 11,
    purpose: 'Remove the legacy table-plan value from Payload membership-tier enumerations; mapped to Free access.',
    requiredForPreview: true,
    rollbackRisk: 'irreversible',
    verificationChecks: ['registry-match', 'ordered-exactly', 'table-plan-removal'],
    authorizationCategory: 'payloadMigration',
  },
  {
    name: '20260718_103726_membership_support_schema',
    system: 'payload',
    order: 12,
    purpose: 'Create membership support schema: 9 core tables, 18 enums, 40 FK constraints, 68 indexes with audit and funding source tracking.',
    requiredForPreview: true,
    rollbackRisk: 'irreversible',
    verificationChecks: ['registry-match', 'ordered-exactly', 'membership-support-schema'],
    authorizationCategory: 'payloadMigration',
  },
  {
    name: '20260718_000000_live_sessions',
    system: 'payload',
    order: 13,
    purpose: 'Create live_sessions table for real-time video sessions with course, host, and audit tracking.',
    requiredForPreview: true,
    rollbackRisk: 'irreversible',
    verificationChecks: ['registry-match', 'ordered-exactly', 'live-sessions'],
    authorizationCategory: 'payloadMigration',
  },
  {
    name: '20260718_110000_bunny_videos',
    system: 'payload',
    order: 14,
    purpose: 'Create bunny_videos table for video metadata, processing status, and webhook event logs with unique (libraryId, videoId) constraint.',
    requiredForPreview: true,
    rollbackRisk: 'irreversible',
    verificationChecks: ['registry-match', 'ordered-exactly', 'bunny-videos'],
    authorizationCategory: 'payloadMigration',
  },
  {
    name: '20260719_150000_subscription_schema_cols',
    system: 'payload',
    order: 15,
    purpose: 'Add missing columns to payload_subscriptions: billing_cadence, commitment_status, stripe_subscription_schedule_id, and related commitment/grace period timestamps.',
    requiredForPreview: true,
    rollbackRisk: 'reversible',
    verificationChecks: ['registry-match', 'ordered-exactly'],
    authorizationCategory: 'payloadMigration',
  },
  {
    name: '20260720_000000_locked_docs_rels_new_collections',
    system: 'payload',
    order: 16,
    purpose: 'Add missing foreign-key columns to payload_locked_documents_rels for new Membership Support collections and create payload_membership_administration_actions table.',
    requiredForPreview: true,
    rollbackRisk: 'reversible',
    verificationChecks: ['registry-match', 'ordered-exactly', 'locked-docs-rels'],
    authorizationCategory: 'payloadMigration',
  },
  {
    name: '20260722_100000_reconcile_lockstate_vip_progress',
    system: 'payload',
    order: 17,
    purpose: 'Reconcile visual_lock_state → lock_state column rename, add vip to enum_payload_courses_access_badge, add unique constraint on (member_id, lesson_id) in payload_lesson_progress.',
    requiredForPreview: true,
    rollbackRisk: 'reversible',
    verificationChecks: ['registry-match', 'ordered-exactly'],
    authorizationCategory: 'payloadMigration',
  },
  {
    name: '20260723_000000_singular_membership_plan',
    system: 'payload',
    order: 18,
    purpose: 'Add jpv_bootcamp_membership to enum_payload_subscriptions_plan in its own committed migration transaction.',
    requiredForPreview: true,
    rollbackRisk: 'irreversible',
    verificationChecks: ['registry-match', 'ordered-exactly', 'enum-add-only'],
    authorizationCategory: 'payloadMigration',
  },
  {
    name: '20260723_000001_migrate_pro_to_membership',
    system: 'payload',
    order: 19,
    purpose: 'Migrate pro subscriptions to jpv_bootcamp_membership, then remove obsolete allowed-plans artifacts after the data update succeeds.',
    requiredForPreview: true,
    rollbackRisk: 'data_loss',
    verificationChecks: ['registry-match', 'ordered-exactly', 'enum-use-after-commit', 'rollback-guard'],
    authorizationCategory: 'payloadMigration',
  },
  {
    name: '20260724_120000_operator_content_media',
    system: 'payload',
    order: 20,
    purpose: 'Add managed Page, Post, and Lesson media relationships, publishing metadata, and archived Post status required by the Payload operator uplink.',
    requiredForPreview: true,
    rollbackRisk: 'data_loss',
    verificationChecks: ['registry-match', 'ordered-exactly', 'operator-content-media', 'rollback-guard'],
    authorizationCategory: 'payloadMigration',
  },
  {
    name: '20260724_121000_billing_operator_actions',
    system: 'payload',
    order: 21,
    purpose: 'Add guarded Stripe Billing Action relationships, audit fields, and operator/webhook action values.',
    requiredForPreview: true,
    rollbackRisk: 'data_loss',
    verificationChecks: ['registry-match', 'ordered-exactly', 'billing-operator-actions', 'rollback-guard'],
    authorizationCategory: 'payloadMigration',
  },
  {
    name: '20260724_122000_live_session_relationships',
    system: 'payload',
    order: 22,
    purpose: 'Add real Live Session module and lesson relationships plus lifecycle timestamps while preserving legacy text values for reconciliation.',
    requiredForPreview: true,
    rollbackRisk: 'data_loss',
    verificationChecks: ['registry-match', 'ordered-exactly', 'live-session-relationships', 'rollback-guard'],
    authorizationCategory: 'payloadMigration',
  },
  {
    name: '20260724_123000_email_operator_actions',
    system: 'payload',
    order: 23,
    purpose: 'Create auditable Email Actions and durable retry visibility on Email Events for operator-managed failed-delivery recovery.',
    requiredForPreview: true,
    rollbackRisk: 'data_loss',
    verificationChecks: ['registry-match', 'ordered-exactly', 'email-operator-actions', 'rollback-guard'],
    authorizationCategory: 'payloadMigration',
  },
  {
    name: '20260727_000000_partner_applications_source_member_id',
    system: 'payload',
    order: 24,
    purpose: 'Add missing source_member_id column to payload_partner_applications — column was defined in the collection but absent from staging after application-only deployment.',
    requiredForPreview: true,
    rollbackRisk: 'reversible',
    verificationChecks: ['registry-match', 'ordered-exactly'],
    authorizationCategory: 'payloadMigration',
  },
  {
    name: '20260727_100000_email_events_lease_columns',
    system: 'payload',
    order: 25,
    purpose: 'Add claimed_at and worker_claim_id lease columns to payload_email_events for atomic claim/stale-lease recovery, and a delivery_status index for efficient queue polling.',
    requiredForPreview: true,
    rollbackRisk: 'reversible',
    verificationChecks: ['registry-match', 'ordered-exactly'],
    authorizationCategory: 'payloadMigration',
  },
  {
    name: '20260727_200000_email_events_processing_status',
    system: 'payload',
    order: 26,
    purpose: "Add 'processing' value to enum_payload_email_events_delivery_status so the atomic claim/lease pattern can mark rows in-flight without risking double-sends.",
    requiredForPreview: true,
    rollbackRisk: 'reversible',
    verificationChecks: ['registry-match', 'ordered-exactly'],
    authorizationCategory: 'payloadMigration',
  },
] as const satisfies readonly PreviewMigrationInventoryEntry[]

export const PREVIEW_MIGRATION_INVENTORY_VERSION = 1

export function previewMigrationInventory(): PreviewMigrationInventoryEntry[] {
  return [...PREVIEW_MIGRATION_INVENTORY]
}

export function previewMigrationInventoryNames(): string[] {
  return PREVIEW_MIGRATION_INVENTORY.map((entry) => entry.name)
}

export function previewMigrationInventoryForPayload(): string[] {
  return previewMigrationInventoryNames()
}

export function validatePreviewMigrationInventoryOrder(value: unknown): value is string[] {
  return Array.isArray(value) &&
    value.length === PREVIEW_MIGRATION_INVENTORY.length &&
    PREVIEW_MIGRATION_INVENTORY.every((entry, index) => value[index] === entry.name)
}

export function assertPreviewMigrationInventoryMatch(names: string[]): boolean {
  const expected = previewMigrationInventoryNames()
  if (names.length !== expected.length) return false
  return expected.every((name, index) => names[index] === name)
}
