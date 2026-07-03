import { previewMigrationInventoryNames, validatePreviewMigrationInventoryOrder } from './previewMigrationInventory'
import { isImmutableImageReference, isFullGitSha } from './previewReleasePolicy'

export type PreviewRollbackPlanInput = {
  currentCommitSha: string
  previousImmutableImageReference: string
  targetEnvironment: 'preview' | 'staging'
  stopControls: {
    memberWritesFrozen: boolean
    communityPublishingFrozen: boolean
    partnerDeliveryFrozen: boolean
    providerEmailFrozen: boolean
    billingSideChangesFrozen: boolean
  }
  migrationBackout: Array<{
    name: string
    reversibility: 'reversible' | 'data_loss' | 'irreversible'
    warning: string
    backupRequired: boolean
  }>
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
}

export type PreviewRollbackPlanValidationResult = {
  ok: boolean
  errors: string[]
}

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

export type PreviewRollbackEvidenceValidationResult = {
  ok: boolean
  errors: string[]
}

export type PreviewRollbackPlan = PreviewRollbackPlanInput & {
  schemaVersion: 1
  migrationOrder: string[]
}

export function validatePreviewRollbackPlanInput(
  input: PreviewRollbackPlanInput,
): PreviewRollbackPlanValidationResult {
  const errors: string[] = []
  if (!isFullGitSha(input.currentCommitSha)) errors.push('current_commit_sha_required')
  if (!isImmutableImageReference(input.previousImmutableImageReference)) errors.push('previous_immutable_image_required')
  if (input.targetEnvironment !== 'preview' && input.targetEnvironment !== 'staging') errors.push('target_environment_required')
  if (!input.stopControls.memberWritesFrozen) errors.push('member_writes_must_be_frozen')
  if (!input.stopControls.communityPublishingFrozen) errors.push('community_publishing_must_be_frozen')
  if (!input.stopControls.partnerDeliveryFrozen) errors.push('partner_delivery_must_be_frozen')
  if (!input.stopControls.providerEmailFrozen) errors.push('provider_email_must_be_frozen')
  if (!input.stopControls.billingSideChangesFrozen) errors.push('billing_side_changes_must_be_frozen')
  if (!validatePreviewMigrationInventoryOrder(input.migrationBackout.map((entry) => entry.name))) errors.push('migration_order_required')
  if (input.migrationBackout.some((entry) => !entry.warning.trim())) errors.push('migration_warning_required')
  if (input.migrationBackout.some((entry) => !entry.backupRequired)) errors.push('backup_required')
  if (input.migrationBackout.some((entry) => entry.reversibility === 'irreversible' && entry.backupRequired !== true)) errors.push('irreversible_requires_backup')
  if (input.prismaDatabaseStartup.startupMode !== 'application-only' && input.prismaDatabaseStartup.startupMode !== 'database-deploy') errors.push('startup_mode_required')
  if (input.prismaDatabaseStartup.deploymentEnv !== 'preview' && input.prismaDatabaseStartup.deploymentEnv !== 'staging') errors.push('deployment_env_required')
  if (!input.prismaDatabaseStartup.requiresApproval) errors.push('prisma_startup_requires_approval')
  if (!input.webhookPreservation.preserveExistingEvents) errors.push('webhook_preservation_required')
  if (!input.webhookPreservation.replaySafe) errors.push('webhook_replay_safety_required')
  if (!input.webhookPreservation.replayNotes.trim()) errors.push('webhook_replay_notes_required')
  if (input.successChecks.length === 0) errors.push('success_checks_required')
  if (input.hardStopConditions.length === 0) errors.push('hard_stop_conditions_required')
  return { ok: errors.length === 0, errors }
}

export function buildPreviewRollbackPlan(input: PreviewRollbackPlanInput): PreviewRollbackPlan {
  const validation = validatePreviewRollbackPlanInput(input)
  if (!validation.ok) {
    throw new Error(`Invalid rollback plan input: ${validation.errors.join(', ')}`)
  }

  return {
    schemaVersion: 1,
    ...input,
    migrationOrder: previewMigrationInventoryNames(),
  }
}

export function serializePreviewRollbackPlan(plan: PreviewRollbackPlan): string {
  return `${JSON.stringify(plan, null, 2)}\n`
}

export function validatePreviewRollbackEvidence(
  input: Partial<PreviewRollbackEvidenceInput>,
): PreviewRollbackEvidenceValidationResult {
  const errors: string[] = []
  if (input.schemaVersion !== 1) errors.push('schema_version_required')
  if (!isFullGitSha(input.commitSha)) errors.push('commit_sha_required')
  if (input.imageReference !== undefined && !isImmutableImageReference(input.imageReference)) errors.push('immutable_image_required')
  if (input.targetEnvironment !== 'preview' && input.targetEnvironment !== 'staging') errors.push('target_environment_required')
  if (typeof input.rollbackPlanId !== 'string' || !input.rollbackPlanId.trim()) errors.push('rollback_plan_id_required')
  if (typeof input.startedAt !== 'string' || Number.isNaN(Date.parse(input.startedAt))) errors.push('started_at_required')
  if (typeof input.endedAt !== 'string' || Number.isNaN(Date.parse(input.endedAt))) errors.push('ended_at_required')
  if (typeof input.startedAt === 'string' && typeof input.endedAt === 'string' && Date.parse(input.endedAt) < Date.parse(input.startedAt)) errors.push('invalid_time_range')
  if (!['passed', 'failed', 'blocked', 'skipped'].includes(input.status ?? '')) errors.push('status_required')
  if (typeof input.operator !== 'string' || !input.operator.trim()) errors.push('operator_required')
  if (typeof input.approvalReference !== 'string' || !input.approvalReference.trim()) errors.push('approval_reference_required')
  if (typeof input.backupReference !== 'string' || !input.backupReference.trim()) errors.push('backup_reference_required')
  if (typeof input.notes !== 'string' || !input.notes.trim()) errors.push('notes_required')
  if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|password|token|cookie|session|database_url|postgres:\/\//i.test(input.notes ?? '')) {
    errors.push('sensitive_notes_rejected')
  }
  return { ok: errors.length === 0, errors }
}
