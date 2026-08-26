import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

import { previewMigrationInventoryNames } from '../src/lib/previewMigrationInventory'
import { PREVIEW_SMOKE_CHECKS } from '../src/lib/previewSmokePlan'
import { buildPreviewReleasePacket } from '../src/lib/previewReleasePacket'
import { buildPreviewRollbackPlan } from '../src/lib/previewRollbackPlan'
import { buildStagingCandidateReport } from '../src/lib/stagingCandidateReport'

async function main(): Promise<void> {
  const actualHead = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  const commitSha = actualHead
  const approvals = Object.fromEntries(
    (['push','imagePublication','migrationExecution','deployment','providerDryRun','providerApply','billingVerification','communityVerification','partnerVerification','rollbackRehearsal','finalCutover'] as const).map((category) => [
      category,
      {
        category,
        authorized: false,
        targetEnvironment: 'preview' as const,
        commitSha,
        operator: 'operator-1',
        approvalReference: `${category}-ref`,
        approvedAt: '2026-07-03T00:00:00.000Z',
        evidenceReference: `${category}-evidence`,
        stopConditions: ['stop'],
      },
    ]),
  )

  const packet = buildPreviewReleasePacket({
    repository: 'prochattools/jpv-bootcamp',
    branch: 'feature/course-branding-and-preview',
    commitSha,
    imageReference: `ghcr.io/prochattools/jpv-bootcamp:${commitSha}`,
    targetEnvironment: 'preview',
    nodeVersion: '20',
    pnpmVersion: '10.33.0',
    startupMode: 'application-only',
    deploymentRuntime: 'docker',
    requiredConfigurationNames: ['DATABASE_URL', 'SYSTEM_DATABASE_URL'],
    migrationOrder: previewMigrationInventoryNames(),
    approvals: approvals as any,
    rehearsalChecks: PREVIEW_SMOKE_CHECKS.map((check) => ({
      key: check.key,
      authorizationCategory: check.authorizationCategory,
      automated: check.automated,
      riskSummary: 'offline',
      requiredEvidenceFields: check.requiredEvidenceFields,
      prerequisites: check.prerequisites,
      stopConditions: check.stopConditions,
    })),
    rollbackImageReference: `ghcr.io/prochattools/jpv-bootcamp:${commitSha}`,
    rollbackImageCommit: commitSha,
    backupReference: 'backup-ticket-1',
    stopConditions: ['stop'],
    currentBranch: 'feature/course-branding-and-preview',
    currentHead: commitSha,
    repositoryIdentifier: 'prochattools/jpv-bootcamp',
    stagedPaths: [],
    intendedDirtyPaths: [],
    protectedDirtyPaths: ['.graphifyignore'],
  })

  const rollback = buildPreviewRollbackPlan({
    currentCommitSha: commitSha,
    previousImmutableImageReference: `ghcr.io/prochattools/jpv-bootcamp:${commitSha}`,
    targetEnvironment: 'preview',
    backupReference: 'backup-ticket-1',
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
      requiresApproval: true,
    },
    webhookPreservation: {
      preserveExistingEvents: true,
      replaySafe: true,
      replayNotes: 'repository-only planning',
    },
    successChecks: ['rollback'],
    hardStopConditions: ['backup missing'],
    authorizationStatus: 'missing',
    missingRequirements: ['rollback approval missing'],
    generatedFromCommit: commitSha,
    canonicalMigrationInventoryDigest: `sha256:${previewMigrationInventoryNames().join('|')}`,
    backupReferencePresent: true,
    protectedPathsExcluded: true,
    executable: false,
  })

  const report = await buildStagingCandidateReport({
    expectedBranch: 'feature/course-branding-and-preview',
    expectedHead: actualHead,
    releasePacket: packet,
    rollbackPlan: rollback,
    repositoryStateOverride: {
      expectedBranch: 'feature/course-branding-and-preview',
      actualBranch: 'feature/course-branding-and-preview',
      expectedHead: actualHead,
      actualHead,
      intendedDirtyPaths: [],
      protectedDirtyPaths: ['.graphifyignore', 'docs/HANDOFF_AUTH_BRANDING_STAGING_2026-06-30.md'],
      stagedPaths: [],
      currentCommit: actualHead,
      repositoryIdentifier: 'prochattools/jpv-bootcamp',
    },
  })

  assert.ok(report.approvalStatus.repositoryReady)
  assert.equal(report.approvalStatus.executable, false)
  assert.equal(report.approvalStatus.nextRequiredAuthorization, 'push')
  assert.equal(report.rehearsalChecks.length, PREVIEW_SMOKE_CHECKS.length)
  assert.equal(report.approvalStatus.readiness, 'ready-to-request-approval')

  console.log('staging_candidate_report.test.ts passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
