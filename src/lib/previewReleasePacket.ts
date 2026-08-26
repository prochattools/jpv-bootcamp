import { PREVIEW_SMOKE_CHECKS } from './previewSmokePlan'
import { previewMigrationInventoryNames, validatePreviewMigrationInventoryOrder } from './previewMigrationInventory'
import { isFullGitSha, isImmutableImageReference } from './previewReleasePolicy'

export type PreviewReleaseApprovalCategory =
  | 'push'
  | 'imagePublication'
  | 'migrationExecution'
  | 'deployment'
  | 'providerDryRun'
  | 'providerApply'
  | 'billingVerification'
  | 'communityVerification'
  | 'partnerVerification'
  | 'rollbackRehearsal'
  | 'finalCutover'

export type PreviewReleaseApprovalRecord = {
  category: PreviewReleaseApprovalCategory
  authorized: boolean
  targetEnvironment: 'preview' | 'staging'
  commitSha?: string
  operator: string
  approvalReference: string
  approvedAt: string
  expiresAt?: string
  evidenceReference: string
  stopConditions: string[]
}

export type PreviewReleasePacketInput = {
  repository: string
  branch: string
  commitSha: string
  imageReference: string
  targetEnvironment: 'preview' | 'staging'
  nodeVersion: '20'
  pnpmVersion: '10.33.0'
  startupMode: 'application-only' | 'database-deploy'
  deploymentRuntime: 'docker' | 'nixpacks'
  requiredConfigurationNames: string[]
  migrationOrder: string[]
  approvals: Record<PreviewReleaseApprovalCategory, PreviewReleaseApprovalRecord>
  rehearsalChecks: Array<{
    key: string
    authorizationCategory: 'smokeVerification' | 'providerDryRun' | 'providerApply' | 'migrationExecution' | 'previewDeployment'
    automated: boolean
    riskSummary: string
    requiredEvidenceFields: string[]
    prerequisites: string[]
    stopConditions: string[]
  }>
  rollbackImageReference: string
  rollbackImageCommit?: string
  backupReference: string
  stopConditions: string[]
  currentBranch: string
  currentHead: string
  repositoryIdentifier: string
  stagedPaths: string[]
  intendedDirtyPaths: string[]
  protectedDirtyPaths: string[]
}

export type PreviewReleasePacketValidationResult = { ok: boolean; errors: string[] }

