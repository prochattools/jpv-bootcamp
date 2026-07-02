import {
  ACCOUNT_EMAIL_PROVIDER_FLOWS,
  REQUIRED_PAYLOAD_MIGRATIONS,
  hasExactMigrationOrder,
  isFullGitSha,
  isImmutableImageReference,
  knownProviderFlows,
} from './previewReleasePolicy'

export type CategoryResult = {
  authorized: boolean
  ok: boolean
  errors: string[]
}

export type PreviewReleasePreflightInput = {
  gitPush?: {
    authorized?: boolean
    branch?: string
    commitSha?: string
    remote?: string
    operator?: string
    stopConditions?: string[]
  }
  imagePublication?: {
    authorized?: boolean
    commitSha?: string
    imageReference?: string
    targetEnvironment?: string
    operator?: string
    stopConditions?: string[]
  }
  payloadMigration?: {
    authorized?: boolean
    environment?: string
    databaseIdentifier?: string
    schema?: string
    migrations?: string[]
    backupEvidence?: string
    maintenanceWindow?: string
    operator?: string
    rollbackOwner?: string
    stopConditions?: string[]
  }
  prismaDatabaseDeploy?: {
    authorized?: boolean
    environment?: string
    startupMode?: string
    deploymentEnv?: string
    deployProdApproval?: boolean
    backupEvidence?: string
    operator?: string
    rollbackOwner?: string
    stopConditions?: string[]
  }
  providerDryRun?: {
    authorized?: boolean
    environment?: string
    mode?: string
    flows?: string[]
    operator?: string
    stopConditions?: string[]
  }
  providerApply?: {
    authorized?: boolean
    environment?: string
    mode?: string
    senderIdentity?: string
    recipientScope?: string
    flows?: string[]
    retryPolicy?: string
    operator?: string
    stopConditions?: string[]
  }
  previewDeployment?: {
    authorized?: boolean
    imageReference?: string
    target?: string
    migrationPrerequisiteStatus?: string
    startupMode?: string
    rollbackImage?: string
    rollbackOwner?: string
    operator?: string
    stopConditions?: string[]
  }
  smokeVerification?: {
    authorized?: boolean
    target?: string
    checks?: string[]
    databaseAccessAllowed?: boolean
    providerEmailAllowed?: boolean
    operator?: string
    stopConditions?: string[]
  }
}

export type PreviewReleasePreflightResult = Record<keyof Required<PreviewReleasePreflightInput>, CategoryResult>

function present(value: unknown): boolean {
  return typeof value === 'string' ? value.trim().length > 0 : Boolean(value)
}

function hasStops(value: unknown): value is string[] {
  return Array.isArray(value) && value.some((entry) => typeof entry === 'string' && entry.trim())
}

function result(authorized: boolean | undefined, errors: string[]): CategoryResult {
  const isAuthorized = authorized === true
  return { authorized: isAuthorized, ok: !isAuthorized || errors.length === 0, errors: isAuthorized ? errors : [] }
}

