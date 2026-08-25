import { PAYLOAD_MIGRATION_NAMES } from './payloadMigrationRegistry'

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

type PreviewMigrationMetadata = Omit<
  PreviewMigrationInventoryEntry,
  'name' | 'system' | 'order' | 'requiredForPreview' | 'authorizationCategory'
>

const PREVIEW_MIGRATION_METADATA = [
  { purpose: 'Bootstrap the reviewed Payload course and admin data model.', rollbackRisk: 'irreversible', verificationChecks: ['registry-match', 'ordered-exactly', 'no-duplicates'] },
  { purpose: 'Extend the course system foundation for member access and content.', rollbackRisk: 'data_loss', verificationChecks: ['registry-match', 'ordered-exactly', 'course-foundations'] },
  { purpose: 'Add private media support for protected course resources.', rollbackRisk: 'data_loss', verificationChecks: ['registry-match', 'ordered-exactly', 'private-media'] },
  { purpose: 'Introduce structured community attachment handling.', rollbackRisk: 'data_loss', verificationChecks: ['registry-match', 'ordered-exactly', 'community-attachments'] },
  { purpose: 'Add affiliate reporting sources and legacy-compatible records.', rollbackRisk: 'data_loss', verificationChecks: ['registry-match', 'ordered-exactly', 'affiliate-reporting'] },
  { purpose: 'Harden preference record identity constraints.', rollbackRisk: 'irreversible', verificationChecks: ['registry-match', 'ordered-exactly', 'id-constraint'] },
  { purpose: 'Add member email verification action records and digest support.', rollbackRisk: 'data_loss', verificationChecks: ['registry-match', 'ordered-exactly', 'member-email'] },
  { purpose: 'Extend member account actions with purpose tracking.', rollbackRisk: 'irreversible', verificationChecks: ['registry-match', 'ordered-exactly', 'account-action-purposes'] },
  { purpose: 'Register partner affiliate, application, and event operations.', rollbackRisk: 'data_loss', verificationChecks: ['registry-match', 'ordered-exactly', 'partner-operations'] },
  { purpose: 'Reconcile partner affiliate array tables and application snapshot columns with the current Payload schema.', rollbackRisk: 'data_loss', verificationChecks: ['registry-match', 'ordered-exactly', 'partner-schema-reconciliation'] },
  { purpose: 'Remove the legacy table-plan value from Payload membership-tier enumerations.', rollbackRisk: 'irreversible', verificationChecks: ['registry-match', 'ordered-exactly', 'table-plan-removal'] },
  { purpose: 'Create membership support schema, constraints, indexes, and audit fields.', rollbackRisk: 'irreversible', verificationChecks: ['registry-match', 'ordered-exactly', 'membership-support-schema'] },
  { purpose: 'Create live-session records for real-time video sessions.', rollbackRisk: 'irreversible', verificationChecks: ['registry-match', 'ordered-exactly', 'live-sessions'] },
  { purpose: 'Create Bunny video metadata and webhook event records.', rollbackRisk: 'irreversible', verificationChecks: ['registry-match', 'ordered-exactly', 'bunny-videos'] },
  { purpose: 'Add subscription billing cadence, commitment state, schedule IDs, and related timestamps.', rollbackRisk: 'reversible', verificationChecks: ['registry-match', 'ordered-exactly', 'subscription-columns'] },
  { purpose: 'Add locked-document relationships and membership administration actions.', rollbackRisk: 'reversible', verificationChecks: ['registry-match', 'ordered-exactly', 'locked-docs-rels'] },
  { purpose: 'Reconcile lock-state naming, course access badges, and unique lesson progress.', rollbackRisk: 'reversible', verificationChecks: ['registry-match', 'ordered-exactly', 'lockstate-progress'] },
  { purpose: 'Add the singular JPV Bootcamp membership plan enum value.', rollbackRisk: 'irreversible', verificationChecks: ['registry-match', 'ordered-exactly', 'enum-add-only'] },
  { purpose: 'Migrate Pro subscriptions to the singular membership plan and remove obsolete artifacts.', rollbackRisk: 'data_loss', verificationChecks: ['registry-match', 'ordered-exactly', 'enum-use-after-commit', 'rollback-guard'] },
  { purpose: 'Add managed content media relationships and publishing metadata.', rollbackRisk: 'data_loss', verificationChecks: ['registry-match', 'ordered-exactly', 'operator-content-media', 'rollback-guard'] },
  { purpose: 'Add guarded Stripe billing-action relationships and audit fields.', rollbackRisk: 'data_loss', verificationChecks: ['registry-match', 'ordered-exactly', 'billing-operator-actions', 'rollback-guard'] },
  { purpose: 'Add Live Session module and lesson relationships plus lifecycle timestamps.', rollbackRisk: 'data_loss', verificationChecks: ['registry-match', 'ordered-exactly', 'live-session-relationships', 'rollback-guard'] },
  { purpose: 'Create auditable email actions and durable failed-delivery recovery visibility.', rollbackRisk: 'data_loss', verificationChecks: ['registry-match', 'ordered-exactly', 'email-operator-actions', 'rollback-guard'] },
  { purpose: 'Add partner application source-member identifiers.', rollbackRisk: 'reversible', verificationChecks: ['registry-match', 'ordered-exactly', 'partner-source-member'] },
  { purpose: 'Add email-event claim and worker lease columns plus polling indexes.', rollbackRisk: 'reversible', verificationChecks: ['registry-match', 'ordered-exactly', 'email-leases'] },
  { purpose: 'Add the email-event processing delivery state for atomic claim handling.', rollbackRisk: 'reversible', verificationChecks: ['registry-match', 'ordered-exactly', 'email-processing-state'] },
  { purpose: 'Reconcile membership audit relationship columns and foreign keys.', rollbackRisk: 'irreversible', verificationChecks: ['registry-match', 'ordered-exactly', 'audit-history-columns'] },
  { purpose: 'Add the terminal email-event state used by the staging recipient guard.', rollbackRisk: 'irreversible', verificationChecks: ['registry-match', 'ordered-exactly', 'staging-email-guard-status'] },
  { purpose: 'Add durable member account-action reservations, lease recovery, and completion fingerprints.', rollbackRisk: 'reversible', verificationChecks: ['registry-match', 'ordered-exactly', 'account-action-reservation', 'rollback-guard'] },
  { purpose: 'Promote Bunny Stream persistence to canonical GUID-first identity with guarded lesson relationships.', rollbackRisk: 'data_loss', verificationChecks: ['registry-match', 'ordered-exactly', 'bunny-guid-first', 'rollback-guard'] },
  { purpose: 'Create the physical lesson-comment schema and locked-document relationship.', rollbackRisk: 'data_loss', verificationChecks: ['registry-match', 'ordered-exactly', 'lesson-comments', 'rollback-guard'] },
  { purpose: 'Add the source-proven community OG image relationship.', rollbackRisk: 'reversible', verificationChecks: ['registry-match', 'ordered-exactly', 'space-og-image', 'rollback-guard'] },
  { purpose: 'Create community reaction persistence for posts, comments, and preserved survey-option votes.', rollbackRisk: 'data_loss', verificationChecks: ['registry-match', 'ordered-exactly', 'community-reactions', 'rollback-guard'] },
  { purpose: 'Persist source-proven member profile cover, website, biography, and social-link fields.', rollbackRisk: 'data_loss', verificationChecks: ['registry-match', 'ordered-exactly', 'member-profile-parity', 'rollback-guard'] },
  { purpose: 'Create PortalSettings global persistence with grouped branding fields and media relationships.', rollbackRisk: 'data_loss', verificationChecks: ['registry-match', 'ordered-exactly', 'portal-settings', 'rollback-guard'] },
  { purpose: 'Extend live_sessions with optional space FK for group calls; enforce either-or course/space constraint.', rollbackRisk: 'reversible', verificationChecks: ['registry-match', 'ordered-exactly', 'live-session-space', 'rollback-guard'] },
  { purpose: 'Create additive member-owned reaction persistence without changing legacy space reactions.', rollbackRisk: 'data_loss', verificationChecks: ['registry-match', 'ordered-exactly', 'engagement-reactions', 'no-legacy-backfill', 'rollback-guard'] },
  { purpose: 'Create CMS-configurable portal nav items table and add portal_route column to pages.', rollbackRisk: 'reversible', verificationChecks: ['registry-match', 'ordered-exactly', 'portal-nav-items'] },
  { purpose: 'Create member notification records for in-app notification delivery.', rollbackRisk: 'reversible', verificationChecks: ['registry-match', 'ordered-exactly', 'member-notifications'] },
  { purpose: 'Add seat-tracking columns to pay-it-forward funding; make legacy required columns nullable; create PayItForwardSettings global table.', rollbackRisk: 'data_loss', verificationChecks: ['registry-match', 'ordered-exactly', 'pay-it-forward-schema'] },
  { purpose: 'Expose Stripe invoice totals, attempts, hosted links, next-payment timing, and reconciliation actions in Payload billing projections.', rollbackRisk: 'irreversible', verificationChecks: ['registry-match', 'ordered-exactly', 'billing-invoice-visibility'] },
  { purpose: 'Align membership-support source and administrator relationship columns with the current Payload runtime schema.', rollbackRisk: 'reversible', verificationChecks: ['registry-match', 'ordered-exactly', 'membership-support-runtime-alignment'] },
  { purpose: 'Create the missing Payload relationship table for membership-support reverse relationships.', rollbackRisk: 'data_loss', verificationChecks: ['registry-match', 'ordered-exactly', 'membership-support-relationships'] },
  { purpose: 'Align legacy membership-support relationship columns and review enums with the current Payload runtime contract.', rollbackRisk: 'irreversible', verificationChecks: ['registry-match', 'ordered-exactly', 'membership-support-relationship-alignment'] },
  { purpose: 'Align the membership review assignee relationship column with the current Payload runtime contract.', rollbackRisk: 'reversible', verificationChecks: ['registry-match', 'ordered-exactly', 'membership-review-assignee-alignment'] },
  { purpose: 'Add current membership-support Stripe shadow states while preserving historical state values.', rollbackRisk: 'irreversible', verificationChecks: ['registry-match', 'ordered-exactly', 'membership-shadow-state-alignment'] },
] as const satisfies readonly PreviewMigrationMetadata[]

