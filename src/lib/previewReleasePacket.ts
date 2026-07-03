import { previewMigrationInventoryNames, validatePreviewMigrationInventoryOrder } from './previewMigrationInventory'
import { isFullGitSha, isImmutableImageReference } from './previewReleasePolicy'

export type PreviewReleasePacketInput = {
  commitSha: string
  imageReference: string
  targetEnvironment: 'preview' | 'staging'
  nodeVersion: '20'
  pnpmVersion: '10.33.0'
  startupMode: 'application-only' | 'database-deploy'
  deploymentRuntime: 'docker' | 'nixpacks'
  requiredConfigurationNames: string[]
  migrationOrder: string[]
  approvals: {
    push: string
    imagePublication: string
    migrationExecution: string
    deployment: string
    providerDryRun: string
    providerApply: string
    billingVerification: string
    communityVerification: string
    partnerVerification: string
    rollbackRehearsal: string
    finalCutover: string
  }
  rehearsalChecks: Array<{ key: string; evidenceFields: string[] }>
  rollbackImageReference: string
  backupReference: string
  stopConditions: string[]
}

export type PreviewReleasePacketValidationResult = {
  ok: boolean
  errors: string[]
}

export type PreviewReleasePacket = PreviewReleasePacketInput & {
  schemaVersion: 1
  repository: 'prochattools/jpv-bootcamp'
  migrationOrder: string[]
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function hasApproval(values: Record<string, string>): boolean {
  const approvals = Object.values(values)
  return approvals.every(hasText) && new Set(approvals).size === approvals.length
}

export function validatePreviewReleasePacketInput(
  input: PreviewReleasePacketInput,
): PreviewReleasePacketValidationResult {
  const errors: string[] = []
  if (!isFullGitSha(input.commitSha)) errors.push('commit_sha_required')
  if (!isImmutableImageReference(input.imageReference)) errors.push('immutable_image_required')
  if (input.targetEnvironment !== 'preview' && input.targetEnvironment !== 'staging') errors.push('target_environment_required')
  if (input.nodeVersion !== '20') errors.push('node_version_required')
  if (input.pnpmVersion !== '10.33.0') errors.push('pnpm_version_required')
  if (input.startupMode !== 'application-only' && input.startupMode !== 'database-deploy') errors.push('startup_mode_required')
  if (input.deploymentRuntime !== 'docker' && input.deploymentRuntime !== 'nixpacks') errors.push('deployment_runtime_required')
  if (!validatePreviewMigrationInventoryOrder(input.migrationOrder)) errors.push('migration_order_required')
  if (!hasApproval(input.approvals)) errors.push('approvals_required')
  if (input.rehearsalChecks.length === 0) errors.push('rehearsal_checks_required')
  if (!isImmutableImageReference(input.rollbackImageReference)) errors.push('rollback_image_required')
  if (!hasText(input.backupReference)) errors.push('backup_reference_required')
  if (input.stopConditions.length === 0) errors.push('stop_conditions_required')
  return { ok: errors.length === 0, errors }
}

export function buildPreviewReleasePacket(input: PreviewReleasePacketInput): PreviewReleasePacket {
  const validation = validatePreviewReleasePacketInput(input)
  if (!validation.ok) {
    throw new Error(`Invalid release packet input: ${validation.errors.join(', ')}`)
  }

  return {
    schemaVersion: 1,
    repository: 'prochattools/jpv-bootcamp',
    migrationOrder: previewMigrationInventoryNames(),
    ...input,
  }
}

export function serializePreviewReleasePacket(packet: PreviewReleasePacket): string {
  return `${JSON.stringify(packet, null, 2)}\n`
}
