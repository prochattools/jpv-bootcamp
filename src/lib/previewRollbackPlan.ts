import { previewMigrationInventory, previewMigrationInventoryNames } from './previewMigrationInventory'
import { isFullGitSha, isImmutableImageReference } from './previewReleasePolicy'

export type PreviewRollbackMigrationEntry = {
  name: string
  rollbackRisk: 'reversible' | 'data_loss' | 'irreversible'
  backupRequired: boolean
  warning: string
  verificationChecks: string[]
  automaticDownProhibited: boolean
}

export type PreviewRollbackPlanInput = {
  currentCommitSha: string
  previousImmutableImageReference: string
  targetEnvironment: 'preview' | 'staging'
  backupReference: string
  planningMode: 'draft' | 'repository-only'
  plannedFreezeControls: {
    memberWritesFrozen: boolean
    communityPublishingFrozen: boolean
    partnerDeliveryFrozen: boolean
    providerEmailFrozen: boolean
    billingSideChangesFrozen: boolean
  }
  confirmedFreezeEvidence?: {
    memberWritesFrozen?: string
    communityPublishingFrozen?: string
    partnerDeliveryFrozen?: string
    providerEmailFrozen?: string
    billingSideChangesFrozen?: string
  }
  migrationBackout: PreviewRollbackMigrationEntry[]
  prismaDatabaseStartup: {
    startupMode: 'application-only' | 'database-deploy'
    deploymentEnv: 'preview' | 'staging'
    requiresApproval: boolean
  }
  webhookPreservation: {
    preserveExistingEvents: boolean
    replaySafe: boolean
    replayNotes: string
  }
  successChecks: string[]
  hardStopConditions: string[]
  authorizationStatus: 'missing' | 'draft' | 'pending' | 'approved'
  missingRequirements: string[]
  generatedFromCommit: string
  canonicalMigrationInventoryDigest: string
  rollbackImageCommit?: string
  backupReferencePresent: boolean
  protectedPathsExcluded: boolean
  executable: boolean
}

export type PreviewRollbackPlanValidationResult = { ok: boolean; errors: string[] }

export type PreviewRollbackEvidenceInput = {
  schemaVersion: 1
  commitSha: string
  imageReference?: string
  targetEnvironment: 'preview' | 'staging'
  rollbackPlanId: string
  startedAt: string
  endedAt: string
  status: 'passed' | 'failed' | 'blocked' | 'skipped'
  operator: string
  approvalReference: string
  backupReference: string
  notes: string
}

export type PreviewRollbackEvidenceValidationResult = { ok: boolean; errors: string[] }

function stableDigest(names: string[]): string {
  return `sha256:${names.join('|')}`
}

