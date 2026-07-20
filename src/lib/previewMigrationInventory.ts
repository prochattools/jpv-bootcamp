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
