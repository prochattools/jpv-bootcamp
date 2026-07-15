export const DECISION_READY_SUMMARY = 'DECISION-READY, EXTERNAL APPROVALS PENDING'
export const NOT_DECISION_READY_SUMMARY = 'NOT DECISION-READY'

export type DecisionReadinessState =
  | 'repository-ready'
  | 'awaiting external approval'
  | 'approved'
  | 'rejected'
  | 'blocked'

export type DecisionManifestEntry = {
  id: string
  category:
    | 'programme content'
    | 'table-plan-to-Free'
    | 'account-column rename'
    | 'migration'
    | 'rollback'
    | 'provider'
    | 'staging smoke'
    | 'go/no-go'
  title: string
  filePath: string
  ownerRole: string
  approverRole: string
  implementationOwnerRole: string
  rollbackOwnerRole: string
  dependencyIds: string[]
  allowedStatuses: string[]
  requiredEvidence: string[]
  classification: 'internal' | 'external' | 'mixed'
  releaseImpact: string
  defaultStatus: string
}

export const DECISION_MANIFEST: DecisionManifestEntry[] = [
  {
    id: 'programme-content-publication',
    category: 'programme content',
    title: 'Programme Content Publication Approval',
    filePath: 'docs/decisions/PROGRAMME_CONTENT_PUBLICATION_APPROVAL.md',
    ownerRole: 'Client content owner',
    approverRole: 'JPV Bootcamp business owner',
    implementationOwnerRole: 'Content import operator',
    rollbackOwnerRole: 'Release rollback owner',
    dependencyIds: [],
    allowedStatuses: ['AWAITING_CLIENT_CONTENT', 'APPROVED', 'REJECTED', 'BLOCKED'],
    requiredEvidence: [
      'docs/client/PROGRAMME_CONTENT_INTAKE_TEMPLATE.md',
      'docs/client/PROGRAMME_CONTENT_APPROVAL_RECORD.md',
      'pnpm content:programme:validate',
      'pnpm content:programme:acceptance',
      'pnpm content:programme:import-plan',
    ],
    classification: 'external',
    releaseImpact: 'Blocks staging smoke signoff and formal go/no-go.',
    defaultStatus: 'AWAITING_CLIENT_CONTENT',
  },
  {
    id: 'table-plan-to-free',
    category: 'table-plan-to-Free',
    title: 'Table Plan to Free Approval',
    filePath: 'docs/decisions/TABLE_PLAN_TO_FREE_APPROVAL.md',
    ownerRole: 'Platform owner',
    approverRole: 'JPV Bootcamp business owner',
    implementationOwnerRole: 'Migration operator',
    rollbackOwnerRole: 'Release rollback owner',
    dependencyIds: [],
    allowedStatuses: ['AWAITING_APPROVAL', 'APPROVED', 'REJECTED', 'BLOCKED'],
    requiredEvidence: [
      'docs/client/MIGRATION_APPROVAL_PACKET.md',
      'src/migrations/20260707_130000_remove_table_plan_from_payload_enums.ts',
      'scripts/migration_readiness_static.test.ts',
    ],
    classification: 'external',
    releaseImpact: 'Blocks staging migration approval and formal go/no-go.',
    defaultStatus: 'AWAITING_APPROVAL',
  },
  {
    id: 'account-column-rename',
    category: 'account-column rename',
    title: 'Account Column Rename Approval',
    filePath: 'docs/decisions/ACCOUNT_COLUMN_RENAME_APPROVAL.md',
    ownerRole: 'Platform owner',
    approverRole: 'Database owner',
    implementationOwnerRole: 'Migration operator',
    rollbackOwnerRole: 'Database rollback owner',
    dependencyIds: [],
    allowedStatuses: ['AWAITING_APPROVAL', 'APPROVED', 'REJECTED', 'BLOCKED'],
    requiredEvidence: [
      'docs/client/MIGRATION_APPROVAL_PACKET.md',
      'prisma/migrations/20260707_120000_rename_account_identity_columns/migration.sql',
      'prisma/system.prisma',
      'prisma/schema.prisma',
    ],
    classification: 'external',
    releaseImpact: 'Blocks staging migration approval and formal go/no-go.',
    defaultStatus: 'AWAITING_APPROVAL',
  },
  {
    id: 'staging-migration-approval',
    category: 'migration',
    title: 'Staging Migration Approval',
    filePath: 'docs/decisions/STAGING_MIGRATION_APPROVAL.md',
    ownerRole: 'Release operator',
    approverRole: 'Database owner',
    implementationOwnerRole: 'Migration operator',
    rollbackOwnerRole: 'Rollback owner',
    dependencyIds: ['table-plan-to-free', 'account-column-rename', 'rollback-readiness'],
    allowedStatuses: ['NOT_APPROVED', 'APPROVED', 'REJECTED', 'DEFERRED', 'BLOCKED'],
    requiredEvidence: [
      'docs/release/SUPPORT_REQUESTS_MIGRATION_RUNBOOK.md',
      'docs/release/ROLLBACK_EVIDENCE_CHECKLIST.md',
      'pnpm staging:migration-preflight',
      'pnpm staging:migration-rehearsal',
      'pnpm staging:migration-rehearsal:evidence',
    ],
    classification: 'mixed',
    releaseImpact: 'Blocks any approved migration execution and staging verification.',
    defaultStatus: 'NOT_APPROVED',
  },
  {
    id: 'rollback-readiness',
    category: 'rollback',
    title: 'Rollback Readiness Approval',
    filePath: 'docs/decisions/ROLLBACK_READINESS_APPROVAL.md',
    ownerRole: 'Rollback owner',
    approverRole: 'Release operator',
    implementationOwnerRole: 'Release operator',
    rollbackOwnerRole: 'Rollback owner',
    dependencyIds: [],
    allowedStatuses: ['DOCUMENTED_BUT_INCOMPLETE', 'READY_FOR_APPROVAL', 'APPROVED', 'REJECTED', 'BLOCKED'],
    requiredEvidence: [
      'docs/release/ROLLBACK_EVIDENCE_CHECKLIST.md',
      'pnpm staging:migration-rehearsal:evidence',
      'backup or snapshot reference',
    ],
    classification: 'internal',
    releaseImpact: 'Blocks approved migration execution and formal go/no-go.',
    defaultStatus: 'DOCUMENTED_BUT_INCOMPLETE',
  },
  {
    id: 'provider-verification',
    category: 'provider',
    title: 'Provider Verification Approval',
    filePath: 'docs/decisions/PROVIDER_VERIFICATION_APPROVAL.md',
    ownerRole: 'Credentials owner',
    approverRole: 'Release operator',
    implementationOwnerRole: 'Provider verification operator',
    rollbackOwnerRole: 'Release rollback owner',
    dependencyIds: ['staging-migration-approval'],
    allowedStatuses: ['UNEXECUTED', 'APPROVED', 'REJECTED', 'BLOCKED'],
    requiredEvidence: [
      'docs/release/PROVIDER_VERIFICATION_RUNBOOK.md',
      'docs/client/PROVIDER_EMAIL_EVIDENCE_TEMPLATE.md',
      'pnpm staging:provider-simulation',
    ],
    classification: 'external',
    releaseImpact: 'Blocks staging smoke signoff and formal go/no-go.',
    defaultStatus: 'UNEXECUTED',
  },
  {
    id: 'staging-smoke',
    category: 'staging smoke',
    title: 'Staging Smoke Approval',
    filePath: 'docs/decisions/STAGING_SMOKE_APPROVAL.md',
    ownerRole: 'Release operator',
    approverRole: 'Go-live approver',
    implementationOwnerRole: 'Smoke verification operator',
    rollbackOwnerRole: 'Release rollback owner',
    dependencyIds: ['staging-migration-approval', 'provider-verification', 'programme-content-publication'],
    allowedStatuses: ['UNEXECUTED', 'APPROVED', 'REJECTED', 'BLOCKED'],
    requiredEvidence: [
      'docs/client/STAGING_SMOKE_CHECKLIST.md',
      'docs/client/STAGING_SMOKE_EVIDENCE_TEMPLATE.md',
      'pnpm staging:smoke-plan',
      'pnpm staging:smoke-simulated',
    ],
    classification: 'external',
    releaseImpact: 'Blocks formal go/no-go.',
    defaultStatus: 'UNEXECUTED',
  },
  {
    id: 'core-go-live',
    category: 'go/no-go',
    title: 'Core Go-Live Decision',
    filePath: 'docs/decisions/CORE_GO_LIVE_DECISION.md',
    ownerRole: 'Release operator',
    approverRole: 'Formal go-live approver',
    implementationOwnerRole: 'Release operator',
    rollbackOwnerRole: 'Release rollback owner',
    dependencyIds: [
      'programme-content-publication',
      'table-plan-to-free',
      'account-column-rename',
      'staging-migration-approval',
      'rollback-readiness',
      'provider-verification',
      'staging-smoke',
    ],
    allowedStatuses: ['NO-GO', 'CONDITIONAL GO', 'GO'],
    requiredEvidence: [
      'docs/release/GO_NO_GO_CHECKLIST.md',
      'pnpm staging:decision-readiness',
      'formal approval record',
    ],
    classification: 'mixed',
    releaseImpact: 'Final release decision record.',
    defaultStatus: 'NO-GO',
  },
]

