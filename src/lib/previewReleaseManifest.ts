import {
  PREVIEW_RELEASE_SCHEMA_VERSION,
  REQUIRED_PAYLOAD_MIGRATIONS,
  hasExactMigrationOrder,
  isFullGitSha,
  isImmutableImageReference,
} from './previewReleasePolicy'

export type PreviewReleaseManifestInput = {
  repository: string
  branch?: string
  commitSha: string
  imageReference?: string
  targetEnvironment: string
  startupMode: 'application-only' | 'database-deploy'
  deploymentRuntime: 'docker' | 'nixpacks'
  deploymentEnv?: string
  sourceDate: string
  releaseLabel?: string
  artifactDigest?: string
  rollbackImageReference?: string
  payloadMigrations?: string[]
  authorizations?: {
    payloadMigrations?: boolean
    prismaDatabaseDeploy?: boolean
    providerDryRun?: boolean
    providerApply?: boolean
    previewDeployment?: boolean
    smokeVerification?: boolean
  }
  providerApply?: {
    approvedSenderIdentity?: string
  }
}

export type PreviewReleaseManifest = {
  schemaVersion: number
  repository: string
  branch?: string
  commitSha: string
  imageReference?: string
  imageTag?: string
  targetEnvironment: string
  startupMode: 'application-only' | 'database-deploy'
  deploymentRuntime: 'docker' | 'nixpacks'
  deploymentEnv?: string
  nodeVersion: '20'
  pnpmVersion: '10.33.0'
  payloadMigrations: string[]
  authorizations: {
    payloadMigrations: boolean
    prismaDatabaseDeploy: boolean
    providerDryRun: boolean
    providerApply: boolean
    previewDeployment: boolean
    smokeVerification: boolean
  }
  sourceDate: string
  releaseLabel?: string
  artifactDigest?: string
  rollbackImageReference?: string
  requiredConfigurationNames: string[]
}

export type ManifestValidationResult = {
  ok: boolean
  errors: string[]
}

const REQUIRED_CONFIG_NAMES = [
  'DATABASE_URL',
  'SYSTEM_DATABASE_URL',
  'APP_SLUG',
  'NODE_ENV',
  'PAYLOAD_SECRET',
  'APP_PUBLIC_URL',
  'STARTUP_MODE',
  'DEPLOYMENT_RUNTIME',
  'RESEND_API_KEY',
  'RESEND_FROM',
  'EMAIL_REPLY_TO',
  'DISABLE_NON_WEBHOOK_EMAILS',
]

function imageTag(imageReference?: string): string | undefined {
  if (!imageReference || imageReference.includes('@sha256:')) return undefined
  return imageReference.split(':').at(-1)
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, stable(entry)]),
  )
}

export function validatePreviewReleaseManifestInput(
  input: PreviewReleaseManifestInput,
): ManifestValidationResult {
  const errors: string[] = []
  if (!input.repository.trim()) errors.push('repository_required')
  if (!isFullGitSha(input.commitSha)) errors.push('invalid_commit_sha')
  if (input.imageReference && !isImmutableImageReference(input.imageReference)) {
    errors.push('invalid_or_mutable_image_reference')
  }
  if (!hasExactMigrationOrder(input.payloadMigrations ?? [...REQUIRED_PAYLOAD_MIGRATIONS])) {
    errors.push('invalid_payload_migration_order')
  }
  if (input.startupMode === 'database-deploy' && !input.deploymentEnv?.trim()) {
    errors.push('database_deploy_requires_deployment_env')
  }
  if (input.authorizations?.providerApply && !input.providerApply?.approvedSenderIdentity?.trim()) {
    errors.push('provider_apply_requires_sender_identity')
  }
  if (input.authorizations?.previewDeployment && !input.imageReference) {
    errors.push('deployment_requires_image_reference')
  }
  if (input.authorizations?.providerDryRun && input.authorizations.providerApply) {
    errors.push('provider_dry_run_and_apply_are_mutually_exclusive')
  }
  return { ok: errors.length === 0, errors }
}

export function buildPreviewReleaseManifest(
  input: PreviewReleaseManifestInput,
): PreviewReleaseManifest {
  const validation = validatePreviewReleaseManifestInput(input)
  if (!validation.ok) {
    throw new Error(`Invalid release manifest input: ${validation.errors.join(', ')}`)
  }

  return {
    schemaVersion: PREVIEW_RELEASE_SCHEMA_VERSION,
    repository: input.repository,
    branch: input.branch,
    commitSha: input.commitSha.toLowerCase(),
    imageReference: input.imageReference,
    imageTag: imageTag(input.imageReference),
    targetEnvironment: input.targetEnvironment,
    startupMode: input.startupMode,
    deploymentRuntime: input.deploymentRuntime,
    deploymentEnv: input.deploymentEnv,
    nodeVersion: '20',
    pnpmVersion: '10.33.0',
    payloadMigrations: [...(input.payloadMigrations ?? REQUIRED_PAYLOAD_MIGRATIONS)],
    authorizations: {
      payloadMigrations: Boolean(input.authorizations?.payloadMigrations),
      prismaDatabaseDeploy: Boolean(input.authorizations?.prismaDatabaseDeploy),
      providerDryRun: Boolean(input.authorizations?.providerDryRun),
      providerApply: Boolean(input.authorizations?.providerApply),
      previewDeployment: Boolean(input.authorizations?.previewDeployment),
      smokeVerification: Boolean(input.authorizations?.smokeVerification),
    },
    sourceDate: input.sourceDate,
    releaseLabel: input.releaseLabel || undefined,
    artifactDigest: input.artifactDigest,
    rollbackImageReference: input.rollbackImageReference,
    requiredConfigurationNames: [...REQUIRED_CONFIG_NAMES],
  }
}

export function serializePreviewReleaseManifest(manifest: PreviewReleaseManifest): string {
  return `${JSON.stringify(stable(manifest), null, 2)}\n`
}