export function validatePreviewReleasePreflight(
  input: PreviewReleasePreflightInput,
): PreviewReleasePreflightResult {
  const gitPush = input.gitPush ?? {}
  const imagePublication = input.imagePublication ?? {}
  const payloadMigration = input.payloadMigration ?? {}
  const prismaDatabaseDeploy = input.prismaDatabaseDeploy ?? {}
  const providerDryRun = input.providerDryRun ?? {}
  const providerApply = input.providerApply ?? {}
  const previewDeployment = input.previewDeployment ?? {}
  const smokeVerification = input.smokeVerification ?? {}

  return {
    gitPush: result(gitPush.authorized, [
      !present(gitPush.branch) && 'git_branch_required',
      !isFullGitSha(gitPush.commitSha) && 'git_commit_required',
      !present(gitPush.remote) && 'git_remote_required',
      !present(gitPush.operator) && 'operator_required',
      !hasStops(gitPush.stopConditions) && 'stop_conditions_required',
    ].filter(Boolean) as string[]),
    imagePublication: result(imagePublication.authorized, [
      !isFullGitSha(imagePublication.commitSha) && 'image_commit_required',
      !isImmutableImageReference(imagePublication.imageReference) && 'immutable_image_required',
      !present(imagePublication.targetEnvironment) && 'target_environment_required',
      !present(imagePublication.operator) && 'operator_required',
      !hasStops(imagePublication.stopConditions) && 'stop_conditions_required',
    ].filter(Boolean) as string[]),
    payloadMigration: result(payloadMigration.authorized, [
      !present(payloadMigration.environment) && 'environment_required',
      !present(payloadMigration.databaseIdentifier) && 'database_identifier_required',
      !present(payloadMigration.schema) && 'schema_required',
      !hasExactMigrationOrder(payloadMigration.migrations) && 'migration_order_required',
      !present(payloadMigration.backupEvidence) && 'backup_evidence_required',
      !present(payloadMigration.maintenanceWindow) && 'maintenance_window_required',
      !present(payloadMigration.operator) && 'operator_required',
      !present(payloadMigration.rollbackOwner) && 'rollback_owner_required',
      !hasStops(payloadMigration.stopConditions) && 'stop_conditions_required',
    ].filter(Boolean) as string[]),
    prismaDatabaseDeploy: result(prismaDatabaseDeploy.authorized, [
      !present(prismaDatabaseDeploy.environment) && 'environment_required',
      prismaDatabaseDeploy.startupMode !== 'database-deploy' && 'startup_mode_database_deploy_required',
      !present(prismaDatabaseDeploy.deploymentEnv) && 'deployment_env_required',
      prismaDatabaseDeploy.deployProdApproval !== true && 'deploy_prod_approval_required',
      !present(prismaDatabaseDeploy.backupEvidence) && 'backup_evidence_required',
      !present(prismaDatabaseDeploy.operator) && 'operator_required',
      !present(prismaDatabaseDeploy.rollbackOwner) && 'rollback_owner_required',
      !hasStops(prismaDatabaseDeploy.stopConditions) && 'stop_conditions_required',
    ].filter(Boolean) as string[]),
    providerDryRun: result(providerDryRun.authorized, [
      !present(providerDryRun.environment) && 'environment_required',
      providerDryRun.mode !== 'dry-run-only' && 'dry_run_mode_required',
      !knownProviderFlows(providerDryRun.flows) && 'known_flows_required',
      !present(providerDryRun.operator) && 'operator_required',
      !hasStops(providerDryRun.stopConditions) && 'stop_conditions_required',
    ].filter(Boolean) as string[]),
    providerApply: result(providerApply.authorized, [
      !present(providerApply.environment) && 'environment_required',
      providerApply.mode !== 'apply' && 'apply_mode_required',
      !present(providerApply.senderIdentity) && 'sender_identity_required',
      !present(providerApply.recipientScope) && 'recipient_scope_required',
      !knownProviderFlows(providerApply.flows) && 'known_flows_required',
      !present(providerApply.retryPolicy) && 'retry_policy_required',
      !present(providerApply.operator) && 'operator_required',
      !hasStops(providerApply.stopConditions) && 'stop_conditions_required',
    ].filter(Boolean) as string[]),
    previewDeployment: result(previewDeployment.authorized, [
      !isImmutableImageReference(previewDeployment.imageReference) && 'immutable_image_required',
      !present(previewDeployment.target) && 'target_required',
      !present(previewDeployment.migrationPrerequisiteStatus) && 'migration_prerequisite_required',
      !present(previewDeployment.startupMode) && 'startup_mode_required',
      !isImmutableImageReference(previewDeployment.rollbackImage) && 'rollback_image_required',
      !present(previewDeployment.rollbackOwner) && 'rollback_owner_required',
      !present(previewDeployment.operator) && 'operator_required',
      !hasStops(previewDeployment.stopConditions) && 'stop_conditions_required',
    ].filter(Boolean) as string[]),
    smokeVerification: result(smokeVerification.authorized, [
      !present(smokeVerification.target) && 'target_required',
      !(Array.isArray(smokeVerification.checks) && smokeVerification.checks.length > 0) && 'checks_required',
      typeof smokeVerification.databaseAccessAllowed !== 'boolean' && 'database_permission_required',
      typeof smokeVerification.providerEmailAllowed !== 'boolean' && 'provider_permission_required',
      !present(smokeVerification.operator) && 'operator_required',
      !hasStops(smokeVerification.stopConditions) && 'stop_conditions_required',
    ].filter(Boolean) as string[]),
  }
}

export function knownProviderFlowList(): string[] {
  return [...ACCOUNT_EMAIL_PROVIDER_FLOWS]
}

export function expectedPayloadMigrationOrder(): string[] {
  return [...REQUIRED_PAYLOAD_MIGRATIONS]
}
