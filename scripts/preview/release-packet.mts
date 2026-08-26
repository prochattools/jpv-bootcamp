import { readFileSync } from 'node:fs'

import { previewMigrationInventoryNames } from '../../src/lib/previewMigrationInventory'
import { PREVIEW_SMOKE_CHECKS } from '../../src/lib/previewSmokePlan'
import {
  buildPreviewReleasePacket,
  serializePreviewReleasePacket,
  validatePreviewReleasePacketInput,
} from '../../src/lib/previewReleasePacket'
import { readRepositoryState } from '../../src/lib/repositoryState'
import { buildStagingCandidateReport, serializeStagingCandidateReport } from '../../src/lib/stagingCandidateReport'

function arg(name: string): string | undefined {
  const prefix = `--${name}=`
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length)
}

function readJson(path?: string): unknown {
  if (!path) return undefined
  return JSON.parse(readFileSync(path, 'utf8'))
}

function draft() {
  const input = readJson(arg('input-file')) as any | undefined
  const state = readRepositoryState('feature/course-branding-and-preview', arg('commit-sha') ?? process.env.GIT_COMMIT ?? '', 'prochattools/jpv-bootcamp')
  const packet = buildPreviewReleasePacket({
    repository: 'prochattools/jpv-bootcamp',
    branch: state.actualBranch || 'feature/course-branding-and-preview',
    commitSha: input?.commitSha ?? arg('commit-sha') ?? '',
    imageReference: input?.imageReference ?? arg('image-reference') ?? '',
    targetEnvironment: input?.targetEnvironment ?? 'preview',
    nodeVersion: '20',
    pnpmVersion: '10.33.0',
    startupMode: input?.startupMode ?? 'application-only',
    deploymentRuntime: input?.deploymentRuntime ?? 'docker',
    requiredConfigurationNames: input?.requiredConfigurationNames ?? ['DATABASE_URL', 'SYSTEM_DATABASE_URL'],
    migrationOrder: input?.migrationOrder ?? previewMigrationInventoryNames(),
    approvals: input?.approvals ?? {
      push: { category: 'push', authorized: false, targetEnvironment: 'preview', operator: 'missing', approvalReference: 'missing', approvedAt: '1970-01-01T00:00:00.000Z', evidenceReference: 'missing', stopConditions: ['missing'] },
      imagePublication: { category: 'imagePublication', authorized: false, targetEnvironment: 'preview', operator: 'missing', approvalReference: 'missing', approvedAt: '1970-01-01T00:00:00.000Z', evidenceReference: 'missing', stopConditions: ['missing'] },
      migrationExecution: { category: 'migrationExecution', authorized: false, targetEnvironment: 'preview', commitSha: state.actualHead, operator: 'missing', approvalReference: 'missing', approvedAt: '1970-01-01T00:00:00.000Z', evidenceReference: 'missing', stopConditions: ['missing'] },
      deployment: { category: 'deployment', authorized: false, targetEnvironment: 'preview', commitSha: state.actualHead, operator: 'missing', approvalReference: 'missing', approvedAt: '1970-01-01T00:00:00.000Z', evidenceReference: 'missing', stopConditions: ['missing'] },
      providerDryRun: { category: 'providerDryRun', authorized: false, targetEnvironment: 'preview', operator: 'missing', approvalReference: 'missing', approvedAt: '1970-01-01T00:00:00.000Z', evidenceReference: 'missing', stopConditions: ['missing'] },
      providerApply: { category: 'providerApply', authorized: false, targetEnvironment: 'preview', operator: 'missing', approvalReference: 'missing', approvedAt: '1970-01-01T00:00:00.000Z', evidenceReference: 'missing', stopConditions: ['missing'] },
      billingVerification: { category: 'billingVerification', authorized: false, targetEnvironment: 'preview', operator: 'missing', approvalReference: 'missing', approvedAt: '1970-01-01T00:00:00.000Z', evidenceReference: 'missing', stopConditions: ['missing'] },
      communityVerification: { category: 'communityVerification', authorized: false, targetEnvironment: 'preview', operator: 'missing', approvalReference: 'missing', approvedAt: '1970-01-01T00:00:00.000Z', evidenceReference: 'missing', stopConditions: ['missing'] },
      partnerVerification: { category: 'partnerVerification', authorized: false, targetEnvironment: 'preview', operator: 'missing', approvalReference: 'missing', approvedAt: '1970-01-01T00:00:00.000Z', evidenceReference: 'missing', stopConditions: ['missing'] },
      rollbackRehearsal: { category: 'rollbackRehearsal', authorized: false, targetEnvironment: 'preview', operator: 'missing', approvalReference: 'missing', approvedAt: '1970-01-01T00:00:00.000Z', evidenceReference: 'missing', stopConditions: ['missing'] },
      finalCutover: { category: 'finalCutover', authorized: false, targetEnvironment: 'preview', operator: 'missing', approvalReference: 'missing', approvedAt: '1970-01-01T00:00:00.000Z', evidenceReference: 'missing', stopConditions: ['missing'] },
    },
    rehearsalChecks: PREVIEW_SMOKE_CHECKS.map((check) => ({
      key: check.key,
      authorizationCategory: check.authorizationCategory,
      automated: check.automated,
      riskSummary: [
        check.risk.networkRequired ? 'network' : 'offline',
        check.risk.authenticationRequired ? 'auth' : 'no-auth',
        check.risk.mutationPossible ? 'mutation' : 'read-only',
      ].join(','),
      requiredEvidenceFields: [...check.requiredEvidenceFields],
      prerequisites: [...check.prerequisites],
      stopConditions: [...check.stopConditions],
    })),
    rollbackImageReference: input?.rollbackImageReference ?? arg('rollback-image-reference') ?? '',
    rollbackImageCommit: input?.rollbackImageCommit ?? state.actualHead,
    backupReference: input?.backupReference ?? 'missing',
    stopConditions: input?.stopConditions ?? ['missing approval'],
    currentBranch: state.actualBranch,
    currentHead: state.actualHead,
    repositoryIdentifier: state.repositoryIdentifier,
    stagedPaths: state.stagedPaths,
    intendedDirtyPaths: state.intendedDirtyPaths,
    protectedDirtyPaths: state.protectedDirtyPaths,
  })
  process.stdout.write(serializePreviewReleasePacket(packet))
}