export type PreviewReleasePacket = PreviewReleasePacketInput & {
  schemaVersion: 1
  repositoryStateReady: boolean
  approvalsComplete: boolean
  executable: boolean
  missingRequirements: string[]
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function placeholder(value: string | undefined): boolean {
  return !value || /^(approval|placeholder|example|todo|pending|change-me|test-approval|backup-reference|operator)$/i.test(value.trim())
}

function unique(values: string[]): boolean {
  return new Set(values).size === values.length
}

function approvalOk(approval: PreviewReleaseApprovalRecord, packet: PreviewReleasePacketInput): boolean {
  if (!approval.authorized) return false
  if (approval.category === 'push' || approval.category === 'imagePublication' || approval.category === 'migrationExecution' || approval.category === 'deployment') {
    if (!isFullGitSha(approval.commitSha) || approval.commitSha !== packet.commitSha) return false
  }
  if (approval.targetEnvironment !== packet.targetEnvironment) return false
  if (placeholder(approval.approvalReference) || placeholder(approval.operator) || placeholder(approval.evidenceReference)) return false
  if (!hasText(approval.approvedAt) || Number.isNaN(Date.parse(approval.approvedAt))) return false
  if (approval.expiresAt && Number.isNaN(Date.parse(approval.expiresAt))) return false
  if (approval.expiresAt && Date.parse(approval.expiresAt) <= Date.parse(approval.approvedAt)) return false
  if (approval.stopConditions.length === 0) return false
  return true
}

export function validatePreviewReleasePacketInput(input: PreviewReleasePacketInput): PreviewReleasePacketValidationResult {
  const errors: string[] = []
  if (!hasText(input.repository)) errors.push('repository_required')
  if (!hasText(input.branch)) errors.push('branch_required')
  if (!isFullGitSha(input.commitSha)) errors.push('commit_sha_required')
  if (!isImmutableImageReference(input.imageReference)) errors.push('immutable_image_required')
  if (input.targetEnvironment !== 'preview' && input.targetEnvironment !== 'staging') errors.push('target_environment_required')
  if (input.nodeVersion !== '20') errors.push('node_version_required')
  if (input.pnpmVersion !== '10.33.0') errors.push('pnpm_version_required')
  if (input.startupMode !== 'application-only' && input.startupMode !== 'database-deploy') errors.push('startup_mode_required')
  if (input.deploymentRuntime !== 'docker' && input.deploymentRuntime !== 'nixpacks') errors.push('deployment_runtime_required')
  if (!validatePreviewMigrationInventoryOrder(input.migrationOrder)) errors.push('migration_order_required')
  if (!unique(input.requiredConfigurationNames)) errors.push('required_configuration_names_must_be_unique')
  if (input.requiredConfigurationNames.some((name) => !/^[A-Z0-9_]+$/.test(name))) errors.push('required_configuration_names_required')
  if (!hasText(input.rollbackImageReference) || !isImmutableImageReference(input.rollbackImageReference)) errors.push('rollback_image_required')
  if (!hasText(input.backupReference) || placeholder(input.backupReference)) errors.push('backup_reference_required')
  if (input.stopConditions.length === 0) errors.push('stop_conditions_required')
  if (input.currentBranch !== input.branch) errors.push('branch_mismatch')
  if (input.currentHead !== input.commitSha) errors.push('head_mismatch')
  if (input.repositoryIdentifier !== input.repository) errors.push('repository_identifier_required')
  if (input.stagedPaths.length > 0) errors.push('staged_paths_must_be_empty')
  if (input.intendedDirtyPaths.some((path) => path.startsWith('.graphifyignore') || path.includes('docs/HANDOFF_AUTH_BRANDING_STAGING_2026-06-30.md'))) errors.push('protected_paths_in_intended_paths')
  if (input.protectedDirtyPaths.some((path) => path.startsWith('.graphifyignore') || path.includes('docs/HANDOFF_AUTH_BRANDING_STAGING_2026-06-30.md')) === false && input.protectedDirtyPaths.length > 0) {
    errors.push('protected_dirty_paths_must_be_explicit')
  }
  if (input.commitSha !== input.currentHead) errors.push('packet_sha_mismatch')
  if (!input.rollbackImageReference.includes(input.commitSha)) errors.push('rollback_image_commit_mismatch')
  const categories = Object.keys(input.approvals) as PreviewReleaseApprovalCategory[]
  if (categories.length !== 11 || !unique(categories)) errors.push('approvals_required')
  for (const approval of Object.values(input.approvals)) {
    if (!approvalOk(approval, input)) errors.push(`approval_invalid:${approval.category}`)
  }
  if (!unique(Object.values(input.approvals).map((approval) => approval.approvalReference))) errors.push('approval_reference_must_be_unique')
  if (Object.values(input.approvals).some((approval) => placeholder(approval.approvalReference) || placeholder(approval.operator))) errors.push('approval_placeholder_rejected')
  if (Object.values(input.approvals).some((approval) => approval.category === 'finalCutover' && approval.authorized && approval.approvalReference)) {
    // final cutover cannot unlock anything else; validation only checks completeness elsewhere
  }
  if (input.rehearsalChecks.length !== PREVIEW_SMOKE_CHECKS.length) errors.push('rehearsal_checks_required')
  const smokeKeys = PREVIEW_SMOKE_CHECKS.map((check) => check.key)
  if (!smokeKeys.every((key, index) => input.rehearsalChecks[index]?.key === key)) errors.push('rehearsal_order_required')
  if (!unique(input.rehearsalChecks.map((check) => check.key))) errors.push('rehearsal_checks_required')
  if (input.rehearsalChecks.some((check, index) => check.key !== smokeKeys[index])) errors.push('unknown_or_missing_rehearsal_check')
  if (input.rehearsalChecks.some((check, index) => check.authorizationCategory !== PREVIEW_SMOKE_CHECKS[index].authorizationCategory)) errors.push('rehearsal_category_mismatch')
  if (input.rehearsalChecks.some((check, index) => check.requiredEvidenceFields.length === 0 || check.stopConditions.length === 0 || check.prerequisites.length === 0 || check.automated !== PREVIEW_SMOKE_CHECKS[index].automated)) errors.push('rehearsal_fields_required')
  const unlocks = ['push','imagePublication','migrationExecution','deployment','providerDryRun','providerApply','billingVerification','communityVerification','partnerVerification','rollbackRehearsal','finalCutover'] as const
  if (input.approvals.finalCutover.authorized && unlocks.some((category) => category !== 'finalCutover' && !input.approvals[category].authorized)) {
    errors.push('final_cutover_cannot_unlock_incomplete_packet')
  }
  return { ok: errors.length === 0, errors }
}

export function buildPreviewReleasePacket(input: PreviewReleasePacketInput): PreviewReleasePacket {
  const validation = validatePreviewReleasePacketInput(input)
  return {
    schemaVersion: 1,
    ...input,
    repositoryStateReady: validation.ok,
    approvalsComplete: validation.ok,
    executable: validation.ok,
    missingRequirements: validation.ok ? [] : validation.errors,
  }
}

export function serializePreviewReleasePacket(packet: PreviewReleasePacket): string {
  return `${JSON.stringify(packet, null, 2)}\n`
}