if (PREVIEW_MIGRATION_METADATA.length !== PAYLOAD_MIGRATION_NAMES.length) {
  throw new Error('Preview migration metadata must align with the canonical Payload migration registry')
}

export const PREVIEW_MIGRATION_INVENTORY: readonly PreviewMigrationInventoryEntry[] =
  PAYLOAD_MIGRATION_NAMES.map((name, index) => {
    const metadata = PREVIEW_MIGRATION_METADATA[index]
    if (!metadata) throw new Error(`Missing preview migration metadata at index ${index}`)
    return {
      name,
      system: 'payload',
      order: index + 1,
      purpose: metadata.purpose,
      requiredForPreview: true,
      rollbackRisk: metadata.rollbackRisk,
      verificationChecks: [...metadata.verificationChecks],
      authorizationCategory: 'payloadMigration',
    }
  })

export const PREVIEW_MIGRATION_INVENTORY_VERSION = 2

export function previewMigrationInventory(): PreviewMigrationInventoryEntry[] {
  return PREVIEW_MIGRATION_INVENTORY.map((entry) => ({
    ...entry,
    verificationChecks: [...entry.verificationChecks],
  }))
}

export function previewMigrationInventoryNames(): string[] {
  return [...PAYLOAD_MIGRATION_NAMES]
}

export function previewMigrationInventoryForPayload(): string[] {
  return previewMigrationInventoryNames()
}

export function validatePreviewMigrationInventoryOrder(value: unknown): value is string[] {
  return Array.isArray(value) &&
    value.length === PAYLOAD_MIGRATION_NAMES.length &&
    PAYLOAD_MIGRATION_NAMES.every((name, index) => value[index] === name)
}

export function assertPreviewMigrationInventoryMatch(names: string[]): boolean {
  if (names.length !== PAYLOAD_MIGRATION_NAMES.length) return false
  return PAYLOAD_MIGRATION_NAMES.every((name, index) => names[index] === name)
}