function validate() {
  const packet = readJson(arg('packet-file')) as Parameters<typeof validatePreviewReleasePacketInput>[0]
  const result = validatePreviewReleasePacketInput(packet)
  console.log(JSON.stringify(result, null, 2))
  process.exitCode = result.ok ? 0 : 1
}

async function candidateReport() {
  const packet = readJson(arg('packet-file')) as ReturnType<typeof buildPreviewReleasePacket> | undefined
  const rollbackPlan = readJson(arg('rollback-file')) as any | undefined
  const report = await buildStagingCandidateReport({
    expectedBranch: 'feature/course-branding-and-preview',
    expectedHead: process.env.GIT_COMMIT ?? arg('commit-sha') ?? '',
    releasePacket:
      packet ??
      buildPreviewReleasePacket({
        repository: 'prochattools/jpv-bootcamp',
        branch: 'feature/course-branding-and-preview',
        commitSha: arg('commit-sha') ?? '',
        imageReference: arg('image-reference') ?? '',
        targetEnvironment: 'preview',
        nodeVersion: '20',
        pnpmVersion: '10.33.0',
        startupMode: 'application-only',
        deploymentRuntime: 'docker',
        requiredConfigurationNames: ['DATABASE_URL', 'SYSTEM_DATABASE_URL'],
        migrationOrder: previewMigrationInventoryNames(),
        approvals: {
          push: { category: 'push', authorized: false, targetEnvironment: 'preview', operator: 'missing', approvalReference: 'missing', approvedAt: '1970-01-01T00:00:00.000Z', evidenceReference: 'missing', stopConditions: ['missing'] },
          imagePublication: { category: 'imagePublication', authorized: false, targetEnvironment: 'preview', operator: 'missing', approvalReference: 'missing', approvedAt: '1970-01-01T00:00:00.000Z', evidenceReference: 'missing', stopConditions: ['missing'] },
          migrationExecution: { category: 'migrationExecution', authorized: false, targetEnvironment: 'preview', commitSha: arg('commit-sha') ?? '', operator: 'missing', approvalReference: 'missing', approvedAt: '1970-01-01T00:00:00.000Z', evidenceReference: 'missing', stopConditions: ['missing'] },
          deployment: { category: 'deployment', authorized: false, targetEnvironment: 'preview', commitSha: arg('commit-sha') ?? '', operator: 'missing', approvalReference: 'missing', approvedAt: '1970-01-01T00:00:00.000Z', evidenceReference: 'missing', stopConditions: ['missing'] },
          providerDryRun: { category: 'providerDryRun', authorized: false, targetEnvironment: 'preview', operator: 'missing', approvalReference: 'missing', approvedAt: '1970-01-01T00:00:00.000Z', evidenceReference: 'missing', stopConditions: ['missing'] },
          providerApply: { category: 'providerApply', authorized: false, targetEnvironment: 'preview', operator: 'missing', approvalReference: 'missing', approvedAt: '1970-01-01T00:00:00.000Z', evidenceReference: 'missing', stopConditions: ['missing'] },
          billingVerification: { category: 'billingVerification', authorized: false, targetEnvironment: 'preview', operator: 'missing', approvalReference: 'missing', approvedAt: '1970-01-01T00:00:00.000Z', evidenceReference: 'missing', stopConditions: ['missing'] },
          communityVerification: { category: 'communityVerification', authorized: false, targetEnvironment: 'preview', operator: 'missing', approvalReference: 'missing', approvedAt: '1970-01-01T00:00:00.000Z', evidenceReference: 'missing', stopConditions: ['missing'] },
          partnerVerification: { category: 'partnerVerification', authorized: false, targetEnvironment: 'preview', operator: 'missing', approvalReference: 'missing', approvedAt: '1970-01-01T00:00:00.000Z', evidenceReference: 'missing', stopConditions: ['missing'] },
          rollbackRehearsal: { category: 'rollbackRehearsal', authorized: false, targetEnvironment: 'preview', operator: 'missing', approvalReference: 'missing', approvedAt: '1970-01-01T00:00:00.000Z', evidenceReference: 'missing', stopConditions: ['missing'] },
          finalCutover: { category: 'finalCutover', authorized: false, targetEnvironment: 'preview', operator: 'missing', approvalReference: 'missing', approvedAt: '1970-01-01T00:00:00.000Z', evidenceReference: 'missing', stopConditions: ['missing'] },
        },
        rehearsalChecks: PREVIEW_SMOKE_CHECKS.map((check) => ({
          key: check.key,
          authorizationCategory: check.authorizationCategory,
          automated: check.automated,
          riskSummary: 'offline',
          requiredEvidenceFields: [...check.requiredEvidenceFields],
          prerequisites: [...check.prerequisites],
          stopConditions: [...check.stopConditions],
        })),
        rollbackImageReference: arg('rollback-image-reference') ?? '',
        rollbackImageCommit: arg('commit-sha') ?? '',
        backupReference: 'missing',
        stopConditions: ['missing'],
        currentBranch: 'feature/course-branding-and-preview',
        currentHead: arg('commit-sha') ?? '',
        repositoryIdentifier: 'prochattools/jpv-bootcamp',
        stagedPaths: [],
        intendedDirtyPaths: [],
        protectedDirtyPaths: [],
      }),
    rollbackPlan:
      rollbackPlan ??
      ({
        currentCommitSha: arg('commit-sha') ?? '',
        previousImmutableImageReference: arg('rollback-image-reference') ?? '',
        targetEnvironment: 'preview',
        backupReference: 'missing',
        planningMode: 'draft',
        plannedFreezeControls: {
          memberWritesFrozen: false,
          communityPublishingFrozen: false,
          partnerDeliveryFrozen: false,
          providerEmailFrozen: false,
          billingSideChangesFrozen: false,
        },
        migrationBackout: [],
        prismaDatabaseStartup: {
          startupMode: 'application-only',
          deploymentEnv: 'preview',
          requiresApproval: false,
        },
        webhookPreservation: {
          preserveExistingEvents: true,
          replaySafe: true,
          replayNotes: 'missing',
        },
        successChecks: [],
        hardStopConditions: [],
        authorizationStatus: 'missing',
        missingRequirements: ['missing'],
        generatedFromCommit: arg('commit-sha') ?? '',
        canonicalMigrationInventoryDigest: 'sha256:missing',
        backupReferencePresent: false,
        protectedPathsExcluded: true,
        executable: false,
      }),
  })
  console.log(JSON.stringify(report, null, 2))
}

switch (arg('mode') ?? 'draft') {
  case 'draft':
    draft()
    break
  case 'validate':
    validate()
    break
  case 'candidate-report':
    candidateReport().catch((error) => {
      console.error((error as Error).message)
      process.exit(1)
    })
    break
  default:
    throw new Error('invalid_mode')
}
