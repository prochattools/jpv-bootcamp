import { previewMigrationInventoryNames } from './previewMigrationInventory'
import { buildPreviewReleaseManifest } from './previewReleaseManifest'
import { buildPreviewReleasePacket, type PreviewReleasePacket } from './previewReleasePacket'
import { buildPreviewRollbackPlan, type PreviewRollbackPlanInput } from './previewRollbackPlan'
import { PREVIEW_SMOKE_CHECKS } from './previewSmokePlan'
import { readRepositoryState, validateRepositoryState, type RepositoryState } from './repositoryState'
import { buildShadowValidationReport } from './shadowValidationReport'

export type StagingCandidateReport = {
  repositoryState: RepositoryState
  manifest: ReturnType<typeof buildPreviewReleaseManifest>
  packet: PreviewReleasePacket
  rollbackPlan: PreviewRollbackPlanInput
  migrationInventory: string[]
  rehearsalChecks: typeof PREVIEW_SMOKE_CHECKS
  shadowValidationSummary: Pick<Awaited<ReturnType<typeof buildShadowValidationReport>>, 'repositoryReady' | 'configurationReady' | 'cutoverReady' | 'issues' | 'journeys'>
  requiredConfigurationNames: string[]
  approvalStatus: {
    repositoryReady: boolean
    artifactReady: boolean
    rollbackReady: boolean
    migrationPlanReady: boolean
    rehearsalPlanReady: boolean
    approvalsComplete: boolean
    executable: boolean
    blockers: string[]
    warnings: string[]
    nextRequiredAuthorization: string
    exactNextSafeOperatorStep: string
    readiness: 'ready-to-request-approval' | 'approved-for-one-operation' | 'executable-for-one-operation' | 'fully-staged' | 'cutover-ready'
  }
}

export async function buildStagingCandidateReport(input: {
  expectedBranch: string
  expectedHead: string
  releasePacket: PreviewReleasePacket
  rollbackPlan: PreviewRollbackPlanInput
  repositoryIdentifier?: string
  repositoryStateOverride?: RepositoryState
}): Promise<StagingCandidateReport> {
  const repositoryState = input.repositoryStateOverride ?? readRepositoryState(input.expectedBranch, input.expectedHead, input.repositoryIdentifier)
  const stateValidation = validateRepositoryState(repositoryState)
  const manifest = buildPreviewReleaseManifest({
    repository: repositoryState.repositoryIdentifier,
    branch: repositoryState.actualBranch,
    commitSha: repositoryState.actualHead,
    imageReference: input.releasePacket.imageReference,
    targetEnvironment: input.releasePacket.targetEnvironment,
    startupMode: input.releasePacket.startupMode,
    deploymentRuntime: input.releasePacket.deploymentRuntime,
    deploymentEnv: input.releasePacket.targetEnvironment,
    sourceDate: new Date().toISOString(),
    payloadMigrations: previewMigrationInventoryNames(),
    authorizations: {
      payloadMigrations: false,
      prismaDatabaseDeploy: false,
      providerDryRun: false,
      providerApply: false,
      previewDeployment: false,
      smokeVerification: false,
    },
    rollbackImageReference: input.rollbackPlan.previousImmutableImageReference,
  })
  const shadow = await buildShadowValidationReport(process.env)
  const blockers = [...stateValidation.errors, ...input.releasePacket.missingRequirements, ...input.rollbackPlan.missingRequirements]
  return {
    repositoryState,
    manifest,
    packet: input.releasePacket,
    rollbackPlan: input.rollbackPlan,
    migrationInventory: previewMigrationInventoryNames(),
    rehearsalChecks: PREVIEW_SMOKE_CHECKS,
    shadowValidationSummary: {
      repositoryReady: shadow.repositoryReady,
      configurationReady: shadow.configurationReady,
      cutoverReady: shadow.cutoverReady,
      issues: shadow.issues,
      journeys: shadow.journeys,
    },
    requiredConfigurationNames: manifest.requiredConfigurationNames,
    approvalStatus: {
      repositoryReady: stateValidation.ok,
      artifactReady: Boolean(input.releasePacket.imageReference),
      rollbackReady: input.rollbackPlan.executable,
      migrationPlanReady: true,
      rehearsalPlanReady: PREVIEW_SMOKE_CHECKS.length > 0,
      approvalsComplete: input.releasePacket.approvalsComplete,
      executable: stateValidation.ok && input.releasePacket.executable && input.rollbackPlan.executable,
      blockers,
      warnings: ['repository-only report'],
      nextRequiredAuthorization: stateValidation.ok ? 'push' : 'repository-state-fix',
      exactNextSafeOperatorStep: stateValidation.ok ? 'Request branch push authorization' : 'Fix repository state before requesting approvals',
      readiness: stateValidation.ok ? 'ready-to-request-approval' : 'ready-to-request-approval',
    },
  }
}

export function serializeStagingCandidateReport(report: StagingCandidateReport): string {
  return `${JSON.stringify(report, null, 2)}\n`
}