function placeholder(value: string | undefined): boolean {
  return !value || /^(approval|placeholder|example|todo|pending|change-me|test-approval|backup-reference|operator)$/i.test(value.trim())
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function buildPreviewRollbackPlan(input: Omit<PreviewRollbackPlanInput, 'generatedFromCommit' | 'canonicalMigrationInventoryDigest' | 'rollbackImageCommit' | 'backupReferencePresent' | 'protectedPathsExcluded' | 'executable' | 'authorizationStatus' | 'missingRequirements'> & {
  migrationBackout?: PreviewRollbackMigrationEntry[]
  confirmedFreezeEvidence?: PreviewRollbackPlanInput['confirmedFreezeEvidence']
  authorizationStatus?: PreviewRollbackPlanInput['authorizationStatus']
  missingRequirements?: string[]
  generatedFromCommit?: string
  canonicalMigrationInventoryDigest?: string
  rollbackImageCommit?: string
  backupReferencePresent?: boolean
  protectedPathsExcluded?: boolean
  executable?: boolean
}): PreviewRollbackPlanInput {
  const migrationBackout =
    input.migrationBackout ??
    previewMigrationInventory().map((entry) => ({
      name: entry.name,
      rollbackRisk: entry.rollbackRisk,
      backupRequired: entry.rollbackRisk !== 'reversible' || entry.requiredForPreview,
      warning: entry.rollbackRisk === 'irreversible'
        ? `Rollback of ${entry.name} is irreversible and requires a verified backup.`
        : entry.rollbackRisk === 'data_loss'
          ? `Rollback of ${entry.name} may lose data and requires a verified backup.`
          : `Rollback of ${entry.name} is reversible, but verify the backup before execution.`,
      verificationChecks: [...entry.verificationChecks],
      automaticDownProhibited: entry.rollbackRisk !== 'reversible',
    }))

  const missingRequirements = validatePreviewRollbackPlanInput({
    ...input,
    backupReference: input.backupReference,
    migrationBackout,
    planningMode: input.planningMode,
    plannedFreezeControls: input.plannedFreezeControls,
    prismaDatabaseStartup: input.prismaDatabaseStartup,
    webhookPreservation: input.webhookPreservation,
    successChecks: input.successChecks,
    hardStopConditions: input.hardStopConditions,
    currentCommitSha: input.currentCommitSha,
    previousImmutableImageReference: input.previousImmutableImageReference,
    targetEnvironment: input.targetEnvironment,
    authorizationStatus: 'missing',
    missingRequirements: [],
    generatedFromCommit: input.currentCommitSha,
    canonicalMigrationInventoryDigest: stableDigest(previewMigrationInventoryNames()),
    backupReferencePresent: true,
    protectedPathsExcluded: true,
    executable: false,
  }).errors

  return {
    ...input,
    migrationBackout,
    authorizationStatus: input.planningMode === 'draft' ? 'draft' : 'missing',
    missingRequirements,
    generatedFromCommit: input.currentCommitSha,
    canonicalMigrationInventoryDigest: stableDigest(previewMigrationInventoryNames()),
    rollbackImageCommit: isImmutableImageReference(input.previousImmutableImageReference)
      ? input.previousImmutableImageReference.split(':').at(-1)?.replace('@sha256', '')?.replace(/^sha256:/, '')
      : undefined,
    backupReferencePresent: hasText(input.backupReference),
    protectedPathsExcluded: true,
    executable: false,
  }
}

export function validatePreviewRollbackPlanInput(input: PreviewRollbackPlanInput): PreviewRollbackPlanValidationResult {
  const errors: string[] = []
  if (!isFullGitSha(input.currentCommitSha)) errors.push('current_commit_sha_required')
  if (!isImmutableImageReference(input.previousImmutableImageReference)) errors.push('previous_immutable_image_required')
  if (input.targetEnvironment !== 'preview' && input.targetEnvironment !== 'staging') errors.push('target_environment_required')
  if (placeholder(input.backupReference)) errors.push('backup_reference_required')
  if (!input.protectedPathsExcluded) errors.push('protected_paths_must_be_excluded')
  if (!input.backupReferencePresent) errors.push('backup_reference_missing')
  if (input.plannedFreezeControls.memberWritesFrozen || input.plannedFreezeControls.communityPublishingFrozen || input.plannedFreezeControls.partnerDeliveryFrozen || input.plannedFreezeControls.providerEmailFrozen || input.plannedFreezeControls.billingSideChangesFrozen) {
    // planned controls are allowed to be false or true, but no claim of confirmation without evidence
  }
  if (input.confirmedFreezeEvidence) {
    const entries = Object.values(input.confirmedFreezeEvidence)
    if (entries.some((entry) => !hasText(entry))) errors.push('freeze_evidence_required')
  }
  if (input.migrationBackout.length !== previewMigrationInventoryNames().length) errors.push('migration_order_required')
  if (!previewMigrationInventoryNames().every((name, index) => input.migrationBackout[index]?.name === name)) errors.push('migration_order_required')
  if (input.migrationBackout.some((entry) => entry.rollbackRisk === 'irreversible' && !entry.warning.toLowerCase().includes('irreversible'))) errors.push('irreversible_warning_required')
  if (input.migrationBackout.some((entry) => !entry.backupRequired)) errors.push('backup_required')
  if (input.migrationBackout.some((entry) => entry.automaticDownProhibited !== (entry.rollbackRisk !== 'reversible'))) errors.push('automatic_down_prohibition_required')
  if (!hasText(input.prismaDatabaseStartup.startupMode)) errors.push('startup_mode_required')
  if (!hasText(input.prismaDatabaseStartup.deploymentEnv)) errors.push('deployment_env_required')
  if (!input.prismaDatabaseStartup.requiresApproval) errors.push('prisma_startup_requires_approval')
  if (!input.webhookPreservation.preserveExistingEvents) errors.push('webhook_preservation_required')
  if (!input.webhookPreservation.replaySafe) errors.push('webhook_replay_safety_required')
  if (!hasText(input.webhookPreservation.replayNotes)) errors.push('webhook_replay_notes_required')
  if (input.successChecks.length === 0) errors.push('success_checks_required')
  if (input.hardStopConditions.length === 0) errors.push('hard_stop_conditions_required')
  if (placeholder(input.generatedFromCommit) || input.generatedFromCommit !== input.currentCommitSha) errors.push('generated_from_commit_required')
  if (input.canonicalMigrationInventoryDigest !== stableDigest(previewMigrationInventoryNames())) errors.push('migration_inventory_digest_required')
  if (input.rollbackImageCommit && input.rollbackImageCommit !== input.currentCommitSha) errors.push('rollback_image_commit_mismatch')
  if (!['missing', 'draft', 'pending', 'approved'].includes(input.authorizationStatus)) errors.push('authorization_status_required')
  if (input.executable && input.authorizationStatus !== 'approved') errors.push('approval_required_for_execution')
  if (input.missingRequirements.length > 0 && input.executable) errors.push('missing_requirements_block_execution')
  return { ok: errors.length === 0, errors }
}

export function serializePreviewRollbackPlan(plan: PreviewRollbackPlanInput): string {
  return `${JSON.stringify(plan, null, 2)}\n`
}

export function validatePreviewRollbackEvidence(input: Partial<PreviewRollbackEvidenceInput>): PreviewRollbackEvidenceValidationResult {
  const errors: string[] = []
  if (input.schemaVersion !== 1) errors.push('schema_version_required')
  if (!isFullGitSha(input.commitSha)) errors.push('commit_sha_required')
  if (input.imageReference !== undefined && !isImmutableImageReference(input.imageReference)) errors.push('immutable_image_required')
  if (input.targetEnvironment !== 'preview' && input.targetEnvironment !== 'staging') errors.push('target_environment_required')
  if (!hasText(input.rollbackPlanId)) errors.push('rollback_plan_id_required')
  if (!hasText(input.startedAt) || Number.isNaN(Date.parse(input.startedAt))) errors.push('started_at_required')
  if (!hasText(input.endedAt) || Number.isNaN(Date.parse(input.endedAt))) errors.push('ended_at_required')
  if (hasText(input.startedAt) && hasText(input.endedAt) && Date.parse(input.endedAt) < Date.parse(input.startedAt)) errors.push('invalid_time_range')
  if (!['passed', 'failed', 'blocked', 'skipped'].includes(input.status ?? '')) errors.push('status_required')
  if (placeholder(input.operator)) errors.push('operator_required')
  if (placeholder(input.approvalReference)) errors.push('approval_reference_required')
  if (placeholder(input.backupReference)) errors.push('backup_reference_required')
  if (!hasText(input.notes)) errors.push('notes_required')
  if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|password|token|cookie|session|database_url|postgres:\/\//i.test(input.notes ?? '')) errors.push('sensitive_notes_rejected')
  return { ok: errors.length === 0, errors }
}
